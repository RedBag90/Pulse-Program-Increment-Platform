import { describe, it, expect } from "vitest";
import {
  PROGRESS_MODES,
  isProgressMode,
  effectiveProgressMode,
  unitsMatch,
  autoKpiCurrent,
  isMeasurableGoal,
} from "@/domain/goal-progress-mode";

describe("progress mode basics", () => {
  it("exposes the three modes", () => {
    expect(PROGRESS_MODES).toEqual(["manual", "rollup", "auto_kpi"]);
  });
  it("isProgressMode guards", () => {
    expect(isProgressMode("manual")).toBe(true);
    expect(isProgressMode("auto_kpi")).toBe(true);
    expect(isProgressMode("")).toBe(false);
    expect(isProgressMode(null)).toBe(false);
    expect(isProgressMode("nonsense")).toBe(false);
  });
});

describe("effectiveProgressMode", () => {
  it("uses a stored valid mode", () => {
    expect(effectiveProgressMode("auto_kpi", true)).toBe("auto_kpi");
    expect(effectiveProgressMode("manual", true)).toBe("manual");
  });
  it("derives from structure when null/invalid (legacy behaviour)", () => {
    expect(effectiveProgressMode(null, true)).toBe("rollup");
    expect(effectiveProgressMode(null, false)).toBe("manual");
    expect(effectiveProgressMode("bogus", true)).toBe("rollup");
  });
});

describe("unitsMatch", () => {
  it("matches free-label units case/space-insensitively", () => {
    const goal = { metricUnit: " Kunden ", metricType: "number", currencyCode: null };
    expect(unitsMatch(goal, "kunden")).toBe(true);
    expect(unitsMatch(goal, "Leads")).toBe(false);
  });
  it("matches currency by code, not label", () => {
    const goal = { metricUnit: "€", metricType: "currency", currencyCode: "EUR" };
    expect(unitsMatch(goal, "EUR")).toBe(true);
    expect(unitsMatch(goal, "USD")).toBe(false);
  });
  it("empty units never match", () => {
    expect(unitsMatch({ metricUnit: "", metricType: "number", currencyCode: null }, "")).toBe(
      false,
    );
    expect(unitsMatch({ metricUnit: null, metricType: "number", currencyCode: null }, null)).toBe(
      false,
    );
  });
});

describe("autoKpiCurrent", () => {
  const goal = { metricUnit: "Kunden", metricType: "number", currencyCode: null };
  it("sums current of matching-unit KPIs", () => {
    expect(
      autoKpiCurrent(goal, [
        { unit: "Kunden", current: 30 },
        { unit: "Kunden", current: 12 },
      ]),
    ).toBe(42);
  });
  it("ignores non-matching units and null currents", () => {
    expect(
      autoKpiCurrent(goal, [
        { unit: "Kunden", current: 30 },
        { unit: "Leads", current: 999 },
        { unit: "Kunden", current: null },
      ]),
    ).toBe(30);
  });
  it("returns null when nothing matches", () => {
    expect(autoKpiCurrent(goal, [{ unit: "Leads", current: 5 }])).toBeNull();
    expect(autoKpiCurrent(goal, [])).toBeNull();
  });
});

describe("isMeasurableGoal", () => {
  it("rollup needs children", () => {
    expect(isMeasurableGoal({ progressMode: "rollup", target: null, hasChildren: true })).toBe(
      true,
    );
    expect(isMeasurableGoal({ progressMode: "rollup", target: 100, hasChildren: false })).toBe(
      false,
    );
  });
  it("manual/auto_kpi need a target", () => {
    expect(isMeasurableGoal({ progressMode: "manual", target: 100, hasChildren: false })).toBe(
      true,
    );
    expect(isMeasurableGoal({ progressMode: "manual", target: null, hasChildren: true })).toBe(
      false,
    );
    expect(isMeasurableGoal({ progressMode: "auto_kpi", target: 50, hasChildren: false })).toBe(
      true,
    );
  });
});
