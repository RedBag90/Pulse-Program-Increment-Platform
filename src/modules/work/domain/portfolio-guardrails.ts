/**
 * Klassifikations-Konstanten fuer die SAFe-Portfolio-Guardrails (Roadmap-G1).
 *
 * Drei Guardrails:
 *  - **Investment by Horizon** — Epics nach McKinsey-3-Horizons-Modell.
 *  - **Apply Capacity Allocation** — Epics als Solution/Epic/Enabler,
 *    Features als Feature/Enabler. „Business"-Side = solution + epic /
 *    feature; „Enabler"-Side = enabler.
 *  - **Business-Owner-Engagement** — Abdeckung + Reaktionszeit der
 *    `business_owner`-Freigaben. Kein Mix; Berechnung im View.
 *
 * Persistiert als Strings am Initiative-Model; Validation hier in der
 * Domain-Schicht (Type-Guards + isEpicType etc.).
 */

import { makeTypeGuard } from "@/modules/core/kernel/domain/type-guards";

// „solution" ist als Epic-Typ zurückgebaut (Backfill:
// prisma/scripts/2026-08-29-epic-type-solution-to-epic.ts) — eine Solution ist
// das langlebige Produkt (eigene Entität), kein Epic-Typ.
export const EPIC_TYPES = ["epic", "enabler"] as const;
export type EpicType = (typeof EPIC_TYPES)[number];

export const FEATURE_TYPES = ["feature", "enabler"] as const;
export type FeatureType = (typeof FEATURE_TYPES)[number];

// Vier Investitionshorizonte (Lebenszyklus der Solution), in Anzeige-/Sortier-
// Reihenfolge: R&D oben → End-of-Life unten.
export const HORIZONS = ["h3", "h2", "h1", "h0"] as const;
export type Horizon = (typeof HORIZONS)[number];

export const EPIC_TYPE_LABEL: Record<EpicType, string> = {
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
export const HORIZON_HELP: Record<
  Horizon,
  { blurb: string; epicArt: string; budgetFokus: string }
> = {
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
  run: "Run = Σ der Run-the-Business-Positionen, die dieser Solution zugerechnet sind, auf ein Jahr gerechnet (Wartung, Support, Infrastruktur). Gepflegt werden sie im Budgeting-Modul — je Position mit eigener Periode; wertstrom-übergreifende Positionen zählen in keine Solution.",
  primarySolution:
    "Die Primär-Solution eines Epics liefert seinen Investitionshorizont und seine Swimlane im Portfolio-Kanban.",
} as const;

export const isEpicType = makeTypeGuard(EPIC_TYPES);
export const isFeatureType = makeTypeGuard(FEATURE_TYPES);
export const isHorizon = makeTypeGuard(HORIZONS);

/**
 * Klassifikation in „Business" oder „Enabler" — dient dem Capacity-
 * Allocation-Guardrail. `epic` zaehlt als Business; `enabler` als Enabler.
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
 * Guardrail-Targets — Tenant-Settings. Die zwei Mix-Achsen summieren je auf
 * 100 %; `engagement` (Guardrail 4) ist **kein** Mix und faellt bewusst nicht
 * unter diese Regel (siehe `validateGuardrailTargets`).
 */
export interface GuardrailTargets {
  horizon: { h0: number; h1: number; h2: number; h3: number };
  capacity: { business: number; enabler: number };
  /**
   * Guardrail 3 — ab welcher Größe ein Vorhaben eine Portfolio-Entscheidung
   * braucht. Kein Mix, sondern eine Schwelle in Euro: darüber Portfolio-Epic,
   * darunter ART-Epic.
   */
  approval: {
    /** Portfolio-Limit in €. */
    portfolioThreshold: number;
  };
  /** Guardrail 4 — Business-Owner-Engagement. Kein Mix: summiert NICHT auf 100. */
  engagement: {
    /** Mindestanteil der Epics im Freigabelauf mit benanntem Business Owner (%). */
    coverage: number;
    /** Zeitrahmen, in dem eine BO-Freigabe bedient sein soll (Tage). */
    responseDays: number;
  };
}

export const DEFAULT_GUARDRAIL_TARGETS: GuardrailTargets = {
  horizon: { h3: 10, h2: 20, h1: 60, h0: 10 },
  capacity: { business: 80, enabler: 20 },
  approval: { portfolioThreshold: 100_000 },
  engagement: { coverage: 90, responseDays: 10 },
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
  const e = (r.engagement ?? {}) as Record<string, unknown>;
  const a = (r.approval ?? {}) as Record<string, unknown>;

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

  // Legacy-Toleranz wie bei h0, aber eine Ebene hoeher: jeder Bestands-Tenant
  // hat ein JSON *ohne* `engagement` (Guardrail 4 kam spaeter). Fehlt der Block
  // komplett, sind die Defaults der GEWOLLTE Pfad — kein Fallback vermerken,
  // sonst warnt `reportGuardrailTargetsFallback` fuer jeden Alt-Tenant. Nur ein
  // teilweise befuellter Block gilt als Drift.
  const engagementPresent = typeof r.engagement === "object" && r.engagement !== null;
  const engagementField = (key: "coverage" | "responseDays"): number => {
    if (typeof e[key] === "number") return e[key] as number;
    if (engagementPresent) recordFallback(`engagement.${key}`);
    return DEFAULT_GUARDRAIL_TARGETS.engagement[key];
  };

  // Wie beim Engagement: jeder Bestands-Tenant hat ein JSON *ohne* `approval`
  // (Guardrail 3 kam später). Fehlt der Block ganz, ist der Default der
  // GEWOLLTE Pfad — kein Fallback vermerken, sonst warnt jeder Alt-Tenant.
  const approvalPresent = typeof r.approval === "object" && r.approval !== null;
  const approvalField = (key: "portfolioThreshold"): number => {
    if (typeof a[key] === "number") return a[key] as number;
    if (approvalPresent) recordFallback(`approval.${key}`);
    return DEFAULT_GUARDRAIL_TARGETS.approval[key];
  };

  const targets: GuardrailTargets = {
    horizon: {
      h0: horizonField("h0"),
      h1: horizonField("h1"),
      h2: horizonField("h2"),
      h3: horizonField("h3"),
    },
    capacity: { business: capacityField("business"), enabler: capacityField("enabler") },
    approval: { portfolioThreshold: approvalField("portfolioThreshold") },
    engagement: {
      coverage: engagementField("coverage"),
      responseDays: engagementField("responseDays"),
    },
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

  // Engagement ist kein Mix — hier gilt nur der Wertebereich, keine Summe.
  const { coverage, responseDays } = t.engagement;
  if (!(coverage >= 0 && coverage <= 100)) {
    return { ok: false, reason: "Abdeckungs-Target muss zwischen 0 und 100 liegen" };
  }
  if (!(responseDays >= 1)) {
    return { ok: false, reason: "Reaktionszeit muss mindestens 1 Tag betragen" };
  }

  // Guardrail 3 ist ebenfalls kein Mix, sondern eine Schwelle: nur der
  // Wertebereich zählt, keine Summe.
  const { portfolioThreshold } = t.approval;
  if (!(Number.isFinite(portfolioThreshold) && portfolioThreshold >= 0)) {
    return { ok: false, reason: "Portfolio-Limit muss eine Zahl ≥ 0 sein" };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Auflösung je Wertstrom
// ---------------------------------------------------------------------------

/** Woher ein Ziel-Set stammt — wird angezeigt, damit Vererbung sichtbar ist. */
export type GuardrailTargetsSource = "value_stream" | "tenant" | "code_default";

export const GUARDRAIL_SOURCE_LABELS: Record<GuardrailTargetsSource, string> = {
  value_stream: "Wertstrom-Regel",
  tenant: "Tenant-Default",
  code_default: "Standard",
};

export interface ResolvedGuardrailTargets {
  targets: GuardrailTargets;
  source: GuardrailTargetsSource;
  /** Die Achsen, die der Wertstrom selbst gesetzt hat — der Rest ist geerbt. */
  overriddenAxes: ("horizon" | "capacity" | "approval" | "engagement")[];
}

/** Eine Wertstrom-Zeile, so weit die Auflösung sie kennen muss. */
export interface GuardrailTargetsRow {
  valueStreamId: string;
  /** Teilmenge von `GuardrailTargets` als JSON. */
  targets: unknown;
}

/**
 * Löst die Ziele eines Wertstroms auf: **Wertstrom-Zeile → Tenant-Default →
 * Code-Default**, achsenweise. Dasselbe Muster wie `resolveGatePolicy`, samt
 * Herkunft im Ergebnis — ohne sie kann die Fläche nicht sagen, ob ein Wert
 * gesetzt oder geerbt ist.
 *
 * Achsenweise, nicht als Ganzes: ein Wertstrom, der nur sein Portfolio-Limit
 * setzen will, soll nicht gezwungen sein, den Horizont-Mix mitzuschleppen —
 * sonst friert er dessen Tenant-Stand in dem Moment ein, in dem er ihn kopiert.
 */
export function resolveGuardrailTargets(
  rows: readonly GuardrailTargetsRow[],
  tenantRaw: unknown,
  valueStreamId: string | null,
): ResolvedGuardrailTargets {
  const inherited = parseGuardrailTargets(tenantRaw);
  const tenantSource: GuardrailTargetsSource = tenantRaw == null ? "code_default" : "tenant";

  const row =
    valueStreamId == null ? undefined : rows.find((r) => r.valueStreamId === valueStreamId);
  const raw = row?.targets;
  if (raw == null || typeof raw !== "object") {
    return { targets: inherited, source: tenantSource, overriddenAxes: [] };
  }

  const r = raw as Record<string, unknown>;
  const axes = ["horizon", "capacity", "approval", "engagement"] as const;
  const overriddenAxes = axes.filter((a) => typeof r[a] === "object" && r[a] !== null);
  if (overriddenAxes.length === 0) {
    return { targets: inherited, source: tenantSource, overriddenAxes: [] };
  }

  // Nur die gesetzten Achsen ersetzen; für sie gilt derselbe tolerante Parser,
  // damit eine halbe Achse nicht die ganze Auflösung kippt.
  const merged = parseGuardrailTargets({
    horizon: overriddenAxes.includes("horizon") ? r.horizon : inherited.horizon,
    capacity: overriddenAxes.includes("capacity") ? r.capacity : inherited.capacity,
    approval: overriddenAxes.includes("approval") ? r.approval : inherited.approval,
    engagement: overriddenAxes.includes("engagement") ? r.engagement : inherited.engagement,
  });

  return { targets: merged, source: "value_stream", overriddenAxes };
}

/**
 * Die Swimlane-Achse des Übersichts-Kanbans: die vier Horizonte plus „Ohne".
 *
 * Lag bis September 2026 im Server-View der Portfolio-Übersicht — und zog damit
 * die Client-Komponente, die sie liest, in ein Servermodul. Sie leitet sich rein
 * aus `HORIZONS` ab und gehört daneben.
 */
export const HORIZON_LANES = [...HORIZONS, "none"] as const;
export type HorizonLane = Horizon | "none";
