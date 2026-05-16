import { z } from "zod";

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

export const stageGate = z.enum(["L0", "L1", "L2", "L3", "L4", "L5"]);

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

export const leanBusinessCaseSchema = z.object({
  problemStatement: z.string().min(1).max(5000),
  customerValue: z.string().min(1).max(5000),
  costEstimate: z.number().positive().optional(),
  roiEstimate: z.number().optional(),
  successCriteria: z.string().min(1).max(2000),
  risks: z.string().min(1).max(2000),
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
  leanBusinessCase: leanBusinessCaseSchema,
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
export type LeanBusinessCaseInput = z.infer<typeof leanBusinessCaseSchema>;

// ---------------------------------------------------------------------------
// WSJF computation (pure function — no I/O)
// ---------------------------------------------------------------------------

export function computeWsjf(input: WsjfInput): number {
  const costOfDelay = input.businessValue + input.timeCriticality + input.riskReduction;
  return Math.round((costOfDelay / input.jobSize) * 100) / 100;
}
