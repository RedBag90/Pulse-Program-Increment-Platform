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
  FEATURE_TYPES,
  CAPACITY_BUCKETS,
} from "@/modules/work/domain/portfolio-guardrails";

/** Ein valides Ziel-Set mit gezielt ueberschriebenen Achsen. */
const targets = (over: Partial<typeof DEFAULT_GUARDRAIL_TARGETS> = {}) => ({
  ...DEFAULT_GUARDRAIL_TARGETS,
  ...over,
});

describe("Type-Guards", () => {
  it("akzeptiert nur die zwei Epic-Typen", () => {
    expect(isEpicType("solution")).toBe(false); // als Epic-Typ zurückgebaut
    expect(isEpicType("epic")).toBe(true);
    expect(isEpicType("enabler")).toBe(true);
    expect(isEpicType("feature")).toBe(false);
    expect(isEpicType(null)).toBe(false);
  });

  it("akzeptiert nur die drei Feature-Typen", () => {
    expect(isFeatureType("feature")).toBe(true);
    expect(isFeatureType("enabler")).toBe(true);
    expect(isFeatureType("maintenance")).toBe(true);
    expect(isFeatureType("solution")).toBe(false);
    expect(isFeatureType(null)).toBe(false);
  });

  it("akzeptiert die vier Horizonte", () => {
    expect(isHorizon("h0")).toBe(true);
    expect(isHorizon("h1")).toBe(true);
    expect(isHorizon("h3")).toBe(true);
    expect(isHorizon("h4")).toBe(false);
  });
});

describe("Capacity-Buckets", () => {
  // `epicCapacityBucket` traegt seit September 2026 keine Guardrail mehr; die
  // Achse laeuft ueber Features. Die Funktion bleibt sichtbar und wirkungslos.
  it("schiebt epic in Business, enabler in Enabler", () => {
    expect(epicCapacityBucket("epic")).toBe("business");
    expect(epicCapacityBucket("enabler")).toBe("enabler");
    expect(epicCapacityBucket(null)).toBeNull();
  });
  /**
   * Der dritte Eimer ist der Grund, warum diese Zuordnung keine Ja/Nein-Frage
   * mehr sein darf: ein Vorgabe-Zweig haette `maintenance` still zu „Business"
   * gemacht, und die Guardrail haette einen Arbeitstyp gemessen, den sie gar
   * nicht kennt.
   */
  it("schiebt jeden Feature-Typ in genau einen Eimer", () => {
    expect(featureCapacityBucket("feature")).toBe("business");
    expect(featureCapacityBucket("enabler")).toBe("enabler");
    expect(featureCapacityBucket("maintenance")).toBe("maintenance");
    expect(featureCapacityBucket(null)).toBeNull();
  });

  it("die Eimer decken die Feature-Typen vollstaendig ab", () => {
    const eimer = FEATURE_TYPES.map((t) => featureCapacityBucket(t));
    expect(new Set(eimer)).toEqual(new Set(CAPACITY_BUCKETS));
  });
});

describe("parseGuardrailTargets", () => {
  it("liefert Defaults bei leerer Eingabe", () => {
    expect(parseGuardrailTargets(null)).toEqual(DEFAULT_GUARDRAIL_TARGETS);
    expect(parseGuardrailTargets({})).toEqual(DEFAULT_GUARDRAIL_TARGETS);
  });
  it("uebernimmt nur valide Numbers aus dem Input", () => {
    const r = parseGuardrailTargets({
      horizon: { "h1.1": 30, "h1.2": 30, h2: 30, h3: 10 },
      capacity: { business: 75, enabler: 25, maintenance: 0 },
    });
    expect(r.horizon["h1.1"]).toBe(30);
    expect(r.capacity.business).toBe(75);
  });
  it("teilt ein gespeichertes h1 im Verhaeltnis der Vorgabe", () => {
    // Bis September 2026 trug die Achse vier Kuebel. Ein Bestandswert wird beim
    // **Lesen** verteilt, nicht in der Datenbank gewandert — die Summe des
    // Mandanten bleibt dabei exakt erhalten, und es wird keine Richtung
    // erfunden, die niemand gesetzt hat.
    const r = parseGuardrailTargets({ horizon: { h0: 10, h1: 60, h2: 20, h3: 10 } });
    const d = DEFAULT_GUARDRAIL_TARGETS.horizon;
    const anteil = d["h1.1"] / (d["h1.1"] + d["h1.2"]);
    expect(r.horizon["h1.1"]).toBeCloseTo(60 * anteil, 10);
    expect(r.horizon["h1.2"]).toBeCloseTo(60 * (1 - anteil), 10);
    expect(r.horizon["h1.1"] + r.horizon["h1.2"]).toBeCloseTo(60, 10);
    // Und der Rest der Achse bleibt unangetastet.
    expect(r.horizon.h3).toBe(10);
    expect(r.horizon.h0).toBe(10);
  });
  it("faellt auf Default fuer fehlende Felder zurueck", () => {
    const r = parseGuardrailTargets({ horizon: { "h1.1": 50 } });
    expect(r.horizon["h1.1"]).toBe(50);
    expect(r.horizon.h2).toBe(DEFAULT_GUARDRAIL_TARGETS.horizon.h2);
    expect(r.capacity).toEqual(DEFAULT_GUARDRAIL_TARGETS.capacity);
  });
});

/**
 * **Der Zweig, der den Sentry-Laerm verhindert.**
 *
 * `capacity` trug bis September 2026 zwei Kuebel. Jedes Bestands-JSON hat
 * deshalb kein `maintenance` — und `capacity` war die **einzige** Achse ohne
 * Legacy-Toleranz. Ohne diesen Zweig meldete jeder Alt-Mandant ab dem ersten
 * Laden Drift, und `reportGuardrailTargetsFallback` verlaere seinen Wert.
 */
describe("parseGuardrailTargets — der dritte Anteil", () => {
  const altbestand = {
    horizon: { h3: 10, h2: 20, "h1.1": 30, "h1.2": 30, h0: 10 },
    capacity: { business: 80, enabler: 20 },
  };

  it("fehlendes maintenance gilt als 0 und bewahrt die Summe", () => {
    const t = parseGuardrailTargets(altbestand);
    expect(t.capacity).toEqual({ business: 80, enabler: 20, maintenance: 0 });
    expect(validateGuardrailTargets(t).ok).toBe(true);
  });

  it("und wird **nicht** als Drift gemeldet", () => {
    const p = parseGuardrailTargetsDetailed(altbestand);
    expect(p.fellBackFields).not.toContain("capacity.maintenance");
  });

  it("fehlt die Achse ganz, gilt der Default — und das ist Drift", () => {
    const p = parseGuardrailTargetsDetailed({ horizon: altbestand.horizon, capacity: {} });
    expect(p.targets.capacity).toEqual(DEFAULT_GUARDRAIL_TARGETS.capacity);
    expect(p.fellBackFields).toContain("capacity.maintenance");
  });
});

describe("validateGuardrailTargets", () => {
  it("akzeptiert Default-Set", () => {
    expect(validateGuardrailTargets(DEFAULT_GUARDRAIL_TARGETS).ok).toBe(true);
  });
  it("verlangt Horizon-Summe = 100", () => {
    const r = validateGuardrailTargets(
      targets({ horizon: { h0: 0, "h1.1": 30, "h1.2": 30, h2: 30, h3: 5 } }),
    );
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("Horizon");
  });
  it("verlangt Capacity-Summe = 100", () => {
    const r = validateGuardrailTargets(
      targets({ capacity: { business: 70, enabler: 25, maintenance: 0 } }),
    );
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("Capacity");
  });
  it("verlangt nicht-negative Werte", () => {
    const r = validateGuardrailTargets(
      targets({ horizon: { h0: 0, "h1.1": 60, "h1.2": 50, h2: -5, h3: -5 } }),
    );
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
      horizon: { h0: 10, "h1.1": 30, "h1.2": 30, h2: 20, h3: 10 },
      capacity: { business: 80, enabler: 20, maintenance: 0 },
    });
    expect(r.targets.engagement).toEqual(DEFAULT_GUARDRAIL_TARGETS.engagement);
    expect(r.cleanlyParsed).toBe(true);
    expect(r.fellBackFields).toEqual([]);
  });

  it("meldet einen Fallback, wenn engagement nur teilweise befuellt ist", () => {
    const r = parseGuardrailTargetsDetailed({
      horizon: { h0: 10, "h1.1": 30, "h1.2": 30, h2: 20, h3: 10 },
      capacity: { business: 80, enabler: 20, maintenance: 0 },
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
      horizon: { h0: 10, "h1.1": 30, "h1.2": 30, h2: 20, h3: 10 },
      capacity: { business: 80, enabler: 20, maintenance: 0 },
      engagement: { coverage: 75, responseDays: 21 },
    });
    expect(r.engagement).toEqual({ coverage: 75, responseDays: 21 });
  });
});

describe("Guardrail 3 · Portfolio-Limit", () => {
  it("liefert den Default, wenn der Block fehlt — ohne Drift zu melden", () => {
    const parsed = parseGuardrailTargetsDetailed({
      horizon: { h0: 10, "h1.1": 30, "h1.2": 30, h2: 20, h3: 10 },
      capacity: { business: 80, enabler: 20, maintenance: 0 },
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
      horizon: { h0: 10, "h1.1": 30, "h1.2": 30, h2: 20, h3: 10 },
      capacity: { business: 80, enabler: 20, maintenance: 0 },
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
    capacity: { business: 80, enabler: 20, maintenance: 0 },
    approval: { portfolioThreshold: 100_000 },
    engagement: { coverage: 90, responseDays: 10 },
  };

  it("erbt vom Tenant, wenn der Wertstrom keine Zeile hat", () => {
    const r = resolveGuardrailTargets([], TENANT, "vs-1");
    expect(r.source).toBe("tenant");
    expect(r.overriddenAxes).toEqual([]);
    expect(r.targets.capacity).toEqual({ business: 80, enabler: 20, maintenance: 0 });
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
      [
        {
          valueStreamId: "vs-1",
          targets: { capacity: { business: 75, enabler: 25, maintenance: 0 } },
        },
      ],
      TENANT,
      "vs-1",
    );
    expect(r.source).toBe("value_stream");
    expect(r.overriddenAxes).toEqual(["capacity"]);
    expect(r.targets.capacity).toEqual({ business: 75, enabler: 25, maintenance: 0 });
    // Geerbt heisst: derselbe Stand wie beim Parsen des Tenants — der teilt ein
    // gespeichertes `h1` auf die beiden Stationen auf.
    expect(r.targets.horizon).toEqual(parseGuardrailTargets(TENANT).horizon);
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
      [
        {
          valueStreamId: "vs-2",
          targets: { capacity: { business: 50, enabler: 50, maintenance: 0 } },
        },
      ],
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
      [
        {
          valueStreamId: "vs-1",
          targets: { capacity: { business: 50, enabler: 50, maintenance: 0 } },
        },
      ],
      TENANT,
      null,
    );
    expect(r.source).toBe("tenant");
  });
});
