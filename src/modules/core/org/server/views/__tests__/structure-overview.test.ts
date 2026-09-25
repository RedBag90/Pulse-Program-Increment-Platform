import { describe, it, expect } from "vitest";
import {
  buildStructureOverview,
  filterStructureOverview,
  flattenSolutions,
  groupByStatus,
  rollUpStructureMoney,
  type StructureMoney,
} from "@/modules/core/org/server/views/structure-overview";
import type { StructureTree } from "@/modules/core/org/server/services/structure";

const sol = (over: {
  id: string;
  name: string;
  horizon?: string;
  investmentMode?: string | null;
  artId?: string;
}) => ({
  id: over.id,
  name: over.name,
  horizon: over.horizon ?? "h1",
  investmentMode: over.investmentMode ?? null,
  artId: over.artId ?? "art1",
  productManagerId: null,
});

const art = (over: {
  id: string;
  name: string;
  rteId?: string | null;
  /** Der Alt-Verweis `ProgramIncrement.artId` — im Bestand überall 0. */
  pis?: number;
  /** Die PIs der Kadenz, der das ART folgt. `undefined` = keine Kadenz. */
  cadencePis?: number;
}) => ({
  id: over.id,
  name: over.name,
  description: null,
  rteId: over.rteId === undefined ? "u-rte" : over.rteId,
  technicalLeadId: null,
  _count: { pis: over.pis ?? 0 },
  timeline: over.cadencePis == null ? null : { _count: { programIncrements: over.cadencePis } },
});

const vs = (over: {
  id: string;
  name: string;
  vmoId?: string | null;
  financeApproverId?: string | null;
  arts?: ReturnType<typeof art>[];
  solutions?: ReturnType<typeof sol>[];
}) => ({
  id: over.id,
  name: over.name,
  description: null,
  vmoId: over.vmoId === undefined ? "u-vmo" : over.vmoId,
  financeApproverId: over.financeApproverId === undefined ? "u-fin" : over.financeApproverId,
  businessOwnerId: null,
  architectLeadId: null,
  arts: over.arts ?? [],
  solutions: over.solutions ?? [],
});

const tree = (...streams: ReturnType<typeof vs>[]) => streams as unknown as StructureTree;

/** Der Bestand in klein: zwei ARTs, davon eines ohne Solution. */
const bestand = () =>
  tree(
    vs({
      id: "vs1",
      name: "Produktion",
      arts: [
        art({ id: "a-leer", name: "Materials & Energy", cadencePis: 4 }),
        art({ id: "a-oee", name: "Plant Efficiency (OEE)", cadencePis: 12 }),
      ],
      solutions: [
        sol({
          id: "s-betrieb",
          name: "Produktion Betrieb",
          investmentMode: "investing",
          artId: "a-oee",
        }),
        sol({ id: "s-programm", name: "Produktion Programm", horizon: "h2", artId: "a-oee" }),
      ],
    }),
  );

describe("buildStructureOverview", () => {
  it("verschachtelt Wertstrom → ART → Solution", () => {
    const o = buildStructureOverview(bestand());
    expect(o.counts).toEqual({ valueStreams: 1, arts: 2, solutions: 2 });
    expect(o.valueStreams[0]!.arts.map((a) => [a.name, a.solutions.map((s) => s.name)])).toEqual([
      ["Materials & Energy", []],
      ["Plant Efficiency (OEE)", ["Produktion Betrieb", "Produktion Programm"]],
    ]);
  });

  /**
   * **Der Befund, der die Karte begründet.** Im Baum sah ein ART ohne Kinder
   * genauso aus wie ein eingeklapptes — die Lücke war unsichtbar. Sie muss im
   * Modell als leere Liste ankommen, nicht als fehlender Knoten, sonst kann die
   * Fläche sie nicht benennen.
   */
  it("behält ein ART ohne Solution mit leerer Liste", () => {
    const o = buildStructureOverview(bestand());
    const leer = o.valueStreams[0]!.arts.find((a) => a.id === "a-leer")!;
    expect(leer.solutions).toEqual([]);
  });

  /**
   * `artId` ist Pflicht — aber ein **weich gelöschtes** ART fällt aus `vs.arts`
   * heraus. Seine Solutions zeigten dann auf einen Knoten, den niemand rendert,
   * und wären aus der Fläche verschwunden. Gefragt wird deshalb „ist ihr ART
   * hier zu sehen", nicht „hat sie eins".
   */
  it("hängt eine Solution an den Wertstrom, wenn ihr ART nicht zu sehen ist", () => {
    const o = buildStructureOverview(
      tree(
        vs({
          id: "vs1",
          name: "Produktion",
          arts: [art({ id: "a1", name: "OEE", cadencePis: 2 })],
          solutions: [
            sol({ id: "s1", name: "Betrieb", artId: "a1" }),
            sol({ id: "s2", name: "Pilot", artId: "a-geloescht" }),
          ],
        }),
      ),
    );
    expect(o.valueStreams[0]!.arts[0]!.solutions.map((s) => s.name)).toEqual(["Betrieb"]);
    expect(o.valueStreams[0]!.looseSolutions.map((s) => s.name)).toEqual(["Pilot"]);
    expect(o.counts.solutions).toBe(2);
  });

  /**
   * **„0 PIs" stand an jedem ART der Datenbank.** Gezählt wurde `art.pis` — der
   * direkte Verweis aus der Zeit vor den Timelines; im Bestand trägt ihn kein
   * einziges der 17 ARTs. Die Zahl kommt aus der Kadenz, der Alt-Verweis bleibt
   * Rückfall, und ohne beides steht keine Null da, sondern die Lücke.
   */
  it("zählt die PIs der Kadenz, nicht den Alt-Verweis am ART", () => {
    const o = buildStructureOverview(
      tree(
        vs({
          id: "vs1",
          name: "Logistik",
          arts: [
            art({ id: "a1", name: "Mit Kadenz", cadencePis: 12 }),
            art({ id: "a2", name: "Alt-Daten", pis: 3 }),
            art({ id: "a3", name: "Ohne Takt" }),
          ],
        }),
      ),
    );
    expect(o.valueStreams[0]!.arts.map((a) => [a.piCount, a.cadenceLabel])).toEqual([
      [12, "12 PIs"],
      [3, "3 PIs"],
      [0, "Keine Kadenz"],
    ]);
  });

  /**
   * H1 zerfällt wirtschaftlich in *Investing* und *Extracting*. Der frühere Baum
   * führte eine eigene Etikettenliste, die den Modus nicht kannte, und nannte
   * beide „H1 · Investing".
   */
  it("unterscheidet Investing und Extracting", () => {
    const o = buildStructureOverview(
      tree(
        vs({
          id: "vs1",
          name: "Produktion",
          arts: [art({ id: "a1", name: "OEE", cadencePis: 1 })],
          solutions: [
            sol({ id: "s1", name: "Ausbau", investmentMode: "investing", artId: "a1" }),
            sol({ id: "s2", name: "Ernte", investmentMode: "extracting", artId: "a1" }),
            sol({ id: "s3", name: "Neu", horizon: "h2", artId: "a1" }),
          ],
        }),
      ),
    );
    expect(o.valueStreams[0]!.arts[0]!.solutions.map((s) => [s.statusLabelKey, s.status])).toEqual([
      ["org.horizon.h1", "investing"],
      ["org.horizon.h1Extracting", "extracting"],
      ["org.horizon.h2", "emerging"],
    ]);
  });

  it("meldet fehlende Verantwortliche als Lücken", () => {
    const o = buildStructureOverview(
      tree(
        vs({
          id: "vs1",
          name: "Ohne",
          vmoId: null,
          financeApproverId: null,
          arts: [art({ id: "a1", name: "Ohne RTE", rteId: null, cadencePis: 1 })],
        }),
      ),
    );
    expect(o.valueStreams[0]!.gaps).toEqual([
      "Kein:e Portfolio Manager",
      "Kein:e Finance-Approver:in",
    ]);
    expect(o.valueStreams[0]!.arts[0]!.gaps).toEqual(["Kein:e RTE"]);
  });

  /** Ohne Modul bleibt die Angabe `null` — das heisst „nicht gemessen", nicht 0 €. */
  it("trägt ohne Geld-Zuordnung an keinem Knoten einen Betrag", () => {
    const o = buildStructureOverview(bestand());
    expect(o.valueStreams[0]!.money).toBeNull();
    expect(o.valueStreams[0]!.arts.every((a) => a.money === null)).toBe(true);
    expect(o.valueStreams[0]!.arts[1]!.solutions.every((s) => s.money === null)).toBe(true);
  });
});

describe("rollUpStructureMoney", () => {
  const geld: Record<string, StructureMoney> = {
    "s-betrieb": { grow: 1_660_000, run: 175_000, epicCount: 30 },
    "s-programm": { grow: 1_520_000, run: 0, epicCount: 30 },
  };

  it("summiert je ART und je Wertstrom auf die Summe der Blätter", () => {
    const o = rollUpStructureMoney(buildStructureOverview(bestand()), geld);
    const stream = o.valueStreams[0]!;
    const oee = stream.arts.find((a) => a.id === "a-oee")!;

    expect(oee.money).toEqual({ grow: 3_180_000, run: 175_000, epicCount: 60 });
    expect(stream.money).toEqual({ grow: 3_180_000, run: 175_000, epicCount: 60 });
  });

  /** Ein ART ohne Solution hat keine Summe — nicht die Summe null. */
  it("lässt einen Knoten ohne gemessene Kinder auf null", () => {
    const o = rollUpStructureMoney(buildStructureOverview(bestand()), geld);
    expect(o.valueStreams[0]!.arts.find((a) => a.id === "a-leer")!.money).toBeNull();
  });

  it("lässt eine Solution ohne Eintrag in der Zuordnung auf null", () => {
    const o = rollUpStructureMoney(buildStructureOverview(bestand()), {
      "s-betrieb": geld["s-betrieb"]!,
    });
    const oee = o.valueStreams[0]!.arts.find((a) => a.id === "a-oee")!;
    expect(oee.solutions.map((s) => s.money)).toEqual([geld["s-betrieb"], null]);
    // Die Summe zählt nur, was gemessen ist.
    expect(oee.money).toEqual(geld["s-betrieb"]);
  });
});

describe("groupByStatus", () => {
  const o = rollUpStructureMoney(
    buildStructureOverview(
      tree(
        vs({
          id: "vs1",
          name: "Produktion",
          arts: [art({ id: "a1", name: "OEE", cadencePis: 1 })],
          solutions: [
            sol({ id: "s1", name: "Ernte", investmentMode: "extracting", artId: "a1" }),
            sol({ id: "s2", name: "Neu", horizon: "h2", artId: "a1" }),
            sol({ id: "s3", name: "Ausbau", investmentMode: "investing", artId: "a1" }),
          ],
        }),
      ),
    ),
    {},
  );

  /**
   * Gruppiert wird nach dem **Stand**, nicht nach dem Horizont: die frühere
   * flache Liste sortierte nach `horizon` und warf Investing und Extracting
   * deshalb in einen Topf.
   */
  it("folgt der Lebenszyklus-Leiter und spaltet H1 auf", () => {
    expect(groupByStatus(flattenSolutions(o)).map((g) => [g.labelKey, g.rows.length])).toEqual([
      ["org.horizon.h2", 1],
      ["org.horizon.h1", 1],
      ["org.horizon.h1Extracting", 1],
    ]);
  });

  it("lässt leere Gruppen weg", () => {
    expect(groupByStatus(flattenSolutions(o)).some((g) => g.status === "decommissioning")).toBe(
      false,
    );
  });

  it("nennt zu jeder Solution ihren Ort", () => {
    expect(flattenSolutions(o).map((r) => [r.solution.name, r.valueStreamName, r.artName])).toEqual(
      [
        ["Ernte", "Produktion", "OEE"],
        ["Neu", "Produktion", "OEE"],
        ["Ausbau", "Produktion", "OEE"],
      ],
    );
  });
});

describe("filterStructureOverview", () => {
  const gross = () =>
    buildStructureOverview(
      tree(
        vs({
          id: "vs1",
          name: "Logistik",
          arts: [art({ id: "a1", name: "Transport", cadencePis: 12 })],
          solutions: [
            sol({ id: "s1", name: "Logistik Betrieb", artId: "a1" }),
            sol({ id: "s2", name: "Logistik Programm", horizon: "h2", artId: "a1" }),
          ],
        }),
        vs({
          id: "vs2",
          name: "Produktion",
          arts: [art({ id: "a2", name: "OEE", cadencePis: 12 })],
          solutions: [sol({ id: "s3", name: "Produktion Betrieb", artId: "a2" })],
        }),
      ),
    );

  it("behält einen getroffenen Wertstrom vollständig", () => {
    const o = filterStructureOverview(gross(), "logistik");
    expect(o.valueStreams.map((v) => v.name)).toEqual(["Logistik"]);
    expect(o.valueStreams[0]!.arts[0]!.solutions).toHaveLength(2);
  });

  it("behält bei einem Solution-Treffer ihren ART, aber nicht die Geschwister", () => {
    const o = filterStructureOverview(gross(), "Logistik Programm");
    expect(o.valueStreams).toHaveLength(1);
    expect(o.valueStreams[0]!.arts[0]!.name).toBe("Transport");
    expect(o.valueStreams[0]!.arts[0]!.solutions.map((s) => s.name)).toEqual(["Logistik Programm"]);
  });

  it("wirft einen Wertstrom ohne verbliebenen Inhalt heraus", () => {
    const o = filterStructureOverview(gross(), "OEE");
    expect(o.valueStreams.map((v) => v.name)).toEqual(["Produktion"]);
    expect(o.counts).toEqual({ valueStreams: 1, arts: 1, solutions: 1 });
  });

  /**
   * Eine Suche, die den Wert eines Wertstroms schrumpfen liesse, wäre eine
   * Rechnung, die niemand angefordert hat: die Summe beschreibt den Knoten,
   * nicht die Auswahl.
   */
  it("rechnet die Summen nicht neu", () => {
    const voll = rollUpStructureMoney(gross(), {
      s1: { grow: 100, run: 10, epicCount: 1 },
      s2: { grow: 200, run: 0, epicCount: 2 },
    });
    const gefiltert = filterStructureOverview(voll, "Logistik Programm");
    expect(gefiltert.valueStreams[0]!.money).toEqual({ grow: 300, run: 10, epicCount: 3 });
  });

  it("gibt bei leerer Suche dasselbe Modell zurück", () => {
    const o = gross();
    expect(filterStructureOverview(o, "  ")).toBe(o);
  });
});
