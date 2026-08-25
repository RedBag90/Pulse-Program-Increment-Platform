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

import { makeTypeGuard } from "@/modules/core/kernel/domain/type-guards";

export const EPIC_TYPES = ["solution", "epic", "enabler"] as const;
export type EpicType = (typeof EPIC_TYPES)[number];

export const FEATURE_TYPES = ["feature", "enabler"] as const;
export type FeatureType = (typeof FEATURE_TYPES)[number];

// Vier Investitionshorizonte (Lebenszyklus der Solution), in Anzeige-/Sortier-
// Reihenfolge: R&D oben → End-of-Life unten.
export const HORIZONS = ["h3", "h2", "h1", "h0"] as const;
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
  h3: "H3 · R&D",
  h2: "H2 · Emerging",
  h1: "H1 · Investing",
  h0: "H0 · Decommissioning",
};

/** Erklärtexte je Horizont — Quelle für Tooltips + Legende (Helfer-Schicht). */
export const HORIZON_HELP: Record<Horizon, { blurb: string; epicArt: string; budgetFokus: string }> = {
  h3: {
    blurb: "Evaluating / R&D — noch keine Solution, nur Ideen, Spikes und Prototypen.",
    epicArt: "Exploratory Epics (Machbarkeit, Prototypen, Patente)",
    budgetFokus: "Lernen & Validieren (reine OpEx)",
  },
  h2: {
    blurb: "Emerging — eine neue Solution entsteht und wird als MVP am Markt getestet.",
    epicArt: "Emerging Epics (MVP-Bau, Markttest)",
    budgetFokus: "Markttest & Skalierung (fast nur Grow)",
  },
  h1: {
    blurb: "Investing & Extracting — etablierte Kern-Solution, trägt den Hauptumsatz.",
    epicArt: "Business Epics (Erweiterung) + Enabler Epics (Umbau)",
    budgetFokus: "Ausbauen (Invest) bzw. effizient betreiben (Extract)",
  },
  h0: {
    blurb: "Decommissioning — Solution am Lebensende, wird geordnet abgeschaltet.",
    epicArt: "Decommissioning Epics (Migration, Archivierung, Shutdown)",
    budgetFokus: "Run-Budget auf 0 senken (OpEx-Abwicklung)",
  },
};

/** Kurze Konzept-Erklärungen für die Onboarding-Helfer. */
export const CONCEPT_HELP = {
  solutionVsEpic:
    "Eine Solution ist das langlebige Produkt/System (erzeugt laufende Betriebskosten, Run). Ein Epic ist eine große, zeitlich begrenzte Veränderung an einer Solution (Grow). Jedes Epic wird mindestens einer Solution zugeordnet; die Primär-Solution bestimmt seinen Investitionshorizont.",
  grow: "Grow = Σ Umsetzungskosten der laufenden Epics dieser Solution (Investition in Weiterentwicklung).",
  run: "Run = Betriebskosten der Solution p.a. (Wartung, Support, Infrastruktur).",
  primarySolution:
    "Die Primär-Solution eines Epics liefert seinen Investitionshorizont und seine Swimlane im Portfolio-Kanban.",
} as const;

export const isEpicType = makeTypeGuard(EPIC_TYPES);
export const isFeatureType = makeTypeGuard(FEATURE_TYPES);
export const isHorizon = makeTypeGuard(HORIZONS);

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
  horizon: { h0: number; h1: number; h2: number; h3: number };
  capacity: { business: number; enabler: number };
}

export const DEFAULT_GUARDRAIL_TARGETS: GuardrailTargets = {
  horizon: { h3: 10, h2: 20, h1: 60, h0: 10 },
  capacity: { business: 80, enabler: 20 },
};

/**
 * Per-field outcome of a defensive parse — each "field" can either have
 * matched the input or fallen back to its default. Tracked so callers can
 * surface a "settings corrupt" warning (Sentry, admin UI) instead of
 * silently rendering defaults.
 */
export interface GuardrailTargetsParse {
  targets: GuardrailTargets;
  /** `true` when every field matched the input. `false` when any field fell
   *  back to its default. */
  cleanlyParsed: boolean;
  /** Empty when `cleanlyParsed`. Otherwise the dotted field paths that fell
   *  back, in the order they appear in the type. */
  fellBackFields: string[];
}

/**
 * Defensive parse with provenance. The simpler `parseGuardrailTargets` returns
 * only `targets` — callers that need to detect silent-fallback (the data
 * quality drift the dashboard would otherwise mask) should call this one.
 */
export function parseGuardrailTargetsDetailed(raw: unknown): GuardrailTargetsParse {
  const fellBack: string[] = [];
  const recordFallback = (path: string): void => {
    fellBack.push(path);
  };

  if (raw == null) {
    // No tenant setting yet — defaults are the *intended* path, not corruption.
    return { targets: DEFAULT_GUARDRAIL_TARGETS, cleanlyParsed: true, fellBackFields: [] };
  }
  if (typeof raw !== "object") {
    return {
      targets: DEFAULT_GUARDRAIL_TARGETS,
      cleanlyParsed: false,
      fellBackFields: ["root"],
    };
  }
  const r = raw as Record<string, unknown>;
  const h = (r.horizon ?? {}) as Record<string, unknown>;
  const c = (r.capacity ?? {}) as Record<string, unknown>;

  // Legacy-Erkennung: ein 3-Wert-Set (h1/h2/h3 vorhanden, aber kein h0) →
  // fehlendes h0 tolerant auf 0 (bewahrt Summe = 100). Fehlt der Horizont ganz
  // (z. B. `{}`), fallen alle Felder auf den Default (inkl. h0).
  const horizonHasAnyKey =
    typeof h.h1 === "number" || typeof h.h2 === "number" || typeof h.h3 === "number";
  const horizonField = (key: Horizon): number => {
    if (typeof h[key] === "number") return h[key] as number;
    if (key === "h0" && horizonHasAnyKey) return 0;
    recordFallback(`horizon.${key}`);
    return DEFAULT_GUARDRAIL_TARGETS.horizon[key];
  };
  const capacityField = (key: "business" | "enabler"): number => {
    if (typeof c[key] === "number") return c[key] as number;
    recordFallback(`capacity.${key}`);
    return DEFAULT_GUARDRAIL_TARGETS.capacity[key];
  };

  const targets: GuardrailTargets = {
    horizon: {
      h0: horizonField("h0"),
      h1: horizonField("h1"),
      h2: horizonField("h2"),
      h3: horizonField("h3"),
    },
    capacity: { business: capacityField("business"), enabler: capacityField("enabler") },
  };

  return {
    targets,
    cleanlyParsed: fellBack.length === 0,
    fellBackFields: fellBack,
  };
}

/** Defensive parse — falls back to the default-set when fields are missing or
 *  wrong-typed. `parseGuardrailTargetsDetailed` exposes which fields fell back,
 *  for callers that need to surface a "settings corrupt" warning. */
export function parseGuardrailTargets(raw: unknown): GuardrailTargets {
  return parseGuardrailTargetsDetailed(raw).targets;
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
    t.horizon.h0 >= 0 &&
    t.horizon.h1 >= 0 &&
    t.horizon.h2 >= 0 &&
    t.horizon.h3 >= 0 &&
    t.capacity.business >= 0 &&
    t.capacity.enabler >= 0;
  if (!allNonNeg) return { ok: false, reason: "Targets duerfen nicht negativ sein" };

  const horizonSum = t.horizon.h0 + t.horizon.h1 + t.horizon.h2 + t.horizon.h3;
  if (Math.abs(horizonSum - 100) > 0.5) {
    return { ok: false, reason: `Horizon-Targets summieren auf ${horizonSum}, erwartet 100` };
  }
  const capSum = t.capacity.business + t.capacity.enabler;
  if (Math.abs(capSum - 100) > 0.5) {
    return { ok: false, reason: `Capacity-Targets summieren auf ${capSum}, erwartet 100` };
  }
  return { ok: true };
}
