import { describe, it, expect } from "vitest";
import {
  METRIC_TYPES,
  METRIC_TYPE_LABELS,
  isMetricType,
  clampPrecision,
  formatMetricValue,
  metricUnitSuffix,
} from "@/modules/core/goals/domain/goal-metric";

/**
 * `formatMetricValue` und `metricUnitSuffix` sind if/else-Ketten ohne
 * `assertNever` — ein neuer Metriktyp fiele dort still in den Zahl-Zweig.
 * Diese Tests sind deshalb die eigentliche Absicherung, nicht der Compiler.
 */
describe("goal-metric", () => {
  it("labels every metric type", () => {
    for (const t of METRIC_TYPES) {
      expect(METRIC_TYPE_LABELS[t]).toBeTruthy();
    }
    expect(Object.keys(METRIC_TYPE_LABELS)).toHaveLength(METRIC_TYPES.length);
  });

  it("isMetricType guards the known values only", () => {
    expect(isMetricType("individuell")).toBe(true);
    expect(isMetricType("currency")).toBe(true);
    expect(isMetricType("bogus")).toBe(false);
    expect(isMetricType(null)).toBe(false);
  });

  it("clampPrecision keeps 0..6 and defaults to 0", () => {
    expect(clampPrecision(null)).toBe(0);
    expect(clampPrecision(-3)).toBe(0);
    expect(clampPrecision(9)).toBe(6);
    expect(clampPrecision(2.7)).toBe(2);
    expect(clampPrecision(Number.NaN)).toBe(0);
  });

  describe("formatMetricValue", () => {
    it("returns the em dash for missing values", () => {
      expect(formatMetricValue(null, { metricType: "number" })).toBe("—");
      expect(formatMetricValue(Number.NaN, { metricType: "number" })).toBe("—");
    });

    it("number → plain locale number with precision", () => {
      expect(formatMetricValue(1234.5, { metricType: "number", precision: 1 })).toBe("1.234,5");
    });

    it("percent → number + ' %'", () => {
      expect(formatMetricValue(42, { metricType: "percent" })).toBe("42 %");
    });

    it("currency → Intl currency, and falls back to a plain number without a code", () => {
      expect(formatMetricValue(1000, { metricType: "currency", currencyCode: "EUR" })).toContain(
        "€",
      );
      expect(formatMetricValue(1000, { metricType: "currency" })).toBe("1.000");
    });

    it("currency → invalid ISO code falls back to a plain number instead of throwing", () => {
      expect(formatMetricValue(1000, { metricType: "currency", currencyCode: "not-a-code" })).toBe(
        "1.000",
      );
    });

    it("individuell → number + the free unit label", () => {
      expect(formatMetricValue(120, { metricType: "individuell", metricUnit: "Kunden" })).toBe(
        "120 Kunden",
      );
    });

    it("individuell without a label stays a plain number", () => {
      expect(formatMetricValue(120, { metricType: "individuell" })).toBe("120");
      expect(formatMetricValue(120, { metricType: "individuell", metricUnit: "" })).toBe("120");
    });

    it("an unknown metric type is treated as a number", () => {
      expect(formatMetricValue(7, { metricType: "bogus" })).toBe("7");
    });
  });

  describe("metricUnitSuffix", () => {
    it("covers every metric type", () => {
      expect(metricUnitSuffix({ metricType: "number" })).toBe("");
      expect(metricUnitSuffix({ metricType: "percent" })).toBe(" %");
      expect(metricUnitSuffix({ metricType: "currency", currencyCode: "EUR" })).toBe(" EUR");
      expect(metricUnitSuffix({ metricType: "individuell", metricUnit: "Kunden" })).toBe(" Kunden");
    });

    it("falls back to no suffix when the type's own unit is missing", () => {
      expect(metricUnitSuffix({ metricType: "currency" })).toBe("");
      expect(metricUnitSuffix({ metricType: "individuell" })).toBe("");
    });

    it("ignores metricUnit for types that carry their own unit", () => {
      expect(metricUnitSuffix({ metricType: "percent", metricUnit: "Kunden" })).toBe(" %");
      expect(
        metricUnitSuffix({ metricType: "currency", currencyCode: "EUR", metricUnit: "Kunden" }),
      ).toBe(" EUR");
    });
  });
});
