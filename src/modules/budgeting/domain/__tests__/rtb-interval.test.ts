import { describe, it, expect } from "vitest";
import {
  rtbIntervalOrDefault,
  rtbAnnualAmount,
  rtbCycleAmount,
  sumRtbAnnual,
  sumRtbCycle,
  rtbAskByValueStream,
  RTB_INTERVALS,
  RTB_INTERVAL_KEYS,
  type RtbAmountLike,
} from "@/modules/budgeting/domain/rtb-interval";
import { catalogTranslate } from "@/test/helpers/catalog";

const item = (over: Partial<RtbAmountLike> = {}): RtbAmountLike => ({
  plannedAmount: 120_000,
  interval: "half_yearly",
  active: true,
  ...over,
});

describe("rtbIntervalOrDefault", () => {
  it("nimmt jeden gültigen Wert", () => {
    for (const i of RTB_INTERVALS) expect(rtbIntervalOrDefault(i)).toBe(i);
  });

  it("fällt auf `half_yearly` zurück — die Bedeutung der Bestandszeilen", () => {
    expect(rtbIntervalOrDefault(null)).toBe("half_yearly");
    expect(rtbIntervalOrDefault(undefined)).toBe("half_yearly");
    expect(rtbIntervalOrDefault("quarterly")).toBe("half_yearly");
  });
});

describe("rtbAnnualAmount", () => {
  it("rechnet jede Periode aufs Jahr hoch", () => {
    expect(rtbAnnualAmount(20_000, "monthly")).toBe(240_000);
    expect(rtbAnnualAmount(120_000, "half_yearly")).toBe(240_000);
    expect(rtbAnnualAmount(240_000, "yearly")).toBe(240_000);
  });

  it("unbrauchbare Beträge ergeben 0 statt NaN", () => {
    expect(rtbAnnualAmount(Number.NaN, "yearly")).toBe(0);
  });
});

describe("rtbCycleAmount — der Ask einer Halbjahres-Kachel", () => {
  it("die Bestands-Invariante: `half_yearly` fragt exakt den gepflegten Betrag an", () => {
    // Genau daran hängt, dass sich beim Umbau kein einziger existierender Ask
    // verschiebt — jede Bestandszeile steht auf `half_yearly`.
    expect(rtbCycleAmount(120_000, "half_yearly")).toBe(120_000);
    expect(rtbCycleAmount(15_000, null)).toBe(15_000);
  });

  it("jährlich wird halbiert, monatlich versechsfacht", () => {
    expect(rtbCycleAmount(60_000, "yearly")).toBe(30_000);
    expect(rtbCycleAmount(20_000, "monthly")).toBe(120_000);
  });

  it("zwei Kacheln ergeben zusammen das Jahr", () => {
    for (const i of RTB_INTERVALS) {
      expect(rtbCycleAmount(7_500, i) * 2).toBeCloseTo(rtbAnnualAmount(7_500, i));
    }
  });
});

describe("Summen", () => {
  const items = [
    item({ plannedAmount: 120_000, interval: "half_yearly" }), // 240.000 p. a.
    item({ plannedAmount: 60_000, interval: "yearly" }), //       60.000 p. a.
    item({ plannedAmount: 20_000, interval: "monthly" }), //     240.000 p. a.
  ];

  it("addieren über gemischte Perioden", () => {
    expect(sumRtbAnnual(items)).toBe(540_000);
    expect(sumRtbCycle(items)).toBe(270_000);
  });

  it("zählen nur aktive Positionen", () => {
    const withInactive = [
      ...items,
      item({ plannedAmount: 999_000, interval: "yearly", active: false }),
    ];
    expect(sumRtbAnnual(withInactive)).toBe(540_000);
  });

  it("eine leere Liste ergibt 0", () => {
    expect(sumRtbAnnual([])).toBe(0);
    expect(sumRtbCycle([])).toBe(0);
  });
});

describe("rtbAskByValueStream — eine Zeile je Wertstrom", () => {
  const item = (valueStreamId: string, plannedAmount: number, interval: string, active = true) => ({
    valueStreamId,
    plannedAmount,
    interval,
    active,
  });

  it("summiert gemischte Perioden auf den Kachel-Ask", () => {
    // 1.000 monatlich = 12.000 p. a. = 6.000 je Kachel;
    // 4.000 je Halbjahr bleibt 4.000; 2.000 jährlich = 1.000 je Kachel.
    const ask = rtbAskByValueStream([
      item("vs1", 1_000, "monthly"),
      item("vs1", 4_000, "half_yearly"),
      item("vs1", 2_000, "yearly"),
    ]);

    expect(ask.get("vs1")).toBe(11_000);
  });

  it("hält die Wertströme auseinander", () => {
    const ask = rtbAskByValueStream([
      item("vs1", 4_000, "half_yearly"),
      item("vs2", 1_500, "half_yearly"),
    ]);

    expect([...ask.entries()].sort()).toEqual([
      ["vs1", 4_000],
      ["vs2", 1_500],
    ]);
  });

  it("lässt einen Wertstrom ohne aktive Position ganz weg", () => {
    // Keine 0-Zeile: ein Antrag über nichts ist kein fehlender Antrag, sondern
    // keiner. Die Materialisierung überspringt solche Wertströme deshalb.
    const ask = rtbAskByValueStream([item("vs1", 4_000, "half_yearly", false)]);

    expect(ask.has("vs1")).toBe(false);
    expect(ask.size).toBe(0);
  });

  it("zählt nur die aktiven Positionen eines Wertstroms", () => {
    const ask = rtbAskByValueStream([
      item("vs1", 4_000, "half_yearly"),
      item("vs1", 9_999, "half_yearly", false),
    ]);

    expect(ask.get("vs1")).toBe(4_000);
  });
});

/**
 * **Drei Perioden, drei Wörter — und das ist keine Kosmetik.**
 *
 * `RTB_INTERVAL_KEYS.half_yearly` zeigte auf denselben Katalog-Eintrag wie
 * `yearly`. Die Auswahl las sich „monatlich · jährlich · jährlich", und die
 * erste der beiden gleichen war `half_yearly`: ein Betrag je Halbjahr, als
 * Jahresbetrag beschriftet. Die Rechnung war die ganze Zeit richtig — nur
 * wusste niemand, welche Zeile er gerade wählt.
 *
 * `catalogTranslate` wirft bei einem fehlenden Schlüssel; zusammen mit der
 * Eindeutigkeit prüft das beides auf einmal.
 */
describe("RTB_INTERVAL_KEYS", () => {
  for (const locale of ["de", "en"] as const) {
    it(`gibt jeder Periode ein eigenes Wort (${locale})`, () => {
      const t = catalogTranslate(locale);
      const woerter = RTB_INTERVALS.map((i) => t(RTB_INTERVAL_KEYS[i]));

      expect(new Set(woerter).size, woerter.join(" · ")).toBe(RTB_INTERVALS.length);
    });
  }
});
