import { describe, it, expect } from "vitest";
import {
  kpiOutcome,
  outcomeAttainment,
  valueAtFullTarget,
  decisiveValue,
  parsePlanSnapshot,
  type KpiOutcomeInput,
} from "@/modules/core/kpi/domain/kpi-outcome";

/**
 * Der Fall, der dieses Modul veranlasst hat: ein Epic ist auf L4.2 abgenommen,
 * die Erfolgs-KPI steht bei 70 % und wird nicht weiter steigen. Plan und Ist
 * müssen auseinandergehen — und die Differenz muss sich sauber in einen
 * Mengen- und einen Wertanteil zerlegen lassen.
 */
const L42 = new Date("2026-06-30T00:00:00.000Z");

const base = (over: Partial<KpiOutcomeInput> = {}): KpiOutcomeInput => ({
  // Durchlaufzeit 10 → 5 Tage, 1.000 € je gespartem Tag, einmalig.
  baseline: 10,
  target: 5,
  valuePerUnit: 1_000,
  benefitKind: "one_time",
  recurringInterval: "yearly",
  measurements: [{ date: "2026-06-01", value: 6.5 }], // 70 % der Spanne
  planSnapshot: null,
  frozenAt: null,
  ...over,
});

describe("outcomeAttainment", () => {
  it("rechnet in beide Richtungen — auch wenn kleiner besser ist", () => {
    expect(outcomeAttainment({ baseline: 10, target: 5 }, 6.5)).toBeCloseTo(0.7);
    expect(outcomeAttainment({ baseline: 40, target: 80 }, 68)).toBeCloseTo(0.7);
  });

  it("deckelt nicht bei 100 % — Übererfüllung zählt voll", () => {
    expect(outcomeAttainment({ baseline: 10, target: 5 }, 3.5)).toBeCloseTo(1.3);
  });

  it("schneidet nach unten ab: eine Verschlechterung ist kein negativer Nutzen", () => {
    expect(outcomeAttainment({ baseline: 10, target: 5 }, 12)).toBe(0);
  });

  it("ohne Messung oder ohne Spanne: 0", () => {
    expect(outcomeAttainment({ baseline: 10, target: 5 }, null)).toBe(0);
    expect(outcomeAttainment({ baseline: 5, target: 5 }, 5)).toBe(0);
  });
});

describe("valueAtFullTarget", () => {
  it("|Ziel − Baseline| × Faktor", () => {
    expect(valueAtFullTarget({ baseline: 10, target: 5, valuePerUnit: 1_000 })).toBe(5_000);
  });

  it("rechnet monatlich Wiederkehrendes aufs Jahr hoch", () => {
    const t = { baseline: 10, target: 5, valuePerUnit: 1_000 };
    expect(
      valueAtFullTarget({ ...t, benefitKind: "recurring", recurringInterval: "monthly" }),
    ).toBe(60_000);
    expect(valueAtFullTarget({ ...t, benefitKind: "recurring", recurringInterval: "yearly" })).toBe(
      5_000,
    );
    expect(valueAtFullTarget({ ...t, benefitKind: "one_time" })).toBe(5_000);
  });

  it("fehlende Größen ⇒ 0", () => {
    expect(valueAtFullTarget({ baseline: null, target: 5, valuePerUnit: 1_000 })).toBe(0);
    expect(valueAtFullTarget({ baseline: 10, target: 5, valuePerUnit: null })).toBe(0);
  });
});

describe("decisiveValue — die Menge friert mit L4.2", () => {
  const measurements = [
    { date: "2026-06-01", value: 6.5 }, // vor der Abnahme
    { date: "2026-09-01", value: 5.0 }, // danach — darf nicht mehr zählen
  ];

  it("ohne Einfrieren gilt die letzte Messung", () => {
    expect(decisiveValue(base({ measurements, frozenAt: null }))).toBe(5.0);
  });

  it("mit Einfrieren gilt der Stand zum Stichtag", () => {
    expect(decisiveValue(base({ measurements, frozenAt: L42 }))).toBe(6.5);
  });

  it("vor der ersten Messung gilt die Baseline — also 0 %", () => {
    const early = base({ measurements, frozenAt: new Date("2026-01-01") });
    expect(decisiveValue(early)).toBe(10);
    expect(kpiOutcome(early).attainment).toBe(0);
  });
});

describe("kpiOutcome — der Fall aus der Praxis", () => {
  it("70 % bei L4.2: der Rest verfällt", () => {
    const o = kpiOutcome(base({ frozenAt: L42 }));
    expect(o.attainment).toBeCloseTo(0.7);
    expect(o.planned).toBe(5_000);
    expect(o.realized).toBeCloseTo(3_500);
    expect(o.frozen).toBe(true);
  });

  it("130 %: die Übererfüllung zählt voll", () => {
    const o = kpiOutcome(
      base({ measurements: [{ date: "2026-06-01", value: 3.5 }], frozenAt: L42 }),
    );
    expect(o.attainment).toBeCloseTo(1.3);
    expect(o.realized).toBeCloseTo(6_500);
    expect(o.quantityDelta).toBeCloseTo(1_500);
  });

  it("ohne Plan-Schnappschuss fallen Plan und Ist bei 100 % zusammen", () => {
    const o = kpiOutcome(base({ measurements: [{ date: "2026-06-01", value: 5 }] }));
    expect(o.planned).toBe(o.realized);
    expect(o.quantityDelta).toBe(0);
    expect(o.valueDelta).toBe(0);
  });
});

describe("kpiOutcome — die zwei Achsen", () => {
  /** Plan: 1.000 €/Tag. Finance zieht nach L4.2 auf 1.200 € nach. */
  const corrected = base({
    valuePerUnit: 1_200,
    planSnapshot: {
      baseline: 10,
      target: 5,
      valuePerUnit: 1_000,
      benefitKind: "one_time",
      recurringInterval: "yearly",
    },
    frozenAt: L42,
  });

  it("der korrigierte Faktor wirkt rückwirkend auf den Ist-Wert", () => {
    const o = kpiOutcome(corrected);
    expect(o.planned).toBe(5_000); // Plan bleibt beim initialen Faktor
    expect(o.realized).toBeCloseTo(0.7 * 6_000); // 4.200
  });

  it("die Zerlegung erklärt die Differenz vollständig", () => {
    const o = kpiOutcome(corrected);
    expect(o.quantityDelta + o.valueDelta).toBeCloseTo(o.realized - o.planned);
    // Menge: 30 % zu wenig, zum Plan-Faktor bewertet.
    expect(o.quantityDelta).toBeCloseTo(-1_500);
    // Wert: +200 €/Tag auf die tatsächlich gelieferten 3,5 Tage.
    expect(o.valueDelta).toBeCloseTo(700);
  });

  it("die Zerlegung stimmt auch, wenn beide Achsen überliefern", () => {
    const o = kpiOutcome({
      ...corrected,
      measurements: [{ date: "2026-06-01", value: 3.5 }], // 130 %
    });
    expect(o.quantityDelta + o.valueDelta).toBeCloseTo(o.realized - o.planned);
    expect(o.realized).toBeGreaterThan(o.planned);
  });

  it("ein reiner Mengen-Fehlschlag hat keinen Wertanteil", () => {
    const o = kpiOutcome(
      base({
        planSnapshot: {
          baseline: 10,
          target: 5,
          valuePerUnit: 1_000,
          benefitKind: "one_time",
          recurringInterval: "yearly",
        },
        frozenAt: L42,
      }),
    );
    expect(o.valueDelta).toBe(0);
    expect(o.quantityDelta).toBeCloseTo(-1_500);
  });

  it("ein Plan mit anderer Zielspanne bleibt der Bezug", () => {
    // Das Ziel wurde nachträglich von 5 auf 6 aufgeweicht — der Plan misst
    // weiter gegen die ursprünglich versprochene Spanne.
    const o = kpiOutcome(
      base({
        target: 6,
        measurements: [{ date: "2026-06-01", value: 6 }],
        planSnapshot: {
          baseline: 10,
          target: 5,
          valuePerUnit: 1_000,
          benefitKind: "one_time",
          recurringInterval: "yearly",
        },
        frozenAt: L42,
      }),
    );
    expect(o.planned).toBe(5_000);
    expect(o.attainment).toBe(1); // gegen das aufgeweichte Ziel: erfüllt
    expect(o.realized).toBe(4_000); // aber nur 4 von 5 Tagen wert
    expect(o.quantityDelta + o.valueDelta).toBeCloseTo(-1_000);
  });
});

// ---------------------------------------------------------------------------

describe("parsePlanSnapshot", () => {
  it("liest die Namen der Ziel-Verknüpfung mit", () => {
    // Die Verknüpfung speichert ihren Faktor als `conversionFactor` und ihre
    // Nutzenart als `impactKind`; die Mengen-Größen trägt die treibende KPI bei.
    const t = parsePlanSnapshot(
      { conversionFactor: 10_000, impactKind: "recurring", recurringInterval: "monthly" },
      { baseline: 0, target: 12 },
    );
    expect(t).toEqual({
      baseline: 0,
      target: 12,
      valuePerUnit: 10_000,
      benefitKind: "recurring",
      recurringInterval: "monthly",
    });
  });

  it("kein Schnappschuss und unbrauchbare Formen ergeben null", () => {
    expect(parsePlanSnapshot(null)).toBeNull();
    expect(parsePlanSnapshot(undefined)).toBeNull();
    expect(parsePlanSnapshot("{}")).toBeNull();
  });
});

/**
 * Derselbe Kern trägt die Ziel-Verknüpfung: dort heisst „€ je Einheit" der
 * Umrechnungsfaktor, und das Ergebnis steht in Ziel-Einheiten statt in Euro.
 * Finance zieht den Faktor zwischen L4.2 und L5 nach — das muss als Wertanteil
 * herauskommen, nicht in der Menge verschwinden.
 */
describe("kpiOutcome — die Größen einer Ziel-Verknüpfung", () => {
  // 0 → 12 Wagons je Monat, geplant 10.000 € Ziel-Einheit je Wagon, monatlich.
  const linkPlan = {
    baseline: 0,
    target: 12,
    valuePerUnit: 10_000,
    benefitKind: "recurring",
    recurringInterval: "monthly",
  };
  const link = (over: Partial<KpiOutcomeInput> = {}): KpiOutcomeInput => ({
    ...linkPlan,
    measurements: [{ date: "2026-06-01", value: 9 }], // 75 %
    planSnapshot: linkPlan,
    frozenAt: L42,
    ...over,
  });

  it("das Intervall zählt aufs Jahr hoch", () => {
    // 12 Wagons × 10.000 × 12 Monate.
    expect(kpiOutcome(link()).planned).toBe(1_440_000);
  });

  it("die Faktor-Korrektur landet im Wertanteil, nicht in der Menge", () => {
    const o = kpiOutcome(link({ valuePerUnit: 11_000 }));
    expect(o.attainment).toBeCloseTo(0.75);
    // Menge: 25 % zu wenig, zum **Plan**-Faktor bewertet.
    expect(o.quantityDelta).toBeCloseTo(-360_000);
    // Wert: +1.000 je Wagon auf die tatsächlich gelieferten 9 × 12.
    expect(o.valueDelta).toBeCloseTo(108_000);
    expect(o.quantityDelta + o.valueDelta).toBeCloseTo(o.realized - o.planned);
  });

  it("ohne Schnappschuss fallen Plan und Ist-Maßstab zusammen", () => {
    // Genau der Zustand, der die Korrektur unsichtbar machte: der geänderte
    // Faktor ist zugleich der Plan, der Wertanteil ist zwangsläufig null.
    const o = kpiOutcome(link({ valuePerUnit: 11_000, planSnapshot: null }));
    expect(o.valueDelta).toBe(0);
    expect(o.planned).toBe(kpiOutcome(link({ valuePerUnit: 11_000 })).realized / 0.75);
  });

  it("die Menge friert mit der L4.2-Abnahme — spätere Messungen zählen nicht", () => {
    const late = link({
      measurements: [
        { date: "2026-06-01", value: 9 },
        { date: "2026-09-01", value: 12 },
      ],
    });
    expect(kpiOutcome(late).attainment).toBeCloseTo(0.75);
    expect(kpiOutcome({ ...late, frozenAt: null }).attainment).toBeCloseTo(1);
  });
});
