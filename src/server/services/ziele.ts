import type { Result } from "@/domain/errors";
import { ok, err } from "@/domain/errors";
import type { RequestContext } from "@/server/http/mutation-handler";
import { withAuditedTransaction, toMutationContext } from "@/server/services/mutation";
import { recordedUpdate } from "@/server/services/recorded-update";
import { isClosed, isOpen, type GoalStatus } from "@/domain/goal-status";
import { clampPrecision, type MetricType } from "@/domain/goal-metric";

export type GoalTarget = "objective" | "kr";

/**
 * Ziele-Modul-Services (Konzept V2). Reines CRUD + Audit, kein
 * Permission-Check — der laeuft in den Server-Actions (ADR-0002).
 */

// ── Objective ──────────────────────────────────────────────────────────

export interface CreateObjectiveInput {
  /** Optional. Nach Hierarchie-Vereinfachung haengen Objectives an einer
   *  versteckten Default-StrategicTheme; fehlt der Parameter, wird sie
   *  serverseitig find-or-created. */
  themeId?: string | null;
  title: string;
  narrative?: string | null;
  period?: string | null;
  confidence?: number | null;
  ownerId?: string | null;
}

export async function createObjective(
  ctx: RequestContext,
  input: CreateObjectiveInput,
): Promise<Result<{ id: string }>> {
  const mctx = toMutationContext(ctx);
  return withAuditedTransaction(mctx, async (tx) => {
    let themeId = input.themeId;
    if (!themeId) {
      // Default-StrategicTheme (versteckter Modell-Anker fuer flache
      // Hierarchie) suchen oder anlegen.
      const existing = await tx.strategicTheme.findFirst({
        where: { tenantId: mctx.tenantId },
        orderBy: { createdAt: "asc" },
      });
      if (existing) {
        themeId = existing.id;
      } else {
        const created = await tx.strategicTheme.create({
          data: {
            tenantId: mctx.tenantId,
            title: "Default",
            kind: "business",
            color: "#6366f1",
            createdBy: mctx.actorId,
            updatedBy: mctx.actorId,
          },
        });
        themeId = created.id;
      }
    } else {
      const theme = await tx.strategicTheme.findFirst({
        where: { id: themeId, tenantId: mctx.tenantId },
      });
      if (!theme) {
        return err({ kind: "not_found" as const, resourceType: "StrategicTheme", id: themeId });
      }
    }
    const objective = await tx.objective.create({
      data: {
        tenantId: mctx.tenantId,
        themeId,
        title: input.title,
        narrative: input.narrative ?? null,
        period: input.period ?? null,
        confidence: input.confidence ?? null,
        ownerId: input.ownerId ?? null,
        createdBy: mctx.actorId,
        updatedBy: mctx.actorId,
      },
    });
    return ok({
      result: { id: objective.id },
      audit: { action: "objective.created", resourceType: "objective", resourceId: objective.id },
    });
  });
}

export interface UpdateObjectiveInput {
  id: string;
  title?: string;
  narrative?: string | null;
  period?: string | null;
  confidence?: number | null;
  status?: GoalStatus | null;
  dueDate?: Date | null;
  closingNote?: string | null;
  ownerId?: string | null;
}

export async function updateObjective(
  ctx: RequestContext,
  input: UpdateObjectiveInput,
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  return withAuditedTransaction(mctx, async (tx) => {
    const existing = await tx.objective.findFirst({
      where: { id: input.id, tenantId: mctx.tenantId },
    });
    if (!existing) {
      return err({ kind: "not_found" as const, resourceType: "Objective", id: input.id });
    }
    const { changes, data } = recordedUpdate({
      existing,
      updates: {
        title: input.title,
        narrative: input.narrative,
        period: input.period,
        confidence: input.confidence,
        status: input.status,
        dueDate: input.dueDate,
        closingNote: input.closingNote,
        ownerId: input.ownerId,
      },
      fields: [
        "title",
        "narrative",
        "period",
        "confidence",
        "status",
        "dueDate",
        "closingNote",
        "ownerId",
      ] as const,
    });
    // A closed status stamps closedAt; reopening (open status) clears it.
    const closedAt: { closedAt?: Date | null } = {};
    if (input.status !== undefined) {
      if (isClosed(input.status) && existing.closedAt == null) closedAt.closedAt = new Date();
      else if (isOpen(input.status) && existing.closedAt != null) closedAt.closedAt = null;
    }
    await tx.objective.update({
      where: { id: input.id },
      data: { ...data, ...closedAt, updatedBy: mctx.actorId },
    });
    return ok({
      result: undefined,
      audit: {
        action: "objective.updated",
        resourceType: "objective",
        resourceId: input.id,
        changes,
      },
    });
  });
}

export async function deleteObjective(
  ctx: RequestContext,
  input: { id: string },
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  return withAuditedTransaction(mctx, async (tx) => {
    const existing = await tx.objective.findFirst({
      where: { id: input.id, tenantId: mctx.tenantId },
    });
    if (!existing) {
      return err({ kind: "not_found" as const, resourceType: "Objective", id: input.id });
    }
    await tx.objective.delete({ where: { id: input.id } });
    return ok({
      result: undefined,
      audit: { action: "objective.deleted", resourceType: "objective", resourceId: input.id },
    });
  });
}

// ── KeyResult ──────────────────────────────────────────────────────────

export interface CreateKeyResultInput {
  objectiveId: string;
  title: string;
  metricName?: string | null;
  metricUnit?: string | null;
  metricType?: MetricType;
  precision?: number;
  currencyCode?: string | null;
  baseline?: number | null;
  target?: number | null;
  current?: number | null;
  formula?: "auto_from_kpi" | "manual";
  ownerId?: string | null;
}

export async function createKeyResult(
  ctx: RequestContext,
  input: CreateKeyResultInput,
): Promise<Result<{ id: string }>> {
  const mctx = toMutationContext(ctx);
  return withAuditedTransaction(mctx, async (tx) => {
    const objective = await tx.objective.findFirst({
      where: { id: input.objectiveId, tenantId: mctx.tenantId },
    });
    if (!objective) {
      return err({
        kind: "not_found" as const,
        resourceType: "Objective",
        id: input.objectiveId,
      });
    }
    const kr = await tx.keyResult.create({
      data: {
        tenantId: mctx.tenantId,
        objectiveId: input.objectiveId,
        title: input.title,
        metricName: input.metricName ?? null,
        metricUnit: input.metricUnit ?? null,
        ...(input.metricType ? { metricType: input.metricType } : {}),
        ...(input.precision != null ? { precision: clampPrecision(input.precision) } : {}),
        currencyCode: input.currencyCode ?? null,
        baseline: input.baseline ?? null,
        target: input.target ?? null,
        current: input.current ?? null,
        formula: input.formula ?? "auto_from_kpi",
        ownerId: input.ownerId ?? null,
        createdBy: mctx.actorId,
        updatedBy: mctx.actorId,
      },
    });
    return ok({
      result: { id: kr.id },
      audit: { action: "key_result.created", resourceType: "key_result", resourceId: kr.id },
    });
  });
}

export interface UpdateKeyResultInput {
  id: string;
  title?: string;
  metricName?: string | null;
  metricUnit?: string | null;
  metricType?: MetricType;
  precision?: number;
  currencyCode?: string | null;
  baseline?: number | null;
  target?: number | null;
  current?: number | null;
  formula?: "auto_from_kpi" | "manual";
  status?: GoalStatus | null;
  dueDate?: Date | null;
  ownerId?: string | null;
}

export async function updateKeyResult(
  ctx: RequestContext,
  input: UpdateKeyResultInput,
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  return withAuditedTransaction(mctx, async (tx) => {
    const existing = await tx.keyResult.findFirst({
      where: { id: input.id, tenantId: mctx.tenantId },
    });
    if (!existing) {
      return err({ kind: "not_found" as const, resourceType: "KeyResult", id: input.id });
    }
    // Normalise the existing row's Decimal columns to numbers before snapshotting
    // so the audit reads as numeric values, not `Decimal(…)`.
    const existingProjected = {
      title: existing.title,
      metricName: existing.metricName,
      metricUnit: existing.metricUnit,
      metricType: existing.metricType,
      precision: existing.precision,
      currencyCode: existing.currencyCode,
      baseline: existing.baseline != null ? Number(existing.baseline) : null,
      target: existing.target != null ? Number(existing.target) : null,
      current: existing.current != null ? Number(existing.current) : null,
      formula: existing.formula,
      status: existing.status,
      dueDate: existing.dueDate,
      ownerId: existing.ownerId,
    };
    const { changes, data } = recordedUpdate({
      existing: existingProjected,
      updates: {
        title: input.title,
        metricName: input.metricName,
        metricUnit: input.metricUnit,
        metricType: input.metricType,
        precision: input.precision != null ? clampPrecision(input.precision) : input.precision,
        currencyCode: input.currencyCode,
        baseline: input.baseline,
        target: input.target,
        current: input.current,
        formula: input.formula,
        status: input.status,
        dueDate: input.dueDate,
        ownerId: input.ownerId,
      },
      fields: [
        "title",
        "metricName",
        "metricUnit",
        "metricType",
        "precision",
        "currencyCode",
        "baseline",
        "target",
        "current",
        "formula",
        "status",
        "dueDate",
        "ownerId",
      ] as const,
    });
    await tx.keyResult.update({
      where: { id: input.id },
      data: { ...data, updatedBy: mctx.actorId },
    });
    return ok({
      result: undefined,
      audit: {
        action: "key_result.updated",
        resourceType: "key_result",
        resourceId: input.id,
        changes,
      },
    });
  });
}

export async function deleteKeyResult(
  ctx: RequestContext,
  input: { id: string },
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  return withAuditedTransaction(mctx, async (tx) => {
    const existing = await tx.keyResult.findFirst({
      where: { id: input.id, tenantId: mctx.tenantId },
    });
    if (!existing) {
      return err({ kind: "not_found" as const, resourceType: "KeyResult", id: input.id });
    }
    await tx.keyResult.delete({ where: { id: input.id } });
    return ok({
      result: undefined,
      audit: { action: "key_result.deleted", resourceType: "key_result", resourceId: input.id },
    });
  });
}

// ── Goal check-in + comment ─────────────────────────────────────────────

export interface CheckInGoalInput {
  target: GoalTarget;
  id: string;
  status: GoalStatus;
  /** Optional progress snapshot (0..1 rollup or raw KR value). */
  progress?: number | null;
  note?: string | null;
}

/**
 * Records a status/progress check-in on a goal (Objective or Key Result) and
 * stamps the entity's own `status` (+ `current` for a manual KR when a raw
 * value is given). Backs the Asana-style "Update status" flow + history chart.
 */
export async function recordGoalCheckin(
  ctx: RequestContext,
  input: CheckInGoalInput,
): Promise<Result<{ id: string }>> {
  const mctx = toMutationContext(ctx);
  return withAuditedTransaction(mctx, async (tx) => {
    if (input.target === "objective") {
      const existing = await tx.objective.findFirst({
        where: { id: input.id, tenantId: mctx.tenantId },
      });
      if (!existing) {
        return err({ kind: "not_found" as const, resourceType: "Objective", id: input.id });
      }
      const checkin = await tx.goalCheckin.create({
        data: {
          tenantId: mctx.tenantId,
          objectiveId: input.id,
          status: input.status,
          progress: input.progress ?? null,
          note: input.note ?? null,
          createdBy: mctx.actorId,
        },
      });
      await tx.objective.update({
        where: { id: input.id },
        data: {
          status: input.status,
          closedAt: isClosed(input.status) ? (existing.closedAt ?? new Date()) : null,
          updatedBy: mctx.actorId,
        },
      });
      return ok({
        result: { id: checkin.id },
        audit: {
          action: "goal.checkin",
          resourceType: "objective",
          resourceId: input.id,
          changes: { status: { before: existing.status, after: input.status } },
        },
      });
    }

    const existing = await tx.keyResult.findFirst({
      where: { id: input.id, tenantId: mctx.tenantId },
    });
    if (!existing) {
      return err({ kind: "not_found" as const, resourceType: "KeyResult", id: input.id });
    }
    // Freeze the value at check-in time: for a manual KR the raw `current`
    // plus its normalised progress land on the check-in row. `current` itself
    // stays untouched — progress edits flow through recordGoalProgress.
    const isManual = existing.formula === "manual";
    const rawValue = isManual && existing.current != null ? Number(existing.current) : null;
    const frozenProgress = isManual
      ? normalizeKrValue(rawValue, existing.baseline, existing.target)
      : (input.progress ?? null);
    const checkin = await tx.goalCheckin.create({
      data: {
        tenantId: mctx.tenantId,
        keyResultId: input.id,
        status: input.status,
        value: rawValue,
        progress: frozenProgress,
        note: input.note ?? null,
        createdBy: mctx.actorId,
      },
    });
    await tx.keyResult.update({
      where: { id: input.id },
      data: { status: input.status, updatedBy: mctx.actorId },
    });
    return ok({
      result: { id: checkin.id },
      audit: {
        action: "goal.checkin",
        resourceType: "key_result",
        resourceId: input.id,
        changes: { status: { before: existing.status, after: input.status } },
      },
    });
  });
}

export interface RecordGoalProgressInput {
  keyResultId: string;
  /** Raw current value in the KR's metric (e.g. `2` of target 4). */
  value: number;
  /** Optional backdated entry timestamp; defaults to now. */
  entryDate?: Date | null;
}

/**
 * Records a progress-only update on a MANUAL Key Result (Asana "Update
 * progress"): appends a status-less check-in row (raw value + normalised
 * progress) and stamps `keyResult.current`. Auto-KRs are rejected — their
 * progress is aggregated from bound KPIs.
 */
export async function recordGoalProgress(
  ctx: RequestContext,
  input: RecordGoalProgressInput,
): Promise<Result<{ id: string }>> {
  const mctx = toMutationContext(ctx);
  return withAuditedTransaction(mctx, async (tx) => {
    const existing = await tx.keyResult.findFirst({
      where: { id: input.keyResultId, tenantId: mctx.tenantId },
    });
    if (!existing) {
      return err({ kind: "not_found" as const, resourceType: "KeyResult", id: input.keyResultId });
    }
    if (existing.formula !== "manual") {
      return err({
        kind: "validation" as const,
        issues: [
          "Progress wird aus KPIs aggregiert — nur manuelle Key Results sind direkt pflegbar.",
        ],
      });
    }
    const checkin = await tx.goalCheckin.create({
      data: {
        tenantId: mctx.tenantId,
        keyResultId: input.keyResultId,
        status: null,
        value: input.value,
        progress: normalizeKrValue(input.value, existing.baseline, existing.target),
        ...(input.entryDate ? { createdAt: input.entryDate } : {}),
        createdBy: mctx.actorId,
      },
    });
    await tx.keyResult.update({
      where: { id: input.keyResultId },
      data: { current: input.value, updatedBy: mctx.actorId },
    });
    return ok({
      result: { id: checkin.id },
      audit: {
        action: "goal.progress.updated",
        resourceType: "key_result",
        resourceId: input.keyResultId,
        changes: {
          current: {
            before: existing.current != null ? Number(existing.current) : null,
            after: input.value,
          },
        },
      },
    });
  });
}

/** Normalised 0..1 progress for a raw KR value; null when the span is unknown. */
function normalizeKrValue(value: number | null, baseline: unknown, target: unknown): number | null {
  if (value == null) return null;
  const b = baseline != null ? Number(baseline) : null;
  const t = target != null ? Number(target) : null;
  if (b == null || t == null || t === b) return null;
  return Math.max(0, Math.min(1, (value - b) / (t - b)));
}

export interface AddGoalCommentInput {
  target: GoalTarget;
  id: string;
  body: string;
}

/** Appends a free-text comment to a goal's activity feed. */
export async function addGoalComment(
  ctx: RequestContext,
  input: AddGoalCommentInput,
): Promise<Result<{ id: string }>> {
  const mctx = toMutationContext(ctx);
  return withAuditedTransaction(mctx, async (tx) => {
    const isObjective = input.target === "objective";
    const owner = isObjective
      ? await tx.objective.findFirst({ where: { id: input.id, tenantId: mctx.tenantId } })
      : await tx.keyResult.findFirst({ where: { id: input.id, tenantId: mctx.tenantId } });
    if (!owner) {
      return err({
        kind: "not_found" as const,
        resourceType: isObjective ? "Objective" : "KeyResult",
        id: input.id,
      });
    }
    const comment = await tx.goalComment.create({
      data: {
        tenantId: mctx.tenantId,
        objectiveId: isObjective ? input.id : null,
        keyResultId: isObjective ? null : input.id,
        body: input.body,
        createdBy: mctx.actorId,
      },
    });
    return ok({
      result: { id: comment.id },
      audit: {
        action: "goal.comment.added",
        resourceType: isObjective ? "objective" : "key_result",
        resourceId: input.id,
      },
    });
  });
}
