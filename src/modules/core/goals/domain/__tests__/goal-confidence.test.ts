import { describe, it, expect } from "vitest";
import {
  CONFIDENCE_MIN,
  CONFIDENCE_MAX,
  CONFIDENCE_VALUES,
  CONFIDENCE_LABEL,
  CONFIDENCE_SCALE,
  isConfidenceValue,
  needsReplan,
  confidenceScaleFields,
} from "@/modules/core/goals/domain/goal-confidence";
import { keyResultProgress } from "@/modules/core/goals/domain/goals-rollup";

/**
 * Die Faust-zu-Fuenf als Fortschrittsquelle. Der ganze Zuschnitt haengt an
 * einer Aussage: **`confidence` ist `manual` mit fester Skala.** Setzt man
 * `baseline = 1` und `target = 5`, rechnet die vorhandene Maschinerie ohne
 * einen einzigen Sonderfall weiter.
 */

describe("die Skala", () => {
  it("kennt fuenf Stufen und keine Zwischenwerte", () => {
    expect(CONFIDENCE_VALUES).toEqual([1, 2, 3, 4, 5]);
    expect(isConfidenceValue(1)).toBe(true);
    expect(isConfidenceValue(5)).toBe(true);
    expect(isConfidenceValue(0)).toBe(false);
    expect(isConfidenceValue(6)).toBe(false);
    // An einer Hand gibt es keine 2,5.
    expect(isConfidenceValue(2.5)).toBe(false);
  });

  it("beschriftet jede Stufe", () => {
    for (const v of CONFIDENCE_VALUES) {
      expect(CONFIDENCE_LABEL[v].length).toBeGreaterThan(0);
    }
  });
});

/** Die SAFe-Schwelle. Die glatte 3 traegt die Zusage noch, alles darunter nicht. */
describe("needsReplan", () => {
  it("greift unter 3, nicht bei 3", () => {
    expect(needsReplan(1)).toBe(true);
    expect(needsReplan(2)).toBe(true);
    expect(needsReplan(3)).toBe(false);
    expect(needsReplan(4)).toBe(false);
  });
});

/**
 * **Der Kern des Zuschnitts.** Wenn die Skala auf der Zeile steht, ist ein
 * Confidence-Ziel rechnerisch ein manuelles Ziel — und `keyResultProgress`
 * braucht keinen Sonderfall.
 */
describe("die Skala auf der Zeile", () => {
  it("macht aus einer 3 genau die Haelfte", () => {
    const p = keyResultProgress({
      baseline: CONFIDENCE_MIN,
      target: CONFIDENCE_MAX,
      current: 3,
    });
    expect(p).toBe(0.5);
  });

  it("spannt 1 auf 0 und 5 auf 1", () => {
    const at = (current: number) =>
      keyResultProgress({ baseline: CONFIDENCE_MIN, target: CONFIDENCE_MAX, current });
    expect(at(1)).toBe(0);
    expect(at(5)).toBe(1);
  });
});

describe("confidenceScaleFields", () => {
  it("schreibt die Skala fest, wenn confidence gewaehlt wird", () => {
    expect(confidenceScaleFields("confidence", "manual")).toEqual(CONFIDENCE_SCALE);
    expect(confidenceScaleFields("confidence", null)).toEqual(CONFIDENCE_SCALE);
  });

  /**
   * Die Rueckrichtung ist die unangenehmere: bliebe 1..5 stehen, erbte das Ziel
   * eine Skala, die niemand gesetzt hat — und der naechste Leser hielte sie fuer
   * eine Entscheidung.
   */
  it("gibt baseline und target wieder frei, wenn confidence verlassen wird", () => {
    expect(confidenceScaleFields("manual", "confidence")).toEqual({
      baseline: null,
      target: null,
      precision: 0,
      metricName: null,
    });
  });

  it("laesst jede andere Kombination unberuehrt", () => {
    expect(confidenceScaleFields("manual", "manual")).toBeNull();
    expect(confidenceScaleFields("rollup", "kpi_tree")).toBeNull();
    expect(confidenceScaleFields(null, null)).toBeNull();
  });
});
