/**
 * Klassifikations-Konstanten fuer die SAFe-Portfolio-Guardrails (Roadmap-G1).
 *
 * Drei Guardrails:
 *  - **Investment by Horizon** — Epics nach McKinsey-3-Horizons-Modell.
 *  - **Apply Capacity Allocation** — **Features** nach ihrem Arbeitstyp, in
 *    Job-Size-Punkten gegen die aus dem Budget abgeleitete Kapazitaet.
 *    `feature → business`, `enabler → enabler`, `maintenance → maintenance`.
 *    Epics tragen diese Achse seit September 2026 nicht mehr: sie werden durch
 *    die Features repraesentiert, die unter ihnen haengen.
 *  - **Business-Owner-Engagement** — Abdeckung + Reaktionszeit der
 *    `business_owner`-Freigaben. Kein Mix; Berechnung im View.
 *
 * Persistiert als Strings am Initiative-Model; Validation hier in der
 * Domain-Schicht (Type-Guards + isEpicType etc.).
 */

import { makeTypeGuard } from "@/modules/core/kernel/domain/type-guards";
import { HORIZONS, type Horizon } from "@/modules/core/org/domain/horizon";

// „solution" ist als Epic-Typ zurückgebaut (Backfill:
// prisma/scripts/2026-08-29-epic-type-solution-to-epic.ts) — eine Solution ist
// das langlebige Produkt (eigene Entität), kein Epic-Typ.
export const EPIC_TYPES = ["epic", "enabler"] as const;
export type EpicType = (typeof EPIC_TYPES)[number];

/**
 * Der Arbeitstyp eines Features — und **die** Achse der Capacity Allocation.
 *
 * `maintenance` kam im September 2026 dazu. Es ist bewusst **kein** Gegenstueck
 * zu `RunTheBusinessItem.kind = "run"`: Betrieb ist ein Finanzierungstopf und
 * bezahlt nie ein Feature (`art-budget-process-layout.md`). Wartungsarbeit
 * hingegen wird aus dem Veraenderungsgeld bezahlt wie jede andere — sie ist nur
 * eine andere Art Arbeit, und genau das soll die Guardrail sichtbar machen.
 */
export const FEATURE_TYPES = ["feature", "enabler", "maintenance"] as const;
export type FeatureType = (typeof FEATURE_TYPES)[number];

/**
 * Der Horizont selbst steht in **Core** — die `Solution` traegt ihn, und ein Typ
 * gehoert auf die unterste Schicht, die ihn braucht (ADR-0013). Hier wird er nur
 * weitergereicht, damit die rund zwanzig Stellen, die ihn aus dieser Datei
 * beziehen, unberuehrt bleiben; die Stationen und Guardrail-Ziele darunter sind
 * Portfolio-Steuerung und damit Work.
 */
export {
  HORIZONS,
  isHorizon,
  HORIZON_LABEL,
  HORIZON_HELP,
  CONCEPT_HELP,
  type Horizon,
} from "@/modules/core/org/domain/horizon";

/**
 * **Die Fuenferleiter des Lebenszyklus.** H1 zerfaellt in Investing (H1.1) und
 * Extracting (H1.2) — wirtschaftlich zwei verschiedene Phasen: ausbauen gegen
 * ernten.
 *
 * Sie steht hier und nicht in der Zeichnung, seit die Guardrail eigene Ziele je
 * Station traegt. Zwei Namen fuer dieselbe Leiter — einer in der Domaene, einer
 * in `features/portfolio/lib/horizon-funnel.ts` — waeren ein Wartungsfehler in
 * Wartestellung, und die Domaene darf ohnehin nicht in die Fläche importieren.
 */
export const STATIONS = ["h3", "h2", "h1.1", "h1.2", "h0"] as const;
export type Station = (typeof STATIONS)[number];

/** Die Stationen eines Horizonts — H1 belegt zwei, alle anderen eine. */
export const stationsOf = (h: Horizon): Station[] =>
  h === "h1" ? ["h1.1", "h1.2"] : [h as Station];

/** Der Horizont, zu dem eine Station gehoert. */
export const horizonOfStation = (st: Station): Horizon =>
  st === "h1.1" || st === "h1.2" ? "h1" : (st as Horizon);

export const EPIC_TYPE_LABEL: Record<EpicType, string> = {
  epic: "Epic",
  enabler: "Enabler",
};

export const FEATURE_TYPE_LABEL: Record<FeatureType, string> = {
  feature: "Feature",
  enabler: "Enabler",
  maintenance: "Maintenance",
};

export const isEpicType = makeTypeGuard(EPIC_TYPES);
export const isFeatureType = makeTypeGuard(FEATURE_TYPES);

/**
 * Die Eimer der Capacity Allocation. Sie heissen nach der **Arbeit**, nicht nach
 * dem Feature-Typ: „Business" ist, was fachlichen Nutzen baut, und das sind die
 * Features vom Typ `feature`.
 */
export const CAPACITY_BUCKETS = ["business", "enabler", "maintenance"] as const;
export type CapacityBucket = (typeof CAPACITY_BUCKETS)[number];

export const CAPACITY_BUCKET_LABEL: Record<CapacityBucket, string> = {
  business: "Business-Features",
  enabler: "Enabler-Features",
  maintenance: "Maintenance-Features",
};

/**
 * **Die Klassifikation der Achse.** Ein Feature-Typ ist genau ein Eimer.
 *
 * Bis September 2026 war das eine Ja/Nein-Frage (`enabler` oder eben nicht) und
 * damit auf zwei Werte festgelegt. Mit `maintenance` wird daraus eine echte
 * Zuordnung — und der Vorgabe-Zweig faellt weg, der jeden unbekannten Wert
 * stillschweigend zu „Business" gemacht haette.
 */
export function featureCapacityBucket(type: FeatureType | null | undefined): CapacityBucket | null {
  if (type == null) return null;
  return type === "feature" ? "business" : type;
}

/**
 * **Traegt die Capacity-Achse nicht mehr.**
 *
 * Bis September 2026 wurde Guardrail 2 ueber Epics gerechnet — nach ihren
 * Business-Case-Schaetzungen. Sie laeuft jetzt ueber die Features, die unter
 * einem Epic haengen, und misst in Job-Size-Punkten gegen die aus dem Budget
 * abgeleitete Kapazitaet (`budgeting/domain/capacity-plan.ts`). Ein Epic ist
 * darin durch seine Features vertreten und nicht mehr direkt.
 *
 * Die Funktion bleibt stehen wie `art_budget.manage`: sichtbar und ohne Wirkung,
 * statt still entfernt. Wer sie aufruft, misst etwas, das keine Flaeche mehr
 * zeigt.
 */
export function epicCapacityBucket(
  type: EpicType | null | undefined,
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
  horizon: Record<Station, number>;
  /** Guardrail 2 — die drei Arbeitstypen, Summe 100 %. */
  capacity: Record<CapacityBucket, number>;
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
  /**
   * Die 60 % von H1 stehen haelftig auf beiden Stationen. Das ist **keine
   * fachliche Empfehlung**, sondern ein Startwert: die Teilung wird im
   * Guardrail-Formular gesetzt. Wer sie liest, soll sie nicht fuer eine
   * Aussage ueber Ausbau gegen Ernte halten.
   */
  horizon: { h3: 10, h2: 20, "h1.1": 30, "h1.2": 30, h0: 10 },
  capacity: { business: 70, enabler: 20, maintenance: 10 },
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

  /**
   * **Ein gespeichertes `h1` teilt sich beim Lesen**, statt in der Datenbank
   * gewandert zu werden.
   *
   * Bis September 2026 trug die Achse vier Kuebel; H1 zerfaellt seither in
   * Investing und Extracting. Ein Bestandswert wird im **Verhaeltnis der
   * geltenden Vorgabe** verteilt — die Summe des Mandanten bleibt damit exakt
   * erhalten, und es wird keine Richtung erfunden, die niemand gesetzt hat.
   * Sobald jemand speichert, stehen fuenf Schluessel in der Zeile.
   */
  const splitLegacyH1 = (st: "h1.1" | "h1.2"): number | null => {
    if (typeof h.h1 !== "number") return null;
    const d = DEFAULT_GUARDRAIL_TARGETS.horizon;
    const whole = d["h1.1"] + d["h1.2"];
    const share = whole > 0 ? d[st] / whole : 0.5;
    return (h.h1 as number) * share;
  };

  const horizonField = (key: Station): number => {
    if (typeof h[key] === "number") return h[key] as number;
    if (key === "h0" && horizonHasAnyKey) return 0;
    if (key === "h1.1" || key === "h1.2") {
      const split = splitLegacyH1(key);
      if (split != null) return split;
    }
    recordFallback(`horizon.${key}`);
    return DEFAULT_GUARDRAIL_TARGETS.horizon[key];
  };
  /**
   * **`maintenance` fehlt in jedem Bestands-JSON** — die Achse trug bis
   * September 2026 zwei Kuebel. Dieselbe Toleranz wie bei `h0`: fehlt der
   * Schluessel, waehrend die anderen beiden dastehen, gilt 0 statt eines
   * Fallbacks. Das bewahrt die Summe 100 des Mandanten und haelt
   * `reportGuardrailTargetsFallback` still — ohne diesen Zweig meldete jeder
   * Alt-Tenant ab dem ersten Laden Drift.
   */
  const capacityHasLegacyKeys = typeof c.business === "number" || typeof c.enabler === "number";
  const capacityField = (key: CapacityBucket): number => {
    if (typeof c[key] === "number") return c[key] as number;
    if (key === "maintenance" && capacityHasLegacyKeys) return 0;
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
    horizon: Object.fromEntries(STATIONS.map((st) => [st, horizonField(st)])) as Record<
      Station,
      number
    >,
    capacity: {
      business: capacityField("business"),
      enabler: capacityField("enabler"),
      maintenance: capacityField("maintenance"),
    },
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
    STATIONS.every((st) => t.horizon[st] >= 0) && CAPACITY_BUCKETS.every((b) => t.capacity[b] >= 0);
  if (!allNonNeg) return { ok: false, reason: "Targets duerfen nicht negativ sein" };

  const horizonSum = STATIONS.reduce((sum, st) => sum + t.horizon[st], 0);
  if (Math.abs(horizonSum - 100) > 0.5) {
    return { ok: false, reason: `Horizon-Targets summieren auf ${horizonSum}, erwartet 100` };
  }
  const capSum = CAPACITY_BUCKETS.reduce((sum, b) => sum + t.capacity[b], 0);
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
