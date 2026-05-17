/**
 * Business Case — the SAFe "Initiative Canvas" artefact, created during the
 * L2 Analyzing stage gate. Persisted in `Initiative.businessCase` (JSON) for
 * Epics, with a saved-version history. Replaces the former Lean Business Case.
 */

export const PROJECT_TYPES = ["discovery", "enabler", "impact"] as const;
export type ProjectType = (typeof PROJECT_TYPES)[number];

export const APPROVAL_PARTIES = [
  "mgmt",
  "business_owner",
  "finance",
  "irt_owner",
  "lace_vmo",
] as const;
export type ApprovalParty = (typeof APPROVAL_PARTIES)[number];

export interface BusinessCaseCostRow {
  projectType: ProjectType;
  costsMonths1to6?: number | undefined;
  costsMonths7to12?: number | undefined;
  annualImpact?: number | undefined;
  oneTimeEffect?: number | undefined;
}

export interface BusinessCaseApproval {
  party: ApprovalParty;
  approved: boolean;
  approverName?: string | undefined;
}

export interface BusinessCaseFields {
  funnelEntryDate?: string | undefined;
  keyStakeholders?: string | undefined;
  initiativeDescription?: string | undefined;
  businessOutcomeHypothesis?: string | undefined;
  leadingIndicators?: string | undefined;
  inScope?: string | undefined;
  outOfScope?: string | undefined;
  whatYouNeedToBelieve?: string | undefined;
  costRows?: BusinessCaseCostRow[] | undefined;
  customersAffected?: string | undefined;
  impactOnSolutions?: string | undefined;
  analysisSummary?: string | undefined;
  approvals?: BusinessCaseApproval[] | undefined;
}

export interface BusinessCaseVersion {
  content: BusinessCaseFields;
  /** ISO timestamp of when this version was superseded. */
  savedAt: string;
  /** userId that saved this version. */
  savedBy: string;
}

export interface BusinessCase {
  current: BusinessCaseFields;
  history: BusinessCaseVersion[];
}

export interface BusinessCaseTotals {
  costsMonths1to6: number;
  costsMonths7to12: number;
  annualImpact: number;
  oneTimeEffect: number;
}

/**
 * Reads a stored Business Case JSON value. Accepts both the versioned shape
 * (`{ current, history }`) and a legacy flat shape (fields at the top level).
 */
export function parseBusinessCase(raw: unknown): BusinessCase {
  if (raw == null || typeof raw !== "object") {
    return { current: {}, history: [] };
  }
  const obj = raw as Record<string, unknown>;
  if ("current" in obj) {
    return {
      current: (obj["current"] as BusinessCaseFields | null) ?? {},
      history: Array.isArray(obj["history"]) ? (obj["history"] as BusinessCaseVersion[]) : [],
    };
  }
  return { current: obj as BusinessCaseFields, history: [] };
}

/** True when a Business Case field set carries any content. */
export function businessCaseHasContent(fields: BusinessCaseFields): boolean {
  return Object.entries(fields).some(([key, v]) => {
    if (typeof v === "string") return v.trim() !== "";
    if (key === "costRows" && Array.isArray(v)) {
      return (v as BusinessCaseCostRow[]).some(
        (r) =>
          r.costsMonths1to6 != null ||
          r.costsMonths7to12 != null ||
          r.annualImpact != null ||
          r.oneTimeEffect != null,
      );
    }
    if (key === "approvals" && Array.isArray(v)) {
      return (v as BusinessCaseApproval[]).some(
        (a) => a.approved || (a.approverName ?? "").trim() !== "",
      );
    }
    return false;
  });
}

/** Sums each cost column across all rows — the canvas "Total" row. */
export function computeBusinessCaseTotals(
  costRows: BusinessCaseCostRow[] | undefined,
): BusinessCaseTotals {
  const totals: BusinessCaseTotals = {
    costsMonths1to6: 0,
    costsMonths7to12: 0,
    annualImpact: 0,
    oneTimeEffect: 0,
  };
  for (const row of costRows ?? []) {
    totals.costsMonths1to6 += row.costsMonths1to6 ?? 0;
    totals.costsMonths7to12 += row.costsMonths7to12 ?? 0;
    totals.annualImpact += row.annualImpact ?? 0;
    totals.oneTimeEffect += row.oneTimeEffect ?? 0;
  }
  return totals;
}
