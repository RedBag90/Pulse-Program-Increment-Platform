import type { InitiativeId, TenantId } from "@/domain/types";
import type { Result } from "@/domain/errors";
import { ok, err } from "@/domain/errors";
import type { RequestContext } from "@/server/http/mutation-handler";
import { withAuditedTransaction, toMutationContext } from "@/server/services/mutation";

/**
 * Ziele-Modul-Services (Konzept V2). Reines CRUD + Audit, kein
 * Permission-Check — der laeuft in den Server-Actions (ADR-0002).
 */

// ── Strategic Theme ────────────────────────────────────────────────────

export interface CreateThemeInput {
  title: string;
  narrative?: string | null;
  color?: string;
  kind?: "business" | "enabler";
  budgetPlanned?: number | null;
  visionId?: string | null;
  ownerId?: string | null;
}

export async function createTheme(
  ctx: RequestContext,
  input: CreateThemeInput,
): Promise<Result<{ id: string }>> {
  const mctx = toMutationContext(ctx);
  return withAuditedTransaction(mctx, async (tx) => {
    const theme = await tx.strategicTheme.create({
      data: {
        tenantId: mctx.tenantId,
        title: input.title,
        narrative: input.narrative ?? null,
        color: input.color ?? "#6366f1",
        kind: input.kind ?? "business",
        budgetPlanned: input.budgetPlanned ?? null,
        visionId: input.visionId ?? null,
        ownerId: input.ownerId ?? null,
        createdBy: mctx.actorId,
        updatedBy: mctx.actorId,
      },
    });
    return ok({
      result: { id: theme.id },
      audit: { action: "theme.created", resourceType: "strategic_theme", resourceId: theme.id },
    });
  });
}

export interface UpdateThemeInput {
  id: string;
  title?: string;
  narrative?: string | null;
  color?: string;
  kind?: "business" | "enabler";
  budgetPlanned?: number | null;
  visionId?: string | null;
  ownerId?: string | null;
  status?: string;
}

export async function updateTheme(
  ctx: RequestContext,
  input: UpdateThemeInput,
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  return withAuditedTransaction(mctx, async (tx) => {
    const existing = await tx.strategicTheme.findFirst({
      where: { id: input.id, tenantId: mctx.tenantId },
    });
    if (!existing) {
      return err({ kind: "not_found" as const, resourceType: "StrategicTheme", id: input.id });
    }
    await tx.strategicTheme.update({
      where: { id: input.id },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.narrative !== undefined ? { narrative: input.narrative } : {}),
        ...(input.color !== undefined ? { color: input.color } : {}),
        ...(input.kind !== undefined ? { kind: input.kind } : {}),
        ...(input.budgetPlanned !== undefined ? { budgetPlanned: input.budgetPlanned } : {}),
        ...(input.visionId !== undefined ? { visionId: input.visionId } : {}),
        ...(input.ownerId !== undefined ? { ownerId: input.ownerId } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        updatedBy: mctx.actorId,
      },
    });
    return ok({
      result: undefined,
      audit: { action: "theme.updated", resourceType: "strategic_theme", resourceId: input.id },
    });
  });
}

export async function deleteTheme(
  ctx: RequestContext,
  input: { id: string },
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  return withAuditedTransaction(mctx, async (tx) => {
    const existing = await tx.strategicTheme.findFirst({
      where: { id: input.id, tenantId: mctx.tenantId },
    });
    if (!existing) {
      return err({ kind: "not_found" as const, resourceType: "StrategicTheme", id: input.id });
    }
    await tx.strategicTheme.delete({ where: { id: input.id } });
    return ok({
      result: undefined,
      audit: { action: "theme.deleted", resourceType: "strategic_theme", resourceId: input.id },
    });
  });
}

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

export interface BindKpiInput {
  keyResultId: string;
  kpiId: string;
  weight?: number;
  valuePerUnitOverride?: number | null;
}

export async function bindKpiToKeyResult(
  ctx: RequestContext,
  input: BindKpiInput,
): Promise<Result<{ id: string }>> {
  const mctx = toMutationContext(ctx);
  return withAuditedTransaction(mctx, async (tx) => {
    const [kr, kpi] = await Promise.all([
      tx.keyResult.findFirst({ where: { id: input.keyResultId, tenantId: mctx.tenantId } }),
      tx.kpi.findFirst({ where: { id: input.kpiId, tenantId: mctx.tenantId } }),
    ]);
    if (!kr)
      return err({ kind: "not_found" as const, resourceType: "KeyResult", id: input.keyResultId });
    if (!kpi) return err({ kind: "not_found" as const, resourceType: "Kpi", id: input.kpiId });
    const existing = await tx.krKpiContribution.findUnique({
      where: { keyResultId_kpiId: { keyResultId: input.keyResultId, kpiId: input.kpiId } },
    });
    if (existing) {
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
        result: { id: existing.id },
        audit: {
          action: "key_result.kpi.updated",
          resourceType: "kr_kpi_contribution",
          resourceId: existing.id,
        },
      });
    }
    const created = await tx.krKpiContribution.create({
      data: {
        tenantId: mctx.tenantId,
        keyResultId: input.keyResultId,
        kpiId: input.kpiId,
        weight: input.weight ?? 1,
        valuePerUnitOverride: input.valuePerUnitOverride ?? null,
        createdBy: mctx.actorId,
      },
    });
    return ok({
      result: { id: created.id },
      audit: {
        action: "key_result.kpi.bound",
        resourceType: "kr_kpi_contribution",
        resourceId: created.id,
      },
    });
  });
}

export async function unbindKpiFromKeyResult(
  ctx: RequestContext,
  input: { keyResultId: string; kpiId: string },
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  return withAuditedTransaction(mctx, async (tx) => {
    const existing = await tx.krKpiContribution.findUnique({
      where: { keyResultId_kpiId: { keyResultId: input.keyResultId, kpiId: input.kpiId } },
    });
    if (!existing || existing.tenantId !== mctx.tenantId) {
      return err({ kind: "not_found" as const, resourceType: "KrKpiContribution", id: "" });
    }
    await tx.krKpiContribution.delete({ where: { id: existing.id } });
    return ok({
      result: undefined,
      audit: {
        action: "key_result.kpi.unbound",
        resourceType: "kr_kpi_contribution",
        resourceId: existing.id,
      },
    });
  });
}

/**
 * Atomic Re-Bind (Pyramid-konform): setzt die KR-Bindung einer KPI auf
 * `keyResultId` (oder loest sie auf, wenn `null`), in EINER Transaktion.
 *
 * Use-Case: KPI-Coverage-Tabelle, in der pro KPI-Zeile inline der
 * Ziel-KR per Dropdown gewaehlt wird. Damit die 1:1-Regel (jede KPI
 * haengt an max. einem KR) auch bei Re-Bind sauber bleibt, geschieht
 * Loesen-vom-alten + Binden-an-neuen atomar.
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

    // Fall 1: ziel-KR ist null → bestehende Bindung loesen (oder no-op)
    if (input.keyResultId == null) {
      if (!existing) {
        return ok({
          result: { kpiId: input.kpiId },
          audit: {
            action: "key_result.kpi.unbound",
            resourceType: "kr_kpi_contribution",
            resourceId: input.kpiId,
          },
        });
      }
      await tx.krKpiContribution.delete({ where: { id: existing.id } });
      return ok({
        result: { kpiId: input.kpiId },
        audit: {
          action: "key_result.kpi.unbound",
          resourceType: "kr_kpi_contribution",
          resourceId: existing.id,
        },
      });
    }

    // Fall 2: bestehende Bindung ist identisch zum Ziel-KR → nur Felder aktualisieren
    if (existing && existing.keyResultId === input.keyResultId) {
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

    // Fall 3: Re-Bind — alte Bindung loeschen, neue anlegen
    if (existing) {
      await tx.krKpiContribution.delete({ where: { id: existing.id } });
    }
    // Ziel-KR muss zum Tenant gehoeren
    const kr = await tx.keyResult.findFirst({
      where: { id: input.keyResultId, tenantId: mctx.tenantId },
    });
    if (!kr) {
      return err({
        kind: "not_found" as const,
        resourceType: "KeyResult",
        id: input.keyResultId,
      });
    }
    const created = await tx.krKpiContribution.create({
      data: {
        tenantId: mctx.tenantId,
        keyResultId: input.keyResultId,
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
  });
}

// ── Theme ↔ Epic Link ──────────────────────────────────────────────────

export async function linkEpicToTheme(
  ctx: RequestContext,
  input: { themeId: string; epicId: InitiativeId },
): Promise<Result<{ id: string }>> {
  const mctx = toMutationContext(ctx);
  return withAuditedTransaction(mctx, async (tx) => {
    const theme = await tx.strategicTheme.findFirst({
      where: { id: input.themeId, tenantId: mctx.tenantId },
    });
    if (!theme) {
      return err({ kind: "not_found" as const, resourceType: "StrategicTheme", id: input.themeId });
    }
    const existing = await tx.themeEpicLink.findUnique({
      where: { themeId_epicId: { themeId: input.themeId, epicId: input.epicId } },
    });
    if (existing) {
      return ok({
        result: { id: existing.id },
        audit: {
          action: "theme.epic.link.exists",
          resourceType: "theme_epic_link",
          resourceId: existing.id,
        },
      });
    }
    const created = await tx.themeEpicLink.create({
      data: {
        tenantId: mctx.tenantId,
        themeId: input.themeId,
        epicId: input.epicId,
        createdBy: mctx.actorId,
      },
    });
    return ok({
      result: { id: created.id },
      audit: {
        action: "theme.epic.linked",
        resourceType: "theme_epic_link",
        resourceId: created.id,
      },
    });
  });
}

export async function unlinkEpicFromTheme(
  ctx: RequestContext,
  input: { themeId: string; epicId: InitiativeId },
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  return withAuditedTransaction(mctx, async (tx) => {
    const existing = await tx.themeEpicLink.findUnique({
      where: { themeId_epicId: { themeId: input.themeId, epicId: input.epicId } },
    });
    if (!existing || existing.tenantId !== mctx.tenantId) {
      return err({ kind: "not_found" as const, resourceType: "ThemeEpicLink", id: "" });
    }
    await tx.themeEpicLink.delete({ where: { id: existing.id } });
    return ok({
      result: undefined,
      audit: {
        action: "theme.epic.unlinked",
        resourceType: "theme_epic_link",
        resourceId: existing.id,
      },
    });
  });
}

// ── Vision (minimal) ───────────────────────────────────────────────────

export interface CreateVisionInput {
  scope: "tenant" | "value_stream";
  valueStreamId?: string | null;
  title: string;
  narrative?: string | null;
  horizonStart: Date;
  horizonEnd: Date;
  ownerId?: string | null;
}

export async function createVision(
  ctx: RequestContext,
  input: CreateVisionInput,
): Promise<Result<{ id: string }>> {
  const mctx = toMutationContext(ctx);
  return withAuditedTransaction(mctx, async (tx) => {
    const v = await tx.portfolioVision.create({
      data: {
        tenantId: mctx.tenantId as TenantId,
        scope: input.scope,
        valueStreamId: input.valueStreamId ?? null,
        title: input.title,
        narrative: input.narrative ?? null,
        horizonStart: input.horizonStart,
        horizonEnd: input.horizonEnd,
        ownerId: input.ownerId ?? null,
        status: "published",
        createdBy: mctx.actorId,
        updatedBy: mctx.actorId,
      },
    });
    return ok({
      result: { id: v.id },
      audit: { action: "vision.created", resourceType: "portfolio_vision", resourceId: v.id },
    });
  });
}

export interface UpdateVisionInput {
  id: string;
  title?: string;
  narrative?: string | null;
  horizonStart?: Date;
  horizonEnd?: Date;
  ownerId?: string | null;
  status?: string;
}

export async function updateVision(
  ctx: RequestContext,
  input: UpdateVisionInput,
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  return withAuditedTransaction(mctx, async (tx) => {
    const existing = await tx.portfolioVision.findFirst({
      where: { id: input.id, tenantId: mctx.tenantId },
    });
    if (!existing) {
      return err({ kind: "not_found" as const, resourceType: "PortfolioVision", id: input.id });
    }
    await tx.portfolioVision.update({
      where: { id: input.id },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.narrative !== undefined ? { narrative: input.narrative } : {}),
        ...(input.horizonStart !== undefined ? { horizonStart: input.horizonStart } : {}),
        ...(input.horizonEnd !== undefined ? { horizonEnd: input.horizonEnd } : {}),
        ...(input.ownerId !== undefined ? { ownerId: input.ownerId } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        updatedBy: mctx.actorId,
      },
    });
    return ok({
      result: undefined,
      audit: { action: "vision.updated", resourceType: "portfolio_vision", resourceId: input.id },
    });
  });
}
