import type { Result } from "@/domain/errors";
import { ok, err } from "@/domain/errors";
import { checkKpiBinding } from "@/domain/kpi-binding-invariant";
import type { RequestContext } from "@/server/http/mutation-handler";
import { withAuditedTransaction, toMutationContext } from "@/server/services/mutation";

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
    await tx.objective.update({
      where: { id: input.id },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.narrative !== undefined ? { narrative: input.narrative } : {}),
        ...(input.period !== undefined ? { period: input.period } : {}),
        ...(input.confidence !== undefined ? { confidence: input.confidence } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.closingNote !== undefined ? { closingNote: input.closingNote } : {}),
        ...(input.ownerId !== undefined ? { ownerId: input.ownerId } : {}),
        updatedBy: mctx.actorId,
      },
    });
    return ok({
      result: undefined,
      audit: { action: "objective.updated", resourceType: "objective", resourceId: input.id },
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
    await tx.keyResult.update({
      where: { id: input.id },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.metricName !== undefined ? { metricName: input.metricName } : {}),
        ...(input.metricUnit !== undefined ? { metricUnit: input.metricUnit } : {}),
        ...(input.baseline !== undefined ? { baseline: input.baseline } : {}),
        ...(input.target !== undefined ? { target: input.target } : {}),
        ...(input.current !== undefined ? { current: input.current } : {}),
        ...(input.formula !== undefined ? { formula: input.formula } : {}),
        ...(input.ownerId !== undefined ? { ownerId: input.ownerId } : {}),
        updatedBy: mctx.actorId,
      },
    });
    return ok({
      result: undefined,
      audit: { action: "key_result.updated", resourceType: "key_result", resourceId: input.id },
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

// ── KR ↔ KPI Contribution ──────────────────────────────────────────────

/**
 * Atomic Re-Bind (Pyramid-konform): setzt die KR-Bindung einer KPI auf
 * `keyResultId` (oder loest sie, wenn `null`) in EINER Transaktion und
 * unter der Pyramid-Invariante (jede KPI an max. 1 KR). Die Planung der
 * Mutation lebt im Domain-Modul `kpi-binding-invariant`; dieser Service
 * fuehrt den Plan gegen die DB aus und schreibt das Audit-Event.
 */
export async function setKpiBinding(
  ctx: RequestContext,
  input: {
    kpiId: string;
    /** null = kein KR (ungebunden) */
    keyResultId: string | null;
    weight?: number | null;
    valuePerUnitOverride?: number | null;
  },
): Promise<Result<{ kpiId: string }>> {
  const mctx = toMutationContext(ctx);
  return withAuditedTransaction(mctx, async (tx) => {
    const existing = await tx.krKpiContribution.findFirst({
      where: { tenantId: mctx.tenantId, kpiId: input.kpiId },
    });

    const planResult = checkKpiBinding({
      kpiId: input.kpiId,
      targetKeyResultId: input.keyResultId,
      existing: existing ? { kpiId: existing.kpiId, keyResultId: existing.keyResultId } : null,
    });
    if (!planResult.ok) return planResult;
    const plan = planResult.value;

    switch (plan.kind) {
      case "noop": {
        // Werte koennen sich trotzdem geaendert haben (Inline-Edit von
        // weight/override in der Coverage-Tabelle ohne KR-Wechsel).
        if (existing && (input.weight !== undefined || input.valuePerUnitOverride !== undefined)) {
          await tx.krKpiContribution.update({
            where: { id: existing.id },
            data: {
              weight: input.weight ?? Number(existing.weight),
              valuePerUnitOverride:
                input.valuePerUnitOverride !== undefined
                  ? input.valuePerUnitOverride
                  : existing.valuePerUnitOverride,
            },
          });
          return ok({
            result: { kpiId: input.kpiId },
            audit: {
              action: "key_result.kpi.updated",
              resourceType: "kr_kpi_contribution",
              resourceId: existing.id,
            },
          });
        }
        return ok({
          result: { kpiId: input.kpiId },
          audit: {
            action: "key_result.kpi.unbound",
            resourceType: "kr_kpi_contribution",
            resourceId: existing?.id ?? input.kpiId,
          },
        });
      }
      case "delete": {
        await tx.krKpiContribution.delete({ where: { id: existing!.id } });
        return ok({
          result: { kpiId: input.kpiId },
          audit: {
            action: "key_result.kpi.unbound",
            resourceType: "kr_kpi_contribution",
            resourceId: existing!.id,
          },
        });
      }
      case "rebind": {
        await tx.krKpiContribution.delete({ where: { id: existing!.id } });
      }
      // fallthrough → create
      case "create": {
        const kr = await tx.keyResult.findFirst({
          where: {
            id: plan.kind === "rebind" ? plan.toKeyResultId : plan.keyResultId,
            tenantId: mctx.tenantId,
          },
        });
        if (!kr) {
          return err({
            kind: "not_found" as const,
            resourceType: "KeyResult",
            id: plan.kind === "rebind" ? plan.toKeyResultId : plan.keyResultId,
          });
        }
        const created = await tx.krKpiContribution.create({
          data: {
            tenantId: mctx.tenantId,
            keyResultId: kr.id,
            kpiId: input.kpiId,
            weight: input.weight ?? 1,
            valuePerUnitOverride: input.valuePerUnitOverride ?? null,
            createdBy: mctx.actorId,
          },
        });
        return ok({
          result: { kpiId: input.kpiId },
          audit: {
            action: "key_result.kpi.bound",
            resourceType: "kr_kpi_contribution",
            resourceId: created.id,
          },
        });
      }
    }
  });
}
