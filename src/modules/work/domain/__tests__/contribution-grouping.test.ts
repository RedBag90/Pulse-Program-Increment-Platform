import { describe, it, expect } from "vitest";
import {
  groupContributions,
  sumUnits,
  type GroupableContribution,
} from "@/modules/work/domain/contribution-grouping";
import { benefitPerformance } from "@/modules/core/goals/domain/epic-contribution";

const zeile = (o: Partial<GroupableContribution> & { epicId: string }): GroupableContribution => ({
  valueStreamId: "vs1",
  valueStreamName: "Produktion",
  art: { id: "a1", name: "Plant Efficiency" },
  solution: { id: "s1", name: "Produktion Betrieb" },
  recurring: [],
  oneTime: [],
  benefitAssessable: false,
  ...o,
});

describe("sumUnits", () => {
  it("addiert gleiche Einheiten und lässt verschiedene getrennt", () => {
    const out = sumUnits([
      [
        { unit: "€", planned: 100, realized: 10 },
        { unit: "t CO₂", planned: 5, realized: 1 },
      ],
      [{ unit: "€", planned: 200, realized: 20 }],
    ]);
    expect(out).toEqual([
      { unit: "€", planned: 300, realized: 30 },
      { unit: "t CO₂", planned: 5, realized: 1 },
    ]);
  });

  it("fasst die einheitenlose Zeile zu einer zusammen", () => {
    const out = sumUnits([
      [{ unit: null, planned: 1, realized: 0 }],
      [{ unit: null, planned: 2, realized: 0 }],
    ]);
    expect(out).toEqual([{ unit: null, planned: 3, realized: 0 }]);
  });

  it("lässt die Eingabe unberührt", () => {
    const eingabe = [{ unit: "€", planned: 100, realized: 0 }];
    sumUnits([eingabe, eingabe]);
    expect(eingabe[0]!.planned).toBe(100);
  });
});

describe("groupContributions", () => {
  const zeilen = [
    zeile({
      epicId: "e1",
      recurring: [{ unit: "€", planned: 100, realized: 90 }],
      oneTime: [{ unit: "t CO₂", planned: 4, realized: 4 }],
    }),
    zeile({
      epicId: "e2",
      art: { id: "a2", name: "Materials & Energy" },
      recurring: [{ unit: "€", planned: 200, realized: 100 }],
    }),
    zeile({
      epicId: "e3",
      valueStreamId: "vs2",
      valueStreamName: "Logistik",
      art: null,
      solution: null,
      oneTime: [{ unit: "€", planned: 50, realized: 0 }],
    }),
  ];

  it("summiert je Gruppe und je Einheit — Σ Gruppen = Σ Epics", () => {
    const g = groupContributions(zeilen, "valueStream");
    expect(g.map((x) => x.label)).toEqual(["Produktion", "Logistik"]);
    expect(g[0]!.epicCount).toBe(2);
    expect(g[0]!.recurring).toEqual([{ unit: "€", planned: 300, realized: 190 }]);
    expect(g[0]!.oneTime).toEqual([{ unit: "t CO₂", planned: 4, realized: 4 }]);
    expect(g[1]!.oneTime).toEqual([{ unit: "€", planned: 50, realized: 0 }]);

    // Die Probe, auf die es ankommt: über alle Gruppen dasselbe wie über alle
    // Epics — je Einheit.
    const summe = sumUnits(g.flatMap((x) => [x.recurring, x.oneTime]));
    const roh = sumUnits(zeilen.flatMap((r) => [r.recurring, r.oneTime]));
    expect(summe).toEqual(roh);
  });

  it("gibt jeder Achse ihre eigene Einteilung", () => {
    expect(groupContributions(zeilen, "art").map((x) => x.label)).toEqual([
      "Plant Efficiency",
      "Materials & Energy",
      "Ohne ART",
    ]);
    expect(groupContributions(zeilen, "solution").map((x) => x.label)).toEqual([
      "Produktion Betrieb",
      "Ohne Solution",
    ]);
  });

  /** Ohne eigene Gruppe verschwänden sie still in einer fremden Summe. */
  it("stellt Zeilen ohne Knoten in eine eigene Gruppe", () => {
    const ohne = groupContributions([zeile({ epicId: "x", valueStreamId: null })], "valueStream");
    expect(ohne).toHaveLength(1);
    expect(ohne[0]!.label).toBe("Ohne Wertstrom");
    expect(ohne[0]!.key).toBe("");
  });

  describe("Ist vs. Plan", () => {
    /**
     * Zwei sehr verschiedene Zeilen: 1000 € Plan mit 500 € Ist (−50 %) und
     * 10 € Plan mit 10 € Ist (±0). Aus den **Beträgen** gerechnet sind das
     * −49,5 %; der Mittelwert der beiden Prozentwerte wäre −25 % — eine Zahl,
     * die dem kleinen Epic dasselbe Gewicht gäbe wie dem hundertfachen.
     */
    const gross = zeile({
      epicId: "gross",
      benefitAssessable: true,
      recurring: [{ unit: "€", planned: 1000, realized: 500 }],
    });
    const klein = zeile({
      epicId: "klein",
      benefitAssessable: true,
      recurring: [{ unit: "€", planned: 10, realized: 10 }],
    });

    it("rechnet aus den summierten Beträgen, nicht aus den Prozentwerten", () => {
      const g = groupContributions([gross, klein], "valueStream")[0]!;
      expect(g.assessable).toEqual({ count: 2, planned: 1010, realized: 510 });
      const delta = benefitPerformance(g.assessable)!.delta;
      expect(delta).toBeCloseTo(-0.495, 3);
      expect(delta).not.toBeCloseTo(-0.25, 2);
    });

    it("zählt nur die bewertbaren Zeilen — und sagt, wie viele das waren", () => {
      const g = groupContributions([gross, zeile({ epicId: "offen" })], "valueStream")[0]!;
      expect(g.epicCount).toBe(2);
      expect(g.assessable.count).toBe(1);
      expect(g.assessable.planned).toBe(1000);
    });

    it("lässt eine Gruppe ohne bewertbare Zeile ohne Grundlage", () => {
      const g = groupContributions([zeile({ epicId: "e" })], "valueStream")[0]!;
      expect(g.assessable).toEqual({ count: 0, planned: 0, realized: 0 });
    });
  });
});
