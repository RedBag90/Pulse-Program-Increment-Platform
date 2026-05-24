import type { Prisma } from "@/generated/prisma";
import type { PrismaClient } from "@/generated/prisma";
import type { TenantId, EpicId, ValueStreamId, StageGate } from "@/domain/types";
import { InitiativeLevel } from "@/domain/types";
import type { Result } from "@/domain/errors";
import { ok, err } from "@/domain/errors";
import { buildChangelog } from "@/domain/change-log";
import { isValidTransition, isApprovalTransition } from "@/domain/stage-gate";
import type { RequestContext } from "@/server/http/mutation-handler";
import { withAuditedTransaction, toMutationContext } from "@/server/services/mutation";
import { effectivePractices } from "@/domain/operating-model";
import {
  parseBenefitHypothesis,
  benefitHypothesisHasContent,
  type BenefitHypothesisFields,
  type BenefitHypothesis,
} from "@/domain/benefit-hypothesis";
import {
  parseBusinessCase,
  businessCaseHasContent,
  type BusinessCaseFields,
  type BusinessCase,
} from "@/domain/business-case";
import type { TimelineFields } from "@/domain/timeline";

// ---------------------------------------------------------------------------
// Create Epic (level 0)
// ---------------------------------------------------------------------------

export interface CreateEpicInput {
  title: string;
  description?: string | undefined;
  valueStreamId: ValueStreamId;
}

export async function createEpic(
  ctx: RequestContext,
  input: CreateEpicInput,
): Promise<Result<{ id: EpicId }>> {
  const mctx = toMutationContext(ctx);
  const { title, description, valueStreamId } = input;

  return withAuditedTransaction(mctx, async (tx) => {
    // Verify the value stream belongs to the same tenant (cross-tenant guard).
    const vs = await tx.valueStream.findFirst({
      where: { id: valueStreamId, tenantId: mctx.tenantId },
    });
    if (!vs) {
      return err({ kind: "not_found" as const, resourceType: "ValueStream", id: valueStreamId });
    }

    const epic = await tx.initiative.create({
      data: {
        tenantId: mctx.tenantId,
        level: InitiativeLevel.EPIC,
        title,
        path: "", // Updated below, once the ID is known.
        ownerId: mctx.actorId,
        assigneeIds: [],
        createdBy: mctx.actorId,
        updatedBy: mctx.actorId,
        valueStreamId,
        approvalPhase: "draft",
        ...(description !== undefined && { description }),
      },
    });

    // Materialized path: root-level epics use their own ID.
    await tx.initiative.update({ where: { id: epic.id }, data: { path: epic.id } });

    return ok({
      result: { id: epic.id as EpicId },
      audit: { action: "initiative.created", resourceType: "initiative", resourceId: epic.id },
    });
  });
}

// ---------------------------------------------------------------------------
// Update Epic
// ---------------------------------------------------------------------------

export interface UpdateEpicInput {
  id: EpicId;
  title?: string | undefined;
  description?: string | undefined;
  needsSteeringAttention?: boolean | undefined;
  stagedForBudgeting?: boolean | undefined;
}

export async function updateEpic(
  ctx: RequestContext,
  input: UpdateEpicInput,
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  const { id, title, description, needsSteeringAttention, stagedForBudgeting } = input;

  return withAuditedTransaction(mctx, async (tx) => {
    const existing = await tx.initiative.findFirst({
      where: { id, tenantId: mctx.tenantId, level: InitiativeLevel.EPIC, deletedAt: null },
    });
    if (!existing) {
      return err({ kind: "not_found" as const, resourceType: "Epic", id });
    }

    const changes = buildChangelog(
      {
        title: existing.title,
        description: existing.description,
        needsSteeringAttention: existing.needsSteeringAttention,
        stagedForBudgeting: existing.stagedForBudgeting,
      },
      {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(needsSteeringAttention !== undefined && { needsSteeringAttention }),
        ...(stagedForBudgeting !== undefined && { stagedForBudgeting }),
      },
      ["title", "description", "needsSteeringAttention", "stagedForBudgeting"],
    );

    await tx.initiative.update({
      where: { id },
      data: {
        updatedBy: mctx.actorId,
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(needsSteeringAttention !== undefined && { needsSteeringAttention }),
        ...(stagedForBudgeting !== undefined && { stagedForBudgeting }),
      },
    });

    return ok({
      result: undefined,
      audit: { action: "initiative.updated", resourceType: "initiative", resourceId: id, changes },
    });
  });
}

// ---------------------------------------------------------------------------
// Advance stage gate
// ---------------------------------------------------------------------------

export interface AdvanceStageGateInput {
  epicId: EpicId;
  toGate: StageGate;
  comment?: string | undefined;
}

/**
 * Advances (or steps back) an Epic's stage gate. Reaching L3 is the approval
 * decision — the approver, timestamp, and comment are persisted on the Epic so
 * they are visible without reading the audit log.
 */
export async function advanceStageGate(
  ctx: RequestContext,
  input: AdvanceStageGateInput,
): Promise<Result<{ from: StageGate; to: StageGate }>> {
  const mctx = toMutationContext(ctx);
  const { epicId, toGate, comment } = input;

  return withAuditedTransaction(mctx, async (tx) => {
    // Stage gates only exist when the target operating model enables them. With
    // them switched off the portfolio shows a flat epic list and exposes no
    // "advance" affordance — reject any request that reaches the action anyway.
    const targetModel = await tx.targetOperatingModel.findFirst({
      where: { tenantId: mctx.tenantId, status: "active" },
      orderBy: { updatedAt: "desc" },
    });
    const practices = effectivePractices(targetModel);
    if (!practices.stageGates) {
      return err({
        kind: "forbidden" as const,
        reason: "Stage gates are not part of this tenant's target operating model",
      });
    }

    const epic = await tx.initiative.findFirst({
      where: { id: epicId, tenantId: mctx.tenantId, level: InitiativeLevel.EPIC, deletedAt: null },
    });
    if (!epic) {
      return err({ kind: "not_found" as const, resourceType: "Epic", id: epicId });
    }

    const from = epic.stageGate as StageGate;
    if (!isValidTransition(from, toGate)) {
      return err({
        kind: "hierarchy_violation" as const,
        violatedConstraint: "stage_gate_transition",
        detail: `Cannot transition from ${from} to ${toGate}`,
      });
    }

    const isApproval = isApprovalTransition(from, toGate);

    await tx.initiative.update({
      where: { id: epicId },
      data: {
        stageGate: toGate,
        updatedBy: mctx.actorId,
        ...(isApproval && {
          approvedBy: mctx.actorId,
          approvedAt: new Date(),
          approvalComment: comment ?? null,
        }),
      },
    });

    return ok({
      result: { from, to: toGate },
      audit: {
        action: "initiative.stage_gate.advanced" as const,
        resourceType: "initiative" as const,
        resourceId: epicId,
        changes: {
          stageGate: { before: from, after: toGate },
          ...(comment !== undefined && { comment: { before: null, after: comment } }),
        },
      },
    });
  });
}

// ---------------------------------------------------------------------------
// Save Epic artefacts — Benefit Hypothesis & Business Case (both versioned)
// ---------------------------------------------------------------------------

/** Most recent artefact versions to keep, to bound the JSON size. */
const ARTEFACT_HISTORY_LIMIT = 20;

export interface SaveBenefitHypothesisInput {
  epicId: EpicId;
  fields: BenefitHypothesisFields;
}

/**
 * Saves the Benefit Hypothesis for an Epic, keeping a version history: the
 * previous `current` (if it had content) is pushed onto `history`.
 */
export async function saveBenefitHypothesis(
  ctx: RequestContext,
  input: SaveBenefitHypothesisInput,
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  const { epicId, fields } = input;

  return withAuditedTransaction(mctx, async (tx) => {
    const existing = await tx.initiative.findFirst({
      where: { id: epicId, tenantId: mctx.tenantId, level: InitiativeLevel.EPIC, deletedAt: null },
    });
    if (!existing) {
      return err({ kind: "not_found" as const, resourceType: "Epic", id: epicId });
    }

    const prev = parseBenefitHypothesis(existing.benefitHypothesis);
    const history = benefitHypothesisHasContent(prev.current)
      ? [
          { content: prev.current, savedAt: new Date().toISOString(), savedBy: mctx.actorId },
          ...prev.history,
        ].slice(0, ARTEFACT_HISTORY_LIMIT)
      : prev.history;

    const next: BenefitHypothesis = { current: fields, history };

    await tx.initiative.update({
      where: { id: epicId },
      data: {
        updatedBy: mctx.actorId,
        benefitHypothesis: next as unknown as Prisma.InputJsonValue,
      },
    });

    return ok({
      result: undefined,
      audit: { action: "initiative.updated", resourceType: "initiative", resourceId: epicId },
    });
  });
}

export interface SaveBusinessCaseInput {
  epicId: EpicId;
  fields: BusinessCaseFields;
}

/**
 * Saves the Business Case for an Epic, keeping a version history: the previous
 * `current` (if it had content) is pushed onto `history`.
 */
export async function saveBusinessCase(
  ctx: RequestContext,
  input: SaveBusinessCaseInput,
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  const { epicId, fields } = input;

  return withAuditedTransaction(mctx, async (tx) => {
    const existing = await tx.initiative.findFirst({
      where: { id: epicId, tenantId: mctx.tenantId, level: InitiativeLevel.EPIC, deletedAt: null },
    });
    if (!existing) {
      return err({ kind: "not_found" as const, resourceType: "Epic", id: epicId });
    }

    const prev = parseBusinessCase(existing.businessCase);
    const history = businessCaseHasContent(prev.current)
      ? [
          { content: prev.current, savedAt: new Date().toISOString(), savedBy: mctx.actorId },
          ...prev.history,
        ].slice(0, ARTEFACT_HISTORY_LIMIT)
      : prev.history;

    const next: BusinessCase = { current: fields, history };

    await tx.initiative.update({
      where: { id: epicId },
      data: {
        updatedBy: mctx.actorId,
        businessCase: next as unknown as Prisma.InputJsonValue,
      },
    });

    return ok({
      result: undefined,
      audit: { action: "initiative.updated", resourceType: "initiative", resourceId: epicId },
    });
  });
}

// ---------------------------------------------------------------------------
// Timeline — owner estimates + manual actuals; Implementation actual ⇒ Done
// ---------------------------------------------------------------------------

export interface SaveTimelineInput {
  epicId: EpicId;
  fields: TimelineFields;
}

/**
 * Saves the owner-controlled timeline (estimates + the manual Backlog/
 * Implementation actuals). Setting the Implementation actual is the one
 * lifecycle coupling: it marks the Epic Done (stage gate → L5).
 */
export async function saveTimeline(
  ctx: RequestContext,
  input: SaveTimelineInput,
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  const { epicId, fields } = input;

  return withAuditedTransaction(mctx, async (tx) => {
    const existing = await tx.initiative.findFirst({
      where: { id: epicId, tenantId: mctx.tenantId, level: InitiativeLevel.EPIC, deletedAt: null },
    });
    if (!existing) return err({ kind: "not_found" as const, resourceType: "Epic", id: epicId });

    const reachedDone = Boolean(fields.actuals.implementation) && existing.stageGate !== "L5";

    await tx.initiative.update({
      where: { id: epicId },
      data: {
        updatedBy: mctx.actorId,
        timeline: fields as unknown as Prisma.InputJsonValue,
        ...(reachedDone && { stageGate: "L5" }),
      },
    });

    return ok({
      result: undefined,
      audit: reachedDone
        ? {
            action: "initiative.stage_gate.advanced",
            resourceType: "initiative",
            resourceId: epicId,
            changes: { stageGate: { before: existing.stageGate, after: "L5" } },
          }
        : { action: "initiative.updated", resourceType: "initiative", resourceId: epicId },
    });
  });
}

// ---------------------------------------------------------------------------
// Assign Epic Owner (VMO)
// ---------------------------------------------------------------------------

export async function assignEpicOwner(
  ctx: RequestContext,
  input: { epicId: EpicId; ownerId: string },
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  const { epicId, ownerId } = input;

  return withAuditedTransaction(mctx, async (tx) => {
    const existing = await tx.initiative.findFirst({
      where: { id: epicId, tenantId: mctx.tenantId, level: InitiativeLevel.EPIC, deletedAt: null },
    });
    if (!existing) return err({ kind: "not_found" as const, resourceType: "Epic", id: epicId });

    const changes = buildChangelog({ ownerId: existing.ownerId }, { ownerId }, ["ownerId"]);
    await tx.initiative.update({
      where: { id: epicId },
      data: { ownerId, updatedBy: mctx.actorId },
    });

    return ok({
      result: undefined,
      audit: {
        action: "epic.owner.assigned",
        resourceType: "initiative",
        resourceId: epicId,
        changes,
      },
    });
  });
}

// ---------------------------------------------------------------------------
// Delete Epic (soft)
// ---------------------------------------------------------------------------

export async function softDeleteEpic(
  ctx: RequestContext,
  input: { id: EpicId },
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  const { id } = input;

  return withAuditedTransaction(mctx, async (tx) => {
    const existing = await tx.initiative.findFirst({
      where: { id, tenantId: mctx.tenantId, level: InitiativeLevel.EPIC, deletedAt: null },
    });
    if (!existing) return err({ kind: "not_found" as const, resourceType: "Epic", id });

    // Cascade soft-delete to all child features and their stories.
    const features = await tx.initiative.findMany({
      where: {
        parentId: id,
        tenantId: mctx.tenantId,
        level: InitiativeLevel.FEATURE,
        deletedAt: null,
      },
      select: { id: true },
    });
    const featureIds = features.map((f) => f.id);

    if (featureIds.length > 0) {
      await tx.initiative.updateMany({
        where: {
          parentId: { in: featureIds },
          tenantId: mctx.tenantId,
          level: InitiativeLevel.STORY,
        },
        data: { deletedAt: new Date(), updatedBy: mctx.actorId },
      });
      await tx.initiative.updateMany({
        where: { id: { in: featureIds }, tenantId: mctx.tenantId },
        data: { deletedAt: new Date(), updatedBy: mctx.actorId },
      });
    }

    await tx.initiative.update({
      where: { id },
      data: { deletedAt: new Date(), updatedBy: mctx.actorId },
    });

    return ok({
      result: undefined,
      audit: { action: "initiative.deleted", resourceType: "initiative", resourceId: id },
    });
  });
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function listEpics(db: PrismaClient, tenantId: TenantId) {
  return db.initiative.findMany({
    where: { tenantId, level: InitiativeLevel.EPIC, deletedAt: null },
    include: { valueStream: { select: { id: true, name: true } } },
    orderBy: [{ stageGate: "asc" }, { createdAt: "desc" }],
  });
}

export async function getEpic(db: PrismaClient, tenantId: TenantId, id: EpicId) {
  return db.initiative.findFirst({
    where: { id, tenantId, level: InitiativeLevel.EPIC, deletedAt: null },
    include: {
      valueStream: { select: { id: true, name: true, financeApproverId: true, vmoId: true } },
      children: {
        where: { deletedAt: null },
        select: {
          id: true,
          title: true,
          level: true,
          status: true,
          description: true,
          artId: true,
          piId: true,
          acceptanceCriteria: true,
          wsjfBusinessValue: true,
          wsjfTimeCriticality: true,
          wsjfRiskReduction: true,
          wsjfJobSize: true,
          wsjfComputed: true,
          art: { select: { id: true, name: true } },
        },
        orderBy: { wsjfComputed: "desc" },
      },
    },
  });
}
