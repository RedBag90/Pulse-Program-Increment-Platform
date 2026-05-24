import { z } from "zod";
import { STAGE_GATES } from "@/domain/stage-gate";

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

export const fibonacci = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(5),
  z.literal(8),
  z.literal(13),
  z.literal(20),
]);

export const stageGate = z.enum(STAGE_GATES);

export const initiativeStatus = z.enum([
  "draft",
  "in_review",
  "approved",
  "in_progress",
  "blocked",
  "completed",
  "cancelled",
]);

export const wsjfInputSchema = z.object({
  businessValue: fibonacci,
  timeCriticality: fibonacci,
  riskReduction: fibonacci,
  jobSize: fibonacci,
});

// Benefit Hypothesis (Epic artefact — L1 Reviewing). All fields optional:
// the artefact is filled in progressively after the Epic is created.
export const benefitHypothesisSchema = z.object({
  measuresHypothesis: z.string().max(5000).optional(),
  changeFromBaseline: z.string().max(5000).optional(),
  businessOutcomes: z.array(z.string().min(1).max(1000)).max(20).optional(),
  leadingIndicators: z.array(z.string().min(1).max(1000)).max(20).optional(),
  risks: z.array(z.string().min(1).max(1000)).max(20).optional(),
});

// Business Case (Epic artefact — L2 Analyzing). Replaces the former LBC.
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

// ---------------------------------------------------------------------------
// Base fields shared across all initiative levels
// ---------------------------------------------------------------------------

const baseInitiativeSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(10_000).default(""),
  ownerId: z.string().uuid(),
});

// ---------------------------------------------------------------------------
// Level-specific create schemas
// ---------------------------------------------------------------------------

export const createEpicSchema = baseInitiativeSchema.extend({
  level: z.literal("EPIC"),
  parentId: z.null(),
  valueStreamId: z.string().uuid(),
});

export const createFeatureSchema = baseInitiativeSchema.extend({
  level: z.literal("FEATURE"),
  parentId: z.string().uuid(),
  artId: z.string().uuid(),
  piId: z.string().uuid(),
  wsjf: wsjfInputSchema,
  acceptanceCriteria: z.array(z.string().min(1)).default([]),
});

export const createStorySchema = baseInitiativeSchema.extend({
  level: z.literal("STORY"),
  parentId: z.string().uuid(),
  piId: z.string().uuid(),
  sprintId: z.string().uuid(),
  storyPoints: fibonacci,
  acceptanceCriteria: z.array(z.string().min(1)).default([]),
});

export const createTaskSchema = baseInitiativeSchema.extend({
  level: z.literal("TASK"),
  parentId: z.string().uuid(),
  estimateHours: z.number().positive().max(160),
});

/** Discriminated union – validated by the `level` field. */
export const createInitiativeSchema = z.discriminatedUnion("level", [
  createEpicSchema,
  createFeatureSchema,
  createStorySchema,
  createTaskSchema,
]);

export type CreateEpicInput = z.infer<typeof createEpicSchema>;
export type CreateFeatureInput = z.infer<typeof createFeatureSchema>;
export type CreateStoryInput = z.infer<typeof createStorySchema>;
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type CreateInitiativeInput = z.infer<typeof createInitiativeSchema>;
export type WsjfInput = z.infer<typeof wsjfInputSchema>;
export type BenefitHypothesisInput = z.infer<typeof benefitHypothesisSchema>;
export type BusinessCaseInput = z.infer<typeof businessCaseSchema>;

// ---------------------------------------------------------------------------
// WSJF computation (pure function — no I/O)
// ---------------------------------------------------------------------------

export function computeWsjf(input: WsjfInput): number {
  const costOfDelay = input.businessValue + input.timeCriticality + input.riskReduction;
  return Math.round((costOfDelay / input.jobSize) * 100) / 100;
}
