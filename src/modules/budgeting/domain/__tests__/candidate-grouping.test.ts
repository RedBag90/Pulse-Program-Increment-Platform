import { describe, it, expect } from "vitest";
import {
  groupCandidates,
  groupItems,
  worksheetSections,
  NO_SOLUTION,
  NO_VALUE_STREAM,
  type GroupableCandidate,
} from "@/modules/budgeting/domain/candidate-grouping";

interface Cand extends GroupableCandidate {
  title: string;
  ask: number;
}

const c = (
  title: string,
  ask: number,
  kind: string,
  valueStreamName: string | null,
  solutionName: string | null,
): Cand => ({ title, ask, kind, valueStreamName, solutionName });

const group = (items: Cand[]) => groupCandidates(items, (x) => x.ask);

describe("groupCandidates", () => {
  it("trennt Betrieb von Veränderung — Run zuerst", () => {
    const g = group([
      c("Epic", 100, "epic", "Logistik", "Kern"),
      c("Betrieb", 50, "rtb", "Logistik", null),
    ]);
    expect(g.map((x) => x.kind)).toEqual(["run", "grow"]);
    expect(g.map((x) => x.label)).toEqual(["Run the Business", "Grow the Business"]);
  });

  it("leere Ebenen entstehen nicht", () => {
    const g = group([c("Epic", 100, "epic", "Logistik", "Kern")]);
    expect(g).toHaveLength(1);
    expect(g[0]!.kind).toBe("grow");
  });

  it("die Summen addieren sich über alle drei Ebenen", () => {
    const g = group([
      c("A", 100, "epic", "Logistik", "Kern"),
      c("B", 200, "epic", "Logistik", "Kern"),
      c("C", 300, "epic", "Produktion", "Werk"),
    ]);
    const grow = g[0]!;
    expect(grow.total).toBe(600);
    expect(grow.valueStreams.reduce((s, v) => s + v.total, 0)).toBe(600);
    for (const vs of grow.valueStreams) {
      expect(vs.solutions.reduce((s, x) => s + x.total, 0)).toBe(vs.total);
    }
  });

  it("sortiert jede Ebene absteigend nach Betrag", () => {
    const g = group([
      c("klein", 10, "epic", "Klein", "S1"),
      c("groß", 500, "epic", "Groß", "S2"),
      c("mittel", 100, "epic", "Mittel", "S3"),
    ]);
    expect(g[0]!.valueStreams.map((v) => v.name)).toEqual(["Groß", "Mittel", "Klein"]);
  });

  it("innerhalb einer Solution stehen die größten Zeilen oben", () => {
    const g = group([c("klein", 10, "epic", "VS", "S"), c("groß", 90, "epic", "VS", "S")]);
    expect(g[0]!.valueStreams[0]!.solutions[0]!.items.map((i) => i.title)).toEqual([
      "groß",
      "klein",
    ]);
  });

  it("eine Solution mit einer Zeile bekommt keine Überschrift, mit zwei schon", () => {
    const g = group([
      c("allein", 10, "epic", "VS", "Einzel"),
      c("A", 40, "epic", "VS", "Paar"),
      c("B", 40, "epic", "VS", "Paar"),
    ]);
    const byName = Object.fromEntries(
      g[0]!.valueStreams[0]!.solutions.map((s) => [s.name, s.heading]),
    );
    expect(byName["Einzel"]).toBe(false);
    expect(byName["Paar"]).toBe(true);
  });

  it("Einzelgänger bleiben an ihrer Position in der Betrags-Sortierung", () => {
    // Sonst rutschten sie ans Ende und die Geld-Reihenfolge stimmte nicht mehr.
    const g = group([
      c("dick", 900, "epic", "VS", "Solo"),
      c("A", 10, "epic", "VS", "Paar"),
      c("B", 10, "epic", "VS", "Paar"),
    ]);
    expect(g[0]!.valueStreams[0]!.solutions.map((s) => s.name)).toEqual(["Solo", "Paar"]);
  });

  it("fehlende Zuordnungen bekommen einen benannten Platz", () => {
    const g = group([c("X", 10, "rtb", null, null)]);
    const vs = g[0]!.valueStreams[0]!;
    expect(vs.name).toBe(NO_VALUE_STREAM);
    expect(vs.solutions[0]!.name).toBe(NO_SOLUTION);
  });

  it("eine leere Liste ergibt keine Gruppen", () => {
    expect(group([])).toEqual([]);
  });
});

describe("groupItems", () => {
  const g = group([
    c("A", 100, "epic", "Logistik", "Kern"),
    c("B", 200, "epic", "Logistik", "Kern"),
    c("C", 300, "epic", "Produktion", "Werk"),
  ]);

  it("sammelt die Zeilen jeder Ebene ein", () => {
    const grow = g[0]!;
    const vs = (name: string) => grow.valueStreams.find((v) => v.name === name)!;
    expect(groupItems(grow)).toHaveLength(3);
    expect(groupItems(vs("Logistik"))).toHaveLength(2);
    expect(groupItems(vs("Produktion"))).toHaveLength(1);
    expect(groupItems(vs("Logistik").solutions[0]!)).toHaveLength(2);
  });

  it("die Σ über die eingesammelten Zeilen ist das `total` der Gruppe", () => {
    // Genau darauf beruhen die Spalten-Zwischensummen der Tabelle.
    for (const vs of g[0]!.valueStreams) {
      expect(groupItems(vs).reduce((s, i) => s + i.ask, 0)).toBe(vs.total);
    }
  });
});

describe("worksheetSections", () => {
  const sections = worksheetSections(
    group([
      c("Betrieb Logistik", 50, "rtb", "Logistik", null),
      c("Betrieb Produktion", 80, "rtb", "Produktion", null),
      c("Epic P1", 300, "epic", "Produktion", "Werk"),
      c("Epic P2", 200, "epic", "Produktion", "Werk"),
      c("Epic L1", 100, "epic", "Logistik", "Kern"),
    ]),
  );

  it("Run wird EIN Abschnitt über alle Wertströme", () => {
    const run = sections.filter((s) => s.kind === "run");
    expect(run).toHaveLength(1);
    expect(run[0]!.items).toHaveLength(2);
    expect(run[0]!.total).toBe(130);
  });

  it("je Grow-Wertstrom entsteht genau ein Abschnitt", () => {
    expect(sections.filter((s) => s.kind === "grow").map((s) => s.label)).toEqual([
      "Produktion",
      "Logistik",
    ]);
  });

  it("Run steht vorn, danach die Wertströme nach Betrag absteigend", () => {
    expect(sections.map((s) => s.label)).toEqual(["Run the Business", "Produktion", "Logistik"]);
  });

  it("jeder Abschnitt trägt seine Zeilen und seine Summe", () => {
    const prod = sections.find((s) => s.label === "Produktion")!;
    expect(prod.items.map((i) => i.title)).toEqual(["Epic P1", "Epic P2"]);
    expect(prod.total).toBe(500);
    expect(groupItems(prod).reduce((s, i) => s + i.ask, 0)).toBe(prod.total);
  });

  it("die Solution-Regel gilt im Abschnitt weiter", () => {
    const prod = sections.find((s) => s.label === "Produktion")!;
    expect(prod.solutions[0]!.heading).toBe(true); // zwei Zeilen
    const log = sections.find((s) => s.label === "Logistik")!;
    expect(log.solutions[0]!.heading).toBe(false); // eine Zeile
  });

  it("ohne Run gibt es keinen Run-Abschnitt", () => {
    const only = worksheetSections(group([c("X", 10, "epic", "VS", "S")]));
    expect(only.map((s) => s.kind)).toEqual(["grow"]);
  });
});

describe("worksheetSections — Zwischenüberschriften", () => {
  it("gleichnamige Solutions verschmelzen im Run-Abschnitt", () => {
    // Sonst trüge Run je Wertstrom eine eigene Überschrift „ohne Solution".
    const secs = worksheetSections(
      group([
        c("Betrieb L", 50, "rtb", "Logistik", null),
        c("Betrieb P", 80, "rtb", "Produktion", null),
        c("Betrieb V", 30, "rtb", "Verwaltung", null),
      ]),
    );
    const run = secs[0]!;
    expect(run.solutions).toHaveLength(1);
    expect(run.solutions[0]!.items).toHaveLength(3);
    expect(run.solutions[0]!.total).toBe(160);
  });

  it("eine einzelne namenlose Gruppe bekommt keine Überschrift", () => {
    // Der Abschnitt selbst ist dann schon die Überschrift.
    const secs = worksheetSections(
      group([
        c("Betrieb L", 50, "rtb", "Logistik", null),
        c("Betrieb P", 80, "rtb", "Produktion", null),
      ]),
    );
    expect(secs[0]!.solutions[0]!.heading).toBe(false);
  });

  it("eine benannte Gruppe behält ihre Überschrift, auch als einzige", () => {
    const secs = worksheetSections(
      group([c("A", 50, "epic", "Produktion", "Werk"), c("B", 80, "epic", "Produktion", "Werk")]),
    );
    expect(secs[0]!.solutions[0]!.heading).toBe(true);
  });
});
