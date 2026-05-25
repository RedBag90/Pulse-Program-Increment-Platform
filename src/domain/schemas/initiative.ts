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
  oneTimeBenefit: z.number().nonnegative().optional(),
  recurringBenefit: z.number().nonnegative().optional(),
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
