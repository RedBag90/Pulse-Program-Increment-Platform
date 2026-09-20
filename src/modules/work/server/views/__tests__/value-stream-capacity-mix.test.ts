import { describe, it, expect } from "vitest";
import {
  maxCapacityDrift,
  noCapacityReason,
  type ValueStreamCapacityPlan,
} from "@/modules/work/server/views/value-stream-capacity-mix";
import { statusFor } from "@/modules/work/domain/guardrail-rules";

/**
 * **Die Ampel von Guardrail 2 — und nur sie.**
 *
 * Die Rechnung selbst liegt in `budgeting/domain/capacity-plan.ts` und wird dort
 * geprueft; hier steht die Uebersetzung von „wie viele Punkte daneben" in „wie
 * rot ist das". Sie hat einen eigenen Test, weil die Wertstrom-Flaeche die
 * Schwellen bis September 2026 selbst nachgebaut hatte — mit `Math.round`
 * **vor** dem Vergleich, wodurch 15,4 pp eine Stufe zu niedrig landeten.
 *
 * Bis dahin stand an dieser Stelle der Mix ueber geliefertes Epic-Budget. Er ist
 * ersetzt, nicht erweitert: er mass eine Schaetzung und eine Vergangenheit.
 */

const plan = (over: Partial<ValueStreamCapacityPlan> = {}): ValueStreamCapacityPlan => ({
  cycleKey: "2026-H1",
  cycleLabel: "H1 2026",
  budget: 420_000,
  capacity: 240,
  rows: [
    {
      bucket: "business",
      targetShare: 0.7,
      available: 168,
      planned: { count: 31, jobSize: 168 },
      delta: 0,
    },
    {
      bucket: "enabler",
      targetShare: 0.2,
      available: 48,
      planned: { count: 10, jobSize: 48 },
      delta: 0,
    },
    {
      bucket: "maintenance",
      targetShare: 0.1,
      available: 24,
      planned: { count: 7, jobSize: 24 },
      delta: 0,
    },
  ],
  targets: { business: 70, enabler: 20, maintenance: 10 },
  unclassified: { count: 0, jobSize: 0 },
  totalPlanned: { count: 48, jobSize: 240 },
  artCount: 4,
  artsWithoutRate: [],
  byCycle: [],
  ...over,
});

/** Eine Abweichung von `pp` Prozentpunkten der Kapazität auf einem Eimer. */
const mitDrift = (pp: number): ValueStreamCapacityPlan => {
  const p = plan();
  p.rows[1]!.delta = (pp / 100) * p.capacity!;
  return p;
};

describe("maxCapacityDrift", () => {
  it("misst die groesste Abweichung als Anteil der Kapazitaet", () => {
    expect(maxCapacityDrift(mitDrift(10))).toBeCloseTo(0.1);
  });

  it("das Vorzeichen zaehlt nicht — unterplant ist auch Abweichung", () => {
    expect(maxCapacityDrift(mitDrift(-12))).toBeCloseTo(0.12);
  });

  it("ohne Kapazitaet gibt es keine Abweichung — und keine 0", () => {
    const p = plan({ capacity: null });
    for (const r of p.rows) r.delta = null;
    expect(maxCapacityDrift(p)).toBeNull();
  });
});

describe("die Ampel", () => {
  it("gruen bis 5 pp, amber darueber, rot ueber 15 pp", () => {
    const stufe = (pp: number) => {
      const d = maxCapacityDrift(mitDrift(pp));
      return statusFor(d ?? 0, d != null);
    };
    expect(stufe(4)).toBe("green");
    expect(stufe(10)).toBe("amber");
    expect(stufe(20)).toBe("red");
  });

  it("15,4 pp sind kritisch — nicht bloss eine Abweichung", () => {
    // Die Nachbau-Ampel rundete vor dem Vergleich und machte daraus 15 → amber.
    const d = maxCapacityDrift(mitDrift(15.4));
    expect(statusFor(d ?? 0, d != null)).toBe("red");
  });

  it("ohne Satz steht die Ampel auf unbekannt, nicht auf gruen", () => {
    const p = plan({ capacity: null });
    for (const r of p.rows) r.delta = null;
    const d = maxCapacityDrift(p);
    expect(statusFor(d ?? 0, d != null)).toBe("unknown");
  });
});

/**
 * **Zwei Gruende, warum es keine Kapazitaet gibt — und sie sind nicht dasselbe.**
 *
 * Der erste Entwurf zeigte beides als „Keine Daten". Gemessen an Pulse Demo Corp
 * fiel auf, was das anrichtet: fuenf von sechs ARTs hatten sehr wohl einen Satz,
 * fuer das Halbjahr war nur noch kein Geld zugeteilt — die Flaeche behauptete
 * trotzdem, sie koenne nicht rechnen.
 */
describe("noCapacityReason", () => {
  it("kein Satz", () => {
    expect(noCapacityReason(plan({ capacity: null }))).toBe("no_rate");
  });

  it("Satz da, aber noch kein Geld zugeteilt", () => {
    expect(noCapacityReason(plan({ capacity: 0, budget: 0 }))).toBe("no_budget");
  });

  it("beides da", () => {
    expect(noCapacityReason(plan())).toBeNull();
  });
});
