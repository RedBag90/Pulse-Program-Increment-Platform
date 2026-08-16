import { z } from "zod";

// ---------------------------------------------------------------------------
// Initiative validation primitives + WSJF.
//
// Scope note (see ADR-0004): this module holds the *shared* validation
// primitives that real callers import — the WSJF Fibonacci scale + computation,
// and the Business Case artefact schema. It is deliberately NOT a central
// "create initiative" input contract. Input for create/update is validated at
// each edge: the form edge (server actions — FormData with `z.coerce`, a
// server-derived owner, single-string fields) and the JSON API edge validate
// independently because their raw shapes genuinely differ. An earlier attempt
// at one shared create-schema set (createEpic/Feature/Story/TaskSchema, the
// discriminated `createInitiativeSchema`, and `Create*Input`) was orphaned and
// drifted from reality — it has been removed.
// ---------------------------------------------------------------------------

/** The SAFe WSJF scale — Fibonacci values for the four scoring dimensions. */
export const fibonacci = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(5),
  z.literal(8),
  z.literal(13),
  z.literal(20),
]);

export const wsjfInputSchema = z.object({
  businessValue: fibonacci,
  timeCriticality: fibonacci,
  riskReduction: fibonacci,
  jobSize: fibonacci,
});
export type WsjfInput = z.infer<typeof wsjfInputSchema>;

// ---------------------------------------------------------------------------
// Business Case (Epic artefact — L2 Analyzing). Replaces the former LBC.
// ---------------------------------------------------------------------------

export const approvalPartySchema = z.enum([
  "mgmt",
  "business_owner",
  "finance",
  "irt_owner",
  "lace_vmo",
]);

/** One 6-month period of the cost demand calculation (index = period). */
export const businessCaseCostSliceSchema = z.object({
  amount: z.number().nonnegative().optional(),
});

export const businessCaseApprovalSchema = z.object({
  party: approvalPartySchema,
  approved: z.boolean(),
  approverName: z.string().max(200).optional(),
});

export const businessCaseSchema = z.object({
  keyStakeholders: z.string().max(2000).optional(),
  initiativeDescription: z.string().max(5000).optional(),
  businessOutcomeHypothesis: z.string().max(5000).optional(),
  leadingIndicators: z.string().max(2000).optional(),
  inScope: z.string().max(2000).optional(),
  outOfScope: z.string().max(2000).optional(),
  whatYouNeedToBelieve: z.string().max(2000).optional(),
  costSlices: z.array(businessCaseCostSliceSchema).max(24).optional(),
  // oneTimeBenefit/recurringBenefit werden nicht mehr eingegeben — sie leiten sich
  // live aus den KPIs ab (epicBenefitFromKpis) und werden nicht mehr gespeichert.
  customersAffected: z.string().max(5000).optional(),
  impactOnSolutions: z.string().max(5000).optional(),
  analysisSummary: z.string().max(5000).optional(),
  approvals: z.array(businessCaseApprovalSchema).max(5).optional(),
});
export type BusinessCaseInput = z.infer<typeof businessCaseSchema>;

// ---------------------------------------------------------------------------
// WSJF computation (pure function — no I/O)
// ---------------------------------------------------------------------------

export function computeWsjf(input: WsjfInput): number {
  const costOfDelay = input.businessValue + input.timeCriticality + input.riskReduction;
  return Math.round((costOfDelay / input.jobSize) * 100) / 100;
}

// ---------------------------------------------------------------------------
// WSJF banding + display (pure — shared by every surface that tiers or renders
// a `wsjfComputed` score). Kept LOW (Core) so both the Work feature views
// (features-list / features-overview) and the Drumbeat tiering
// (`modules/drumbeat/domain/wsjf.ts`) import DOWN into one primitive. The
// per-surface threshold differences (≥ 8 / ≥ 4 for Drumbeat vs ≥ 5 / ≥ 2 for
// the ART feature lists) are now DATA (the `opts` object), not forked code.
// ---------------------------------------------------------------------------

/** The three scored bands. The missing-score label is caller-supplied
 *  (`"unscored"` for Drumbeat, `"none"` for the ART feature lists). */
export type WsjfBandLabel = "high" | "medium" | "low";

/**
 * Buckets a computed WSJF score into `high | medium | low`, or the caller's
 * `missingLabel` when the score is absent. Bucketing is `>=` on both
 * thresholds (matching every current caller); `0` is a real score → `"low"`.
 */
export function wsjfBand<M extends string>(
  computed: number | null,
  opts: { high: number; medium: number; missingLabel: M },
): WsjfBandLabel | M {
  if (computed == null) return opts.missingLabel;
  if (computed >= opts.high) return "high";
  if (computed >= opts.medium) return "medium";
  return "low";
}

/**
 * One display formatter for a `wsjfComputed` value. Canonical precision is
 * 2 decimals — it matches `computeWsjf`'s own rounding, so no stored precision
 * is dropped. `null`/non-finite → an em dash. Accepts a Prisma `Decimal` too
 * (coerced via `Number`).
 */
export function formatWsjf(value: number | null | { toString(): string }, digits = 2): string {
  if (value == null) return "—";
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(digits);
}

/** The persisted WSJF columns — the 4 raw inputs plus the derived score. */
export interface WsjfWriteFields {
  wsjfBusinessValue: number;
  wsjfTimeCriticality: number;
  wsjfRiskReduction: number;
  wsjfJobSize: number;
  wsjfComputed: number;
}

/**
 * Assembles the WSJF write payload (the 4 raw inputs + the computed score) that
 * every Feature write path spreads into its Prisma `data`. Pure — recomputes the
 * score via `computeWsjf` so the derived column can never drift from its inputs.
 */
export function wsjfWriteFields(input: {
  businessValue: number;
  timeCriticality: number;
  riskReduction: number;
  jobSize: number;
}): WsjfWriteFields {
  return {
    wsjfBusinessValue: input.businessValue,
    wsjfTimeCriticality: input.timeCriticality,
    wsjfRiskReduction: input.riskReduction,
    wsjfJobSize: input.jobSize,
    wsjfComputed: computeWsjf(input as WsjfInput),
  };
}
