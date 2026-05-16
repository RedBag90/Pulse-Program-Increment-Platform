/**
 * Lean Business Case — structured fields plus a saved-version history.
 * Persisted in `Initiative.leanBusinessCase` (JSON) for Epics.
 */

export interface LbcFields {
  problemStatement?: string | undefined;
  customerValue?: string | undefined;
  costEstimate?: string | undefined;
  roiEstimate?: string | undefined;
  successCriteria?: string | undefined;
  risks?: string | undefined;
}

export interface LbcVersion {
  content: LbcFields;
  /** ISO timestamp of when this version was superseded. */
  savedAt: string;
  /** userId that saved this version. */
  savedBy: string;
}

export interface LeanBusinessCase {
  current: LbcFields;
  history: LbcVersion[];
}

/**
 * Reads a stored LBC JSON value. Accepts both the versioned shape
 * (`{ current, history }`) and the legacy flat shape (fields at the top
 * level) so existing Epics keep working.
 */
export function parseLeanBusinessCase(raw: unknown): LeanBusinessCase {
  if (raw == null || typeof raw !== "object") {
    return { current: {}, history: [] };
  }
  const obj = raw as Record<string, unknown>;
  if ("current" in obj) {
    return {
      current: (obj["current"] as LbcFields | null) ?? {},
      history: Array.isArray(obj["history"]) ? (obj["history"] as LbcVersion[]) : [],
    };
  }
  // Legacy flat format — treat the whole object as the current version.
  return { current: obj as LbcFields, history: [] };
}

/** True when an LBC field set carries any content. */
export function lbcHasContent(fields: LbcFields): boolean {
  return Object.values(fields).some((v) => typeof v === "string" && v.trim() !== "");
}
