/**
 * Solution-Mutationen (SAFe Lean Portfolio Management). Solutions sind
 * tenant-weite Portfolio-Katalog-Entitäten (VS Pflicht, ein ART optional) mit
 * einem Investitionshorizont, der an die zugeordneten Epics vererbt wird.
 *
 * Lifecycle-Wechsel laufen über explizite Aktionen: freier `setSolutionLifecycle`
 * + das Transition-Gate `promoteSolution` (H2→H1, nur mit allen 4 Kriterien).
 * Löschen ist auch mit verknüpften Epics erlaubt — die Links werden gelöst und
 * die nächste verknüpfte Solution rückt als Primär nach.
 */

import type { Result } from "@/modules/core/kernel/domain/errors";
import { ok, err, isErr } from "@/modules/core/kernel/domain/errors";
import { recordedUpdate } from "@/modules/core/kernel/server/recorded-update";
import type { RequestContext } from "@/server/http/mutation-handler";
import { withAuditedTransaction, toMutationContext } from "@/modules/core/kernel/server/mutation";
import { loadAndAuthorize } from "@/server/services/load-and-authorize";
import { notDeleted } from "@/server/db/soft-delete";
import { type Horizon } from "@/modules/work/domain/portfolio-guardrails";
import {
  investmentModeForHorizon,
  type InvestmentMode,
  type PromotionCriterionKey,
  PROMOTION_CRITERIA,
} from "@/modules/work/domain/solution";
import { loadAuthorizedEpic } from "@/modules/work/server/services/epic-access";
import type { Prisma } from "@/generated/prisma";

export interface CreateSolutionInput {
  name: string;
  description?: string | undefined;
  valueStreamId: string;
  artId?: string | null | undefined;
  horizon: Horizon;
  /** Nur H1 relevant; außerhalb H1 auf null normalisiert. Default „investing". */
  investmentMode?: InvestmentMode | null | undefined;
  /** Namentlich Verantwortliche:r für dieses Produkt. Freies Personenfeld. */
  productManagerId?: string | null | undefined;
}

export interface UpdateSolutionInput {
  id: string;
  name?: string | undefined;
  description?: string | null | undefined;
  valueStreamId?: string | undefined;
  artId?: string | null | undefined;
  horizon?: Horizon | undefined;
  investmentMode?: InvestmentMode | null | undefined;
  productManagerId?: string | null | undefined;
}

/**
 * Setzt die Solution-Zuordnungen eines Epics (n:m) + die Primär-Solution. Alle
 * Solutions müssen im **Value Stream des Epics** liegen; die Primär muss im Set
 * enthalten sein (bzw. `null` bei leerem Set). Ersetzt den bestehenden Satz.
 */
export async function setEpicSolutions(
  ctx: RequestContext,
  input: { epicId: string; solutionIds: string[]; primarySolutionId: string | null },
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  const { epicId } = input;
  // Duplikate raus.
  const solutionIds = [...new Set(input.solutionIds)];
  let primarySolutionId = input.primarySolutionId;

  return withAuditedTransaction(mctx, async (tx) => {
    const loaded = await loadAuthorizedEpic(tx, ctx.principal, mctx, {
      id: epicId,
      action: "epic.update",
      select: { id: true, valueStreamId: true },
    });
    if (!loaded.ok) return loaded;
    const epic = loaded.value;

    // Primär muss im Set liegen; leeres Set → keine Primär.
    if (solutionIds.length === 0) {
      primarySolutionId = null;
    } else if (primarySolutionId == null || !solutionIds.includes(primarySolutionId)) {
      // Erste als Primär, wenn keine gültige gewählt.
      primarySolutionId = solutionIds[0]!;
    }

    if (solutionIds.length > 0) {
      if (epic.valueStreamId == null) {
        return err({ kind: "conflict" as const, reason: "Epic hat keinen Value Stream." });
      }
      const valid = await tx.solution.findMany({
        where: {
          id: { in: solutionIds },
          tenantId: mctx.tenantId,
          valueStreamId: epic.valueStreamId,
          ...notDeleted,
        },
        select: { id: true },
      });
      if (valid.length !== solutionIds.length) {
        return err({
          kind: "conflict" as const,
          reason: "Alle Solutions müssen zum Value Stream des Epics gehören.",
        });
      }
    }

    // Satz ersetzen: alte Links weg, neue anlegen.
    await tx.epicSolution.deleteMany({ where: { epicId } });
    if (solutionIds.length > 0) {
      await tx.epicSolution.createMany({
        data: solutionIds.map((solutionId) => ({
          tenantId: mctx.tenantId,
          epicId,
          solutionId,
          createdBy: mctx.actorId,
        })),
      });
    }
    await tx.initiative.update({
      where: { id: epicId },
      data: { primarySolutionId, updatedBy: mctx.actorId },
    });

    return ok({
      result: undefined,
      audit: {
        action: "epic.solutions.set",
        resourceType: "initiative",
        resourceId: epicId,
        changes: { solutions: { before: null, after: solutionIds.length } },
      },
    });
  });
}

/** Prüft, dass ein (optionaler) ART zum Value Stream + Tenant gehört. */
async function assertArtInStream(
  tx: Prisma.TransactionClient,
  tenantId: string,
  valueStreamId: string,
  artId: string | null | undefined,
): Promise<Result<void>> {
  if (artId == null) return ok(undefined);
  const art = await tx.art.findFirst({
    where: { id: artId, tenantId, valueStreamId, ...notDeleted },
    select: { id: true },
  });
  if (!art) {
    return err({
      kind: "conflict" as const,
      reason: "Der ART gehört nicht zum gewählten Value Stream.",
    });
  }
  return ok(undefined);
}

export async function createSolution(
  ctx: RequestContext,
  input: CreateSolutionInput,
): Promise<Result<{ id: string }>> {
  const mctx = toMutationContext(ctx);
  const { name, description, valueStreamId, artId, horizon, investmentMode, productManagerId } =
    input;

  return withAuditedTransaction(mctx, async (tx) => {
    const vs = await tx.valueStream.findFirst({
      where: { id: valueStreamId, tenantId: mctx.tenantId, ...notDeleted },
      select: { id: true },
    });
    if (!vs)
      return err({ kind: "not_found" as const, resourceType: "ValueStream", id: valueStreamId });

    const artCheck = await assertArtInStream(tx, mctx.tenantId, valueStreamId, artId);
    if (isErr(artCheck)) return artCheck;

    const row = await tx.solution.create({
      data: {
        tenantId: mctx.tenantId,
        name,
        valueStreamId,
        artId: artId ?? null,
        horizon,
        // H1 ohne expliziten Modus → „investing"; außerhalb H1 → null.
        investmentMode: investmentModeForHorizon(horizon, investmentMode ?? "investing"),
        createdBy: mctx.actorId,
        updatedBy: mctx.actorId,
        ...(productManagerId !== undefined && { productManagerId }),
        ...(description !== undefined && { description }),
      },
      select: { id: true },
    });

    return ok({
      result: { id: row.id },
      audit: { action: "solution.created", resourceType: "solution", resourceId: row.id },
    });
  });
}

export async function updateSolution(
  ctx: RequestContext,
  input: UpdateSolutionInput,
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  const { id, name, description, valueStreamId, artId, horizon, investmentMode, productManagerId } =
    input;

  return withAuditedTransaction(mctx, async (tx) => {
    // Der benannte **Produkt-Manager** darf sein Produkt bearbeiten, auch ohne
    // `solution.update` — dasselbe Seam-Muster, mit dem die Finance-Partei des
    // Wertstroms beim Budget zugelassen wird. Verantwortung ohne
    // Handlungsmöglichkeit wäre eine leere Zuschreibung.
    const row = await tx.solution.findFirst({
      where: { id, tenantId: mctx.tenantId, ...notDeleted },
    });
    if (!row) return err({ kind: "not_found" as const, resourceType: "Solution", id });

    if (row.productManagerId !== ctx.principal.id) {
      const loaded = await loadAndAuthorize({
        principal: ctx.principal,
        action: "solution.update",
        resourceType: "Solution",
        id,
        finder: () => Promise.resolve(row),
        toResource: () => ({ tenantId: mctx.tenantId }),
      });
      if (isErr(loaded)) return loaded;
    }
    const existing = row;

    const effectiveVs = valueStreamId ?? existing.valueStreamId;
    if (valueStreamId !== undefined) {
      const vs = await tx.valueStream.findFirst({
        where: { id: valueStreamId, tenantId: mctx.tenantId, ...notDeleted },
        select: { id: true },
      });
      if (!vs)
        return err({ kind: "not_found" as const, resourceType: "ValueStream", id: valueStreamId });
    }
    // ART gegen den (ggf. neuen) Value Stream prüfen, wenn ART oder VS wechseln.
    if (artId !== undefined || valueStreamId !== undefined) {
      const artCheck = await assertArtInStream(
        tx,
        mctx.tenantId,
        effectiveVs,
        artId !== undefined ? artId : existing.artId,
      );
      if (isErr(artCheck)) return artCheck;
    }

    const nextHorizon = horizon ?? (existing.horizon as Horizon);
    // Invest/Extract konsistent zum (ggf. neuen) Horizont + Status halten. Nur
    // anfassen, wenn Horizont ODER Modus explizit übergeben wurde.
    const providedMode =
      investmentMode !== undefined
        ? investmentMode
        : (existing.investmentMode as InvestmentMode | null);
    const nextInvestmentMode =
      horizon !== undefined || investmentMode !== undefined
        ? investmentModeForHorizon(nextHorizon, providedMode)
        : undefined;
    const { changes, data } = recordedUpdate({
      existing,
      updates: {
        name,
        valueStreamId,
        artId,
        horizon,
        investmentMode: nextInvestmentMode,
        productManagerId,
      },
      fields: [
        "name",
        "valueStreamId",
        "artId",
        "horizon",
        "investmentMode",
        "productManagerId",
      ] as const,
    });

    await tx.solution.update({
      where: { id },
      data: {
        ...data,
        updatedBy: mctx.actorId,
        ...(description !== undefined && { description }),
      },
    });

    return ok({
      result: undefined,
      audit: { action: "solution.updated", resourceType: "solution", resourceId: id, changes },
    });
  });
}

export async function softDeleteSolution(
  ctx: RequestContext,
  input: { id: string },
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  const { id } = input;

  return withAuditedTransaction(mctx, async (tx) => {
    const existing = await tx.solution.findFirst({
      where: { id, tenantId: mctx.tenantId, ...notDeleted },
      select: { id: true },
    });
    if (!existing) return err({ kind: "not_found" as const, resourceType: "Solution", id });

    // Epics, deren Primär diese Solution ist → nächste verknüpfte (aktive) Solution
    // als Primär nachrücken, sonst „Ohne" (null).
    const affected = await tx.initiative.findMany({
      where: { tenantId: mctx.tenantId, primarySolutionId: id },
      select: { id: true },
    });
    for (const e of affected) {
      const next = await tx.epicSolution.findFirst({
        where: { epicId: e.id, solutionId: { not: id }, solution: { ...notDeleted } },
        select: { solutionId: true },
      });
      await tx.initiative.update({
        where: { id: e.id },
        data: { primarySolutionId: next?.solutionId ?? null, updatedBy: mctx.actorId },
      });
    }

    // Zuordnungen dieser Solution lösen + Solution soft-deleten.
    await tx.epicSolution.deleteMany({ where: { solutionId: id } });
    await tx.solution.update({ where: { id }, data: { deletedAt: new Date() } });

    return ok({
      result: undefined,
      audit: {
        action: "solution.deleted",
        resourceType: "solution",
        resourceId: id,
        changes: { unlinkedEpics: { before: affected.length, after: 0 } },
      },
    });
  });
}

/** Transition-Gate H2→H1: nur mit allen vier bestätigten Kriterien. */
export async function promoteSolution(
  ctx: RequestContext,
  input: { id: string; criteria: Record<PromotionCriterionKey, boolean> },
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  const { id, criteria } = input;

  return withAuditedTransaction(mctx, async (tx) => {
    const loaded = await loadAndAuthorize({
      principal: ctx.principal,
      action: "solution.manage",
      resourceType: "Solution",
      id,
      finder: () =>
        tx.solution.findFirst({ where: { id, tenantId: mctx.tenantId, ...notDeleted } }),
      toResource: () => ({ tenantId: mctx.tenantId }),
    });
    if (isErr(loaded)) return loaded;
    const existing = loaded.value;

    if (existing.horizon !== "h2") {
      return err({
        kind: "conflict" as const,
        reason: "Nur Emerging-Solutions (H2) können nach H1 befördert werden.",
      });
    }
    const allConfirmed = PROMOTION_CRITERIA.every((c) => criteria[c.key] === true);
    if (!allConfirmed) {
      return err({
        kind: "conflict" as const,
        reason: "Alle vier Transition-Kriterien müssen bestätigt sein.",
      });
    }

    await tx.solution.update({
      where: { id },
      data: { horizon: "h1", investmentMode: "investing", updatedBy: mctx.actorId },
    });

    return ok({
      result: undefined,
      audit: {
        action: "solution.promoted",
        resourceType: "solution",
        resourceId: id,
        changes: { horizon: { before: "h2", after: "h1" } },
      },
    });
  });
}

/** Freier Lifecycle-Wechsel (vor-/rückwärts), z. B. H3→H2, H1→H0, H0→H1. */
export async function setSolutionLifecycle(
  ctx: RequestContext,
  input: { id: string; horizon: Horizon },
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  const { id, horizon } = input;

  return withAuditedTransaction(mctx, async (tx) => {
    const loaded = await loadAndAuthorize({
      principal: ctx.principal,
      action: "solution.manage",
      resourceType: "Solution",
      id,
      finder: () =>
        tx.solution.findFirst({ where: { id, tenantId: mctx.tenantId, ...notDeleted } }),
      toResource: () => ({ tenantId: mctx.tenantId }),
    });
    if (isErr(loaded)) return loaded;
    const existing = loaded.value;

    // Beim Eintritt in H1 ohne Modus: Default „investing". Sonst Modus konsistent.
    const currentMode = existing.investmentMode as InvestmentMode | null;
    const nextMode =
      horizon === "h1"
        ? (currentMode ?? "investing")
        : investmentModeForHorizon(horizon, currentMode);

    const { changes, data } = recordedUpdate({
      existing,
      updates: { horizon, investmentMode: nextMode },
      fields: ["horizon", "investmentMode"] as const,
    });
    await tx.solution.update({ where: { id }, data: { ...data, updatedBy: mctx.actorId } });

    return ok({
      result: undefined,
      audit: {
        action: "solution.lifecycle.changed",
        resourceType: "solution",
        resourceId: id,
        changes,
      },
    });
  });
}

/**
 * Invest/Extract-Modus setzen (nur in H1 relevant).
 *
 * Hieß `setSolutionRun` und trug zusätzlich eine Run-Baseline. Die ist
 * entfallen: Betriebskosten sind Run-the-Business-Positionen und werden im
 * Budgeting-Modul gepflegt — an einer Stelle, mit Periode und optionaler
 * Solution-Zurechnung.
 */
export async function setSolutionInvestmentMode(
  ctx: RequestContext,
  input: { id: string; investmentMode: InvestmentMode | null },
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  const { id, investmentMode } = input;

  return withAuditedTransaction(mctx, async (tx) => {
    const loaded = await loadAndAuthorize({
      principal: ctx.principal,
      action: "solution.manage",
      resourceType: "Solution",
      id,
      finder: () =>
        tx.solution.findFirst({ where: { id, tenantId: mctx.tenantId, ...notDeleted } }),
      toResource: () => ({ tenantId: mctx.tenantId }),
    });
    if (isErr(loaded)) return loaded;
    const existing = loaded.value;

    // Invest/Extract nur in H1 relevant.
    const nextMode = investmentModeForHorizon(existing.horizon as Horizon, investmentMode);

    const { changes, data } = recordedUpdate({
      existing,
      updates: { investmentMode: nextMode },
      fields: ["investmentMode"] as const,
    });
    await tx.solution.update({ where: { id }, data: { ...data, updatedBy: mctx.actorId } });

    return ok({
      result: undefined,
      audit: {
        action: "solution.investment_mode.changed",
        resourceType: "solution",
        resourceId: id,
        changes,
      },
    });
  });
}
