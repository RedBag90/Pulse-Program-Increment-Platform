/**
 * Klassifikations-Konstanten fuer die SAFe-Portfolio-Guardrails (Roadmap-G1).
 *
 * Zwei Guardrails:
 *  - **Investment by Horizon** — Epics nach McKinsey-3-Horizons-Modell.
 *  - **Apply Capacity Allocation** — Epics als Solution/Epic/Enabler,
 *    Features als Feature/Enabler. „Business"-Side = solution + epic /
 *    feature; „Enabler"-Side = enabler.
 *
 * Persistiert als Strings am Initiative-Model; Validation hier in der
 * Domain-Schicht (Type-Guards + isEpicType etc.).
 */

export const EPIC_TYPES = ["solution", "epic", "enabler"] as const;
export type EpicType = (typeof EPIC_TYPES)[number];

export const FEATURE_TYPES = ["feature", "enabler"] as const;
export type FeatureType = (typeof FEATURE_TYPES)[number];

export const HORIZONS = ["h1", "h2", "h3"] as const;
export type Horizon = (typeof HORIZONS)[number];

export const EPIC_TYPE_LABEL: Record<EpicType, string> = {
  solution: "Solution",
  epic: "Epic",
  enabler: "Enabler",
};

export const FEATURE_TYPE_LABEL: Record<FeatureType, string> = {
  feature: "Feature",
  enabler: "Enabler",
};

export const HORIZON_LABEL: Record<Horizon, string> = {
  h1: "H1 · Sustain",
  h2: "H2 · Grow",
  h3: "H3 · Innovate",
};

export function isEpicType(v: unknown): v is EpicType {
  return typeof v === "string" && (EPIC_TYPES as readonly string[]).includes(v);
}
export function isFeatureType(v: unknown): v is FeatureType {
  return typeof v === "string" && (FEATURE_TYPES as readonly string[]).includes(v);
}
export function isHorizon(v: unknown): v is Horizon {
  return typeof v === "string" && (HORIZONS as readonly string[]).includes(v);
}

/**
 * Klassifikation in „Business" oder „Enabler" — dient dem Capacity-
 * Allocation-Guardrail. `solution` und `epic` zaehlen als Business;
 * `enabler` als Enabler.
 */
export function epicCapacityBucket(
  type: EpicType | null | undefined,
): "business" | "enabler" | null {
  if (type == null) return null;
  return type === "enabler" ? "enabler" : "business";
}
export function featureCapacityBucket(
  type: FeatureType | null | undefined,
): "business" | "enabler" | null {
  if (type == null) return null;
  return type === "enabler" ? "enabler" : "business";
}

/**
 * Guardrail-Targets — Tenant-Settings, je 100 % summierend.
 */
export interface GuardrailTargets {
  horizon: { h1: number; h2: number; h3: number };
  capacity: { business: number; enabler: number };
}

export const DEFAULT_GUARDRAIL_TARGETS: GuardrailTargets = {
  horizon: { h1: 70, h2: 20, h3: 10 },
  capacity: { business: 80, enabler: 20 },
};

/** Validiert ein gespeichertes Targets-JSON. Liefert das Default-Set, wenn
 *  die Eingabe kein passendes Shape hat — die UI fragt vorher ab, hier ist
 *  der Defensiv-Pfad. */
export function parseGuardrailTargets(raw: unknown): GuardrailTargets {
  if (raw == null || typeof raw !== "object") return DEFAULT_GUARDRAIL_TARGETS;
  const r = raw as Record<string, unknown>;
  const h = (r.horizon ?? {}) as Record<string, unknown>;
  const c = (r.capacity ?? {}) as Record<string, unknown>;
  const out: GuardrailTargets = {
    horizon: {
      h1: typeof h.h1 === "number" ? h.h1 : DEFAULT_GUARDRAIL_TARGETS.horizon.h1,
      h2: typeof h.h2 === "number" ? h.h2 : DEFAULT_GUARDRAIL_TARGETS.horizon.h2,
      h3: typeof h.h3 === "number" ? h.h3 : DEFAULT_GUARDRAIL_TARGETS.horizon.h3,
    },
    capacity: {
      business:
        typeof c.business === "number" ? c.business : DEFAULT_GUARDRAIL_TARGETS.capacity.business,
      enabler:
        typeof c.enabler === "number" ? c.enabler : DEFAULT_GUARDRAIL_TARGETS.capacity.enabler,
    },
  };
  return out;
}

/**
 * Prueft, ob ein Targets-Set wohlgeformt ist: jede Achse summiert auf 100
 * (Toleranz 0.5 für Rundungsspielraum) und alle Werte >= 0.
 */
export function validateGuardrailTargets(t: GuardrailTargets): {
  ok: boolean;
  reason?: string;
} {
  const allNonNeg =
    t.horizon.h1 >= 0 &&
    t.horizon.h2 >= 0 &&
    t.horizon.h3 >= 0 &&
    t.capacity.business >= 0 &&
    t.capacity.enabler >= 0;
  if (!allNonNeg) return { ok: false, reason: "Targets duerfen nicht negativ sein" };

  const horizonSum = t.horizon.h1 + t.horizon.h2 + t.horizon.h3;
  if (Math.abs(horizonSum - 100) > 0.5) {
    return { ok: false, reason: `Horizon-Targets summieren auf ${horizonSum}, erwartet 100` };
  }
  const capSum = t.capacity.business + t.capacity.enabler;
  if (Math.abs(capSum - 100) > 0.5) {
    return { ok: false, reason: `Capacity-Targets summieren auf ${capSum}, erwartet 100` };
  }
  return { ok: true };
}
