import { describe, it, expect } from "vitest";
import {
  isEpicType,
  isFeatureType,
  isHorizon,
  epicCapacityBucket,
  featureCapacityBucket,
  parseGuardrailTargets,
  parseGuardrailTargetsDetailed,
  validateGuardrailTargets,
  DEFAULT_GUARDRAIL_TARGETS,
  resolveGuardrailTargets,
} from "@/modules/work/domain/portfolio-guardrails";

/** Ein valides Ziel-Set mit gezielt ueberschriebenen Achsen. */
const targets = (over: Partial<typeof DEFAULT_GUARDRAIL_TARGETS> = {}) => ({
  ...DEFAULT_GUARDRAIL_TARGETS,
  ...over,
});

describe("Type-Guards", () => {
  it("akzeptiert nur die drei Epic-Typen", () => {
    expect(isEpicType("solution")).toBe(false); // als Epic-Typ zurückgebaut
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
  it("schiebt epic in Business, enabler in Enabler", () => {
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
    const r = validateGuardrailTargets(targets({ horizon: { h0: 0, h1: 60, h2: 30, h3: 5 } }));
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("Horizon");
  });
  it("verlangt Capacity-Summe = 100", () => {
    const r = validateGuardrailTargets(targets({ capacity: { business: 70, enabler: 25 } }));
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("Capacity");
  });
  it("verlangt nicht-negative Werte", () => {
    const r = validateGuardrailTargets(targets({ horizon: { h0: 0, h1: 110, h2: -5, h3: -5 } }));
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("negativ");
  });

  it("wendet die Summenregel NICHT auf Engagement an", () => {
    // 90 + 10 = 100 waere Zufall; 95 + 14 ist genauso valide.
    const r = validateGuardrailTargets(targets({ engagement: { coverage: 95, responseDays: 14 } }));
    expect(r.ok).toBe(true);
  });

  it("begrenzt Abdeckung auf 0..100 und Reaktionszeit auf >= 1 Tag", () => {
    expect(
      validateGuardrailTargets(targets({ engagement: { coverage: 120, responseDays: 10 } })).ok,
    ).toBe(false);
    const r = validateGuardrailTargets(targets({ engagement: { coverage: 90, responseDays: 0 } }));
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("Reaktionszeit");
  });
});

describe("parseGuardrailTargets — Engagement-Legacy", () => {
  it("meldet KEINEN Fallback, wenn engagement komplett fehlt", () => {
    // Jeder Bestands-Tenant sieht so aus. Wuerde das als Drift zaehlen, feuerte
    // reportGuardrailTargetsFallback fuer jeden einzelnen von ihnen.
    const r = parseGuardrailTargetsDetailed({
      horizon: { h0: 10, h1: 60, h2: 20, h3: 10 },
      capacity: { business: 80, enabler: 20 },
    });
    expect(r.targets.engagement).toEqual(DEFAULT_GUARDRAIL_TARGETS.engagement);
    expect(r.cleanlyParsed).toBe(true);
    expect(r.fellBackFields).toEqual([]);
  });

  it("meldet einen Fallback, wenn engagement nur teilweise befuellt ist", () => {
    const r = parseGuardrailTargetsDetailed({
      horizon: { h0: 10, h1: 60, h2: 20, h3: 10 },
      capacity: { business: 80, enabler: 20 },
      engagement: { coverage: 95 },
    });
    expect(r.targets.engagement.coverage).toBe(95);
    expect(r.targets.engagement.responseDays).toBe(
      DEFAULT_GUARDRAIL_TARGETS.engagement.responseDays,
    );
    expect(r.cleanlyParsed).toBe(false);
    expect(r.fellBackFields).toEqual(["engagement.responseDays"]);
  });

  it("uebernimmt ein vollstaendiges Engagement-Set", () => {
    const r = parseGuardrailTargets({
      horizon: { h0: 10, h1: 60, h2: 20, h3: 10 },
      capacity: { business: 80, enabler: 20 },
      engagement: { coverage: 75, responseDays: 21 },
    });
    expect(r.engagement).toEqual({ coverage: 75, responseDays: 21 });
  });
});

describe("Guardrail 3 · Portfolio-Limit", () => {
  it("liefert den Default, wenn der Block fehlt — ohne Drift zu melden", () => {
    const parsed = parseGuardrailTargetsDetailed({
      horizon: { h0: 10, h1: 60, h2: 20, h3: 10 },
      capacity: { business: 80, enabler: 20 },
      engagement: { coverage: 90, responseDays: 10 },
    });
    expect(parsed.targets.approval.portfolioThreshold).toBe(
      DEFAULT_GUARDRAIL_TARGETS.approval.portfolioThreshold,
    );
    // Jeder Bestands-Tenant hat ein JSON ohne `approval` — das ist der gewollte
    // Pfad, keine Korruption.
    expect(parsed.cleanlyParsed).toBe(true);
  });

  it("meldet Drift, wenn der Block da ist, aber das Feld fehlt", () => {
    const parsed = parseGuardrailTargetsDetailed({
      horizon: { h0: 10, h1: 60, h2: 20, h3: 10 },
      capacity: { business: 80, enabler: 20 },
      engagement: { coverage: 90, responseDays: 10 },
      approval: {},
    });
    expect(parsed.cleanlyParsed).toBe(false);
    expect(parsed.fellBackFields).toContain("approval.portfolioThreshold");
  });

  it("übernimmt einen gesetzten Wert", () => {
    const t = parseGuardrailTargets({ approval: { portfolioThreshold: 250_000 } });
    expect(t.approval.portfolioThreshold).toBe(250_000);
  });

  // Kein Mix: nur der Wertebereich zählt, keine Summe.
  it("weist ein negatives Limit zurück", () => {
    const t = { ...DEFAULT_GUARDRAIL_TARGETS, approval: { portfolioThreshold: -1 } };
    expect(validateGuardrailTargets(t).ok).toBe(false);
  });

  it("lässt 0 zu — dann ist alles Portfolio-Sache", () => {
    const t = { ...DEFAULT_GUARDRAIL_TARGETS, approval: { portfolioThreshold: 0 } };
    expect(validateGuardrailTargets(t).ok).toBe(true);
  });
});

describe("resolveGuardrailTargets", () => {
  const TENANT = {
    horizon: { h0: 5, h1: 65, h2: 20, h3: 10 },
    capacity: { business: 80, enabler: 20 },
    approval: { portfolioThreshold: 100_000 },
    engagement: { coverage: 90, responseDays: 10 },
  };

  it("erbt vom Tenant, wenn der Wertstrom keine Zeile hat", () => {
    const r = resolveGuardrailTargets([], TENANT, "vs-1");
    expect(r.source).toBe("tenant");
    expect(r.overriddenAxes).toEqual([]);
    expect(r.targets.capacity).toEqual({ business: 80, enabler: 20 });
  });

  it("fällt auf den Code-Default, wenn auch der Tenant nichts gesetzt hat", () => {
    const r = resolveGuardrailTargets([], null, "vs-1");
    expect(r.source).toBe("code_default");
    expect(r.targets).toEqual(DEFAULT_GUARDRAIL_TARGETS);
  });

  // Der Kern: eine gesetzte Achse ersetzt, die übrigen bleiben geerbt. Sonst
  // friert ein Wertstrom den Tenant-Stand ein, sobald er irgendetwas setzt.
  it("ersetzt nur die gesetzten Achsen und erbt den Rest", () => {
    const r = resolveGuardrailTargets(
      [{ valueStreamId: "vs-1", targets: { capacity: { business: 75, enabler: 25 } } }],
      TENANT,
      "vs-1",
    );
    expect(r.source).toBe("value_stream");
    expect(r.overriddenAxes).toEqual(["capacity"]);
    expect(r.targets.capacity).toEqual({ business: 75, enabler: 25 });
    expect(r.targets.horizon).toEqual(TENANT.horizon);
    expect(r.targets.approval.portfolioThreshold).toBe(100_000);
  });

  it("setzt auch nur das Portfolio-Limit", () => {
    const r = resolveGuardrailTargets(
      [{ valueStreamId: "vs-1", targets: { approval: { portfolioThreshold: 250_000 } } }],
      TENANT,
      "vs-1",
    );
    expect(r.overriddenAxes).toEqual(["approval"]);
    expect(r.targets.approval.portfolioThreshold).toBe(250_000);
    expect(r.targets.capacity).toEqual(TENANT.capacity);
  });

  it("greift nicht auf die Zeile eines anderen Wertstroms zurück", () => {
    const r = resolveGuardrailTargets(
      [{ valueStreamId: "vs-2", targets: { capacity: { business: 50, enabler: 50 } } }],
      TENANT,
      "vs-1",
    );
    expect(r.source).toBe("tenant");
    expect(r.targets.capacity).toEqual(TENANT.capacity);
  });

  it("behandelt eine leere Zeile wie keine", () => {
    const r = resolveGuardrailTargets([{ valueStreamId: "vs-1", targets: {} }], TENANT, "vs-1");
    expect(r.source).toBe("tenant");
    expect(r.overriddenAxes).toEqual([]);
  });

  it("ohne Wertstrom-Bezug gilt der Tenant-Stand", () => {
    const r = resolveGuardrailTargets(
      [{ valueStreamId: "vs-1", targets: { capacity: { business: 50, enabler: 50 } } }],
      TENANT,
      null,
    );
    expect(r.source).toBe("tenant");
  });
});
