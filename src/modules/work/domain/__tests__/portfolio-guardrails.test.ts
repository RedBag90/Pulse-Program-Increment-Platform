import { describe, it, expect } from "vitest";
import {
  isEpicType,
  isFeatureType,
  isHorizon,
  epicCapacityBucket,
  featureCapacityBucket,
  parseGuardrailTargets,
  validateGuardrailTargets,
  DEFAULT_GUARDRAIL_TARGETS,
} from "@/modules/work/domain/portfolio-guardrails";

describe("Type-Guards", () => {
  it("akzeptiert nur die drei Epic-Typen", () => {
    expect(isEpicType("solution")).toBe(true);
    expect(isEpicType("epic")).toBe(true);
    expect(isEpicType("enabler")).toBe(true);
    expect(isEpicType("feature")).toBe(false);
    expect(isEpicType(null)).toBe(false);
  });

  it("akzeptiert nur die zwei Feature-Typen", () => {
    expect(isFeatureType("feature")).toBe(true);
    expect(isFeatureType("enabler")).toBe(true);
    expect(isFeatureType("solution")).toBe(false);
  });

  it("akzeptiert die vier Horizonte", () => {
    expect(isHorizon("h0")).toBe(true);
    expect(isHorizon("h1")).toBe(true);
    expect(isHorizon("h3")).toBe(true);
    expect(isHorizon("h4")).toBe(false);
  });
});

describe("Capacity-Buckets", () => {
  it("schiebt solution und epic in Business, enabler in Enabler", () => {
    expect(epicCapacityBucket("solution")).toBe("business");
    expect(epicCapacityBucket("epic")).toBe("business");
    expect(epicCapacityBucket("enabler")).toBe("enabler");
    expect(epicCapacityBucket(null)).toBeNull();
  });
  it("schiebt feature in Business, enabler in Enabler", () => {
    expect(featureCapacityBucket("feature")).toBe("business");
    expect(featureCapacityBucket("enabler")).toBe("enabler");
    expect(featureCapacityBucket(null)).toBeNull();
  });
});

describe("parseGuardrailTargets", () => {
  it("liefert Defaults bei leerer Eingabe", () => {
    expect(parseGuardrailTargets(null)).toEqual(DEFAULT_GUARDRAIL_TARGETS);
    expect(parseGuardrailTargets({})).toEqual(DEFAULT_GUARDRAIL_TARGETS);
  });
  it("uebernimmt nur valide Numbers aus dem Input", () => {
    const r = parseGuardrailTargets({
      horizon: { h1: 60, h2: 30, h3: 10 },
      capacity: { business: 75, enabler: 25 },
    });
    expect(r.horizon.h1).toBe(60);
    expect(r.capacity.business).toBe(75);
  });
  it("faellt auf Default fuer fehlende Felder zurueck", () => {
    const r = parseGuardrailTargets({ horizon: { h1: 50 } });
    expect(r.horizon.h1).toBe(50);
    expect(r.horizon.h2).toBe(DEFAULT_GUARDRAIL_TARGETS.horizon.h2);
    expect(r.capacity).toEqual(DEFAULT_GUARDRAIL_TARGETS.capacity);
  });
});

describe("validateGuardrailTargets", () => {
  it("akzeptiert Default-Set", () => {
    expect(validateGuardrailTargets(DEFAULT_GUARDRAIL_TARGETS).ok).toBe(true);
  });
  it("verlangt Horizon-Summe = 100", () => {
    const r = validateGuardrailTargets({
      horizon: { h0: 0, h1: 60, h2: 30, h3: 5 },
      capacity: { business: 80, enabler: 20 },
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("Horizon");
  });
  it("verlangt Capacity-Summe = 100", () => {
    const r = validateGuardrailTargets({
      horizon: { h0: 10, h1: 60, h2: 20, h3: 10 },
      capacity: { business: 70, enabler: 25 },
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("Capacity");
  });
  it("verlangt nicht-negative Werte", () => {
    const r = validateGuardrailTargets({
      horizon: { h0: 0, h1: 110, h2: -5, h3: -5 },
      capacity: { business: 80, enabler: 20 },
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("negativ");
  });
});
