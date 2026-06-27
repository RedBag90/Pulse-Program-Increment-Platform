import type { Result } from "@/domain/errors";
import { ok, err } from "@/domain/errors";
import type { RequestContext } from "@/server/http/mutation-handler";
import { withAuditedTransaction, toMutationContext } from "@/server/services/mutation";
import { recordedUpdate } from "@/server/services/recorded-update";

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
  status?: string;
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
        closingNote: input.closingNote,
        ownerId: input.ownerId,
      },
      fields: [
        "title",
        "narrative",
        "period",
        "confidence",
        "status",
        "closingNote",
        "ownerId",
      ] as const,
    });
    await tx.objective.update({
      where: { id: input.id },
      data: { ...data, updatedBy: mctx.actorId },
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
  baseline?: number | null;
  target?: number | null;
  current?: number | null;
  formula?: "auto_from_kpi" | "manual";
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
      baseline: existing.baseline != null ? Number(existing.baseline) : null,
      target: existing.target != null ? Number(existing.target) : null,
      current: existing.current != null ? Number(existing.current) : null,
      formula: existing.formula,
      ownerId: existing.ownerId,
    };
    const { changes, data } = recordedUpdate({
      existing: existingProjected,
      updates: {
        title: input.title,
        metricName: input.metricName,
        metricUnit: input.metricUnit,
        baseline: input.baseline,
        target: input.target,
        current: input.current,
        formula: input.formula,
        ownerId: input.ownerId,
      },
      fields: [
        "title",
        "metricName",
        "metricUnit",
        "baseline",
        "target",
        "current",
        "formula",
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
