/**
 * Epic timeline — pure parsing of the owner-controlled portion of an Epic's
 * timeline (estimates per phase + the two manually-entered actuals). The
 * automatic actuals (Funnel = createdAt, Detailing = hypothesisApprovedAt,
 * Business Case = businessCaseApprovedAt) live in dedicated columns, not here.
 * Flat, not versioned. No I/O.
 */

/** Phases whose target date the Owner forecasts as an estimate. */
export const TIMELINE_ESTIMATE_PHASES = [
  "detailing",
  "business_case",
  "backlog",
  "implementation",
] as const;
export type TimelineEstimatePhase = (typeof TIMELINE_ESTIMATE_PHASES)[number];

/** Phases whose actual date the Owner sets manually (no workflow event). */
export const TIMELINE_MANUAL_PHASES = ["backlog", "implementation"] as const;
export type TimelineManualPhase = (typeof TIMELINE_MANUAL_PHASES)[number];

export interface TimelineFields {
  /** ISO date (yyyy-mm-dd) estimates, keyed by phase. */
  estimates: Partial<Record<TimelineEstimatePhase, string>>;
  /** ISO date (yyyy-mm-dd) manual actuals, keyed by phase. */
  actuals: Partial<Record<TimelineManualPhase, string>>;
}

export function emptyTimeline(): TimelineFields {
  return { estimates: {}, actuals: {} };
}

function pickDates<K extends string>(raw: unknown, keys: readonly K[]): Partial<Record<K, string>> {
  const out: Partial<Record<K, string>> = {};
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    for (const k of keys) {
      const v = obj[k];
      if (typeof v === "string" && v.trim() !== "") out[k] = v;
    }
  }
  return out;
}

/** Parses the stored `timeline` JSON into the owner-controlled fields. */
export function parseTimeline(raw: unknown): TimelineFields {
  if (!raw || typeof raw !== "object") return emptyTimeline();
  const obj = raw as Record<string, unknown>;
  return {
    estimates: pickDates(obj["estimates"], TIMELINE_ESTIMATE_PHASES),
    actuals: pickDates(obj["actuals"], TIMELINE_MANUAL_PHASES),
  };
}
