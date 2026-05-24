/**
 * Business Case — the SAFe "Initiative Canvas" artefact, created during the
 * L2 Analyzing stage gate. Persisted in `Initiative.businessCase` (JSON) for
 * Epics, with a saved-version history.
 */

export const APPROVAL_PARTIES = [
  "mgmt",
  "business_owner",
  "finance",
  "irt_owner",
  "lace_vmo",
] as const;
export type ApprovalParty = (typeof APPROVAL_PARTIES)[number];

/**
 * One 6-month period of the cost demand calculation. The period is positional:
 * slice index `i` covers months `6i+1 … 6i+6`. Modelled as an object so future
 * participatory-budgeting fields (e.g. requested / allocated) can be added per
 * slice without a breaking change.
 */
export interface BusinessCaseCostSlice {
  amount?: number | undefined;
}

export interface BusinessCaseApproval {
  party: ApprovalParty;
  approved: boolean;
  approverName?: string | undefined;
}

export interface BusinessCaseFields {
  keyStakeholders?: string | undefined;
  initiativeDescription?: string | undefined;
  businessOutcomeHypothesis?: string | undefined;
  leadingIndicators?: string | undefined;
  inScope?: string | undefined;
  outOfScope?: string | undefined;
  whatYouNeedToBelieve?: string | undefined;
  /** Cost demand per 6-month period — index 0 covers months 1–6. */
  costSlices?: BusinessCaseCostSlice[] | undefined;
  /** One-time benefit expected once the initiative completes. */
  oneTimeBenefit?: number | undefined;
  /** Recurring (annual) benefit at 100 % fulfilment of the Epic's KPI(s). */
  recurringBenefit?: number | undefined;
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
  /** Sum of all 6-month cost slices. */
  implementationCost: number;
  oneTimeBenefit: number;
  recurringBenefit: number;
}

// ---------------------------------------------------------------------------
// Legacy migration — the former project-type `costRows` shape
// ---------------------------------------------------------------------------

interface LegacyCostRow {
  costsMonths1to6?: number;
  costsMonths7to12?: number;
  annualImpact?: number;
  oneTimeEffect?: number;
}

/**
 * Migrates the former project-type `costRows` shape to the slice-based model so
 * existing Epics keep their numbers: the summed 1.–6./7.–12.-month costs become
 * the first two slices, the summed one-time/annual effects become the benefit
 * fields. A case that already uses `costSlices` is returned untouched.
 */
function migrateFields(
  fields: BusinessCaseFields & { costRows?: LegacyCostRow[] },
): BusinessCaseFields {
  const { costRows, ...rest } = fields;
  if (rest.costSlices !== undefined || costRows === undefined) {
    return rest;
  }

  const sum = (pick: (r: LegacyCostRow) => number | undefined): number =>
    costRows.reduce((acc, row) => acc + (pick(row) ?? 0), 0);

  const costs1to6 = sum((r) => r.costsMonths1to6);
  const costs7to12 = sum((r) => r.costsMonths7to12);
  const oneTime = sum((r) => r.oneTimeEffect);
  const recurring = sum((r) => r.annualImpact);

  const migrated: BusinessCaseFields = { ...rest };
  if (costs1to6 !== 0 || costs7to12 !== 0) {
    migrated.costSlices = [{ amount: costs1to6 }, { amount: costs7to12 }];
  }
  if (oneTime !== 0) migrated.oneTimeBenefit = oneTime;
  if (recurring !== 0) migrated.recurringBenefit = recurring;
  return migrated;
}

/**
 * Reads a stored Business Case JSON value. Accepts the versioned shape
 * (`{ current, history }`) and a legacy flat shape, and migrates the former
 * project-type cost grid to the slice-based model.
 */
export function parseBusinessCase(raw: unknown): BusinessCase {
  if (raw == null || typeof raw !== "object") {
    return { current: {}, history: [] };
  }
  const obj = raw as Record<string, unknown>;
  if ("current" in obj) {
    return {
      current: migrateFields((obj["current"] as BusinessCaseFields | null) ?? {}),
      history: Array.isArray(obj["history"]) ? (obj["history"] as BusinessCaseVersion[]) : [],
    };
  }
  return { current: migrateFields(obj as BusinessCaseFields), history: [] };
}

/** True when a Business Case field set carries any content. */
export function businessCaseHasContent(fields: BusinessCaseFields): boolean {
  return Object.entries(fields).some(([key, v]) => {
    if (typeof v === "string") return v.trim() !== "";
    if (typeof v === "number") return v !== 0;
    if (key === "costSlices" && Array.isArray(v)) {
      return (v as BusinessCaseCostSlice[]).some((s) => s.amount != null && s.amount !== 0);
    }
    if (key === "approvals" && Array.isArray(v)) {
      return (v as BusinessCaseApproval[]).some(
        (a) => a.approved || (a.approverName ?? "").trim() !== "",
      );
    }
    return false;
  });
}

/** Aggregates the cost slices and benefit fields — feeds the Overview tab. */
export function computeBusinessCaseTotals(fields: BusinessCaseFields): BusinessCaseTotals {
  const implementationCost = (fields.costSlices ?? []).reduce(
    (acc, slice) => acc + (slice.amount ?? 0),
    0,
  );
  return {
    implementationCost,
    oneTimeBenefit: fields.oneTimeBenefit ?? 0,
    recurringBenefit: fields.recurringBenefit ?? 0,
  };
}

/** Label for cost slice `index` — months `6i+1 … 6i+6`. */
export function costSliceLabel(index: number): string {
  return `Monate ${index * 6 + 1}–${index * 6 + 6}`;
}
