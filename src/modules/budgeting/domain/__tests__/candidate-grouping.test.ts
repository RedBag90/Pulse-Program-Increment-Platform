import { describe, it, expect } from "vitest";
import {
  groupCandidates,
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
