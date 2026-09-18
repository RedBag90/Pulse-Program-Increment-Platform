/**
 * Solution-Mutationen (SAFe Lean Portfolio Management). Solutions sind
 * tenant-weite Portfolio-Katalog-Entitäten (VS Pflicht, ein ART optional) mit
 * einem Investitionshorizont, der an die zugeordneten Epics vererbt wird.
 *
 * Lifecycle-Wechsel laufen über explizite Aktionen: freier `setSolutionLifecycle`
 * + das Transition-Gate `promoteSolution` (H2→H1, nur mit allen 4 Kriterien).
 * Löschen ist auch mit verknüpften Epics erlaubt — die Links werden gelöst und
 * die nächste verknüpfte Solution rückt als Primär nach.
 *
 * **Liegt seit ADR-0022 in Core.** Eine Solution ist ein Strukturknoten neben
 * Wertstrom und ART, kein Arbeitsgegenstand. Was an ihr Arbeit ist — die
 * Verknuepfung zu Epics und die Grow-Summe daraus — blieb in Work
 * (`work/server/services/epic-solutions.ts`, `work/server/views/solution-grow.ts`).
 */

import type { Result } from "@/modules/core/kernel/domain/errors";
import { ok, err, isErr } from "@/modules/core/kernel/domain/errors";
import { recordedUpdate } from "@/modules/core/kernel/server/recorded-update";
import type { RequestContext } from "@/server/http/mutation-handler";
import { withAuditedTransaction, toMutationContext } from "@/modules/core/kernel/server/mutation";
import { loadAndAuthorize } from "@/server/services/load-and-authorize";
import { notDeleted } from "@/server/db/soft-delete";
import { type Horizon } from "@/modules/core/org/domain/horizon";
import {
  investmentModeForHorizon,
  isSolutionHorizon,
  solutionStatusOf,
  SOLUTION_TRANSITIONS,
  type InvestmentMode,
  type PromotionCriterionKey,
  PROMOTION_CRITERIA,
} from "@/modules/core/org/domain/solution";

/**
 * **In H3 gibt es keine Solution** (ADR-0020). Der Guard steht im Service und
 * nicht nur im Zod-Schema, weil die Regel eine fachliche ist: dort wird
 * geforscht, und ob daraus je ein Produkt wird, ist offen.
 */
function rejectResearchHorizon(horizon: Horizon) {
  return isSolutionHorizon(horizon)
    ? null
    : {
        kind: "conflict" as const,
        reason:
          "In H3 gibt es keine Solution — dort wird geforscht. " +
          "Ein R&D-Vorhaben trägt seinen Horizont am Epic; eine Solution entsteht frühestens in H2.",
      };
}
import type { Prisma } from "@/generated/prisma";
import { InitiativeLevel } from "@/modules/core/kernel/domain/types";

export interface CreateSolutionInput {
  name: string;
  description?: string | undefined;
  valueStreamId: string;
  /**
   * **Pflicht seit 2026-09-19.** Welcher Zug diese Solution baut — der Weg, auf
   * dem sich eine Betriebsposition an ihr auf ein ART auflöst. In H2 ist die
   * Angabe eine Absicht, keine Zusage; sie lässt sich jederzeit ändern.
   */
  artId: string;
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
  /** Änderbar, aber nicht löschbar — `null` gibt es nicht mehr. */
  artId?: string | undefined;
  horizon?: Horizon | undefined;
  investmentMode?: InvestmentMode | null | undefined;
  productManagerId?: string | null | undefined;
}

/**
 * Prüft, dass der ART zum Value Stream + Tenant gehört.
 *
 * `undefined` heißt beim Update „nicht angefasst" — das bleibt erlaubt.
 * **`null` gibt es nicht mehr:** die Spalte ist Pflicht, und ein ART lässt sich
 * seit 2026-09-19 nur wechseln, nicht entfernen.
 */
async function assertArtInStream(
  tx: Prisma.TransactionClient,
  tenantId: string,
  valueStreamId: string,
  artId: string | undefined,
): Promise<Result<void>> {
  if (artId === undefined) return ok(undefined);
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

    const research = rejectResearchHorizon(horizon);
    if (research) return err(research);

    const row = await tx.solution.create({
      data: {
        tenantId: mctx.tenantId,
        name,
        valueStreamId,
        artId,
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

    if (horizon !== undefined) {
      const research = rejectResearchHorizon(horizon);
      if (research) return err(research);
    }

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
    //
    // **Ausdrücklich nur Epics.** Seit ein Feature seine Solution selbst tragen
    // darf, trifft die Spalte auch Features — die haben aber keine
    // Verknüpfungstabelle, aus der etwas nachrücken könnte. Sie werden weiter
    // unten in einem Rutsch geleert.
    const affected = await tx.initiative.findMany({
      where: {
        tenantId: mctx.tenantId,
        primarySolutionId: id,
        level: InitiativeLevel.EPIC,
      },
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

    // Features verlieren die Zuordnung ersatzlos: ein Feature wird in genau
    // eine Solution geliefert, es gibt keine zweite, die nachrücken könnte.
    await tx.initiative.updateMany({
      where: {
        tenantId: mctx.tenantId,
        primarySolutionId: id,
        level: InitiativeLevel.FEATURE,
      },
      data: { primarySolutionId: null, updatedBy: mctx.actorId },
    });

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

/**
 * Ein Schritt auf der Lebenszyklus-Leiter, vorwärts wie rückwärts.
 *
 * **Die erlaubten Kanten werden hier geprüft, nicht nur gezeichnet.** Bis
 * ADR-0020 stand `SOLUTION_TRANSITIONS` allein in der Oberfläche: über diese
 * Aktion war jeder Sprung möglich, auch `Decommissioning → R&D`. Eine Leiter,
 * die nur die Fläche kennt, ist keine Regel, sondern eine Zusage.
 */
export async function setSolutionLifecycle(
  ctx: RequestContext,
  input: { id: string; horizon: Horizon; investmentMode?: InvestmentMode | null },
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  const { id, horizon, investmentMode } = input;

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

    const research = rejectResearchHorizon(horizon);
    if (research) return err(research);

    // Der Modus: nennt der Aufrufer einen (die Leiter tut das — H1.1 und H1.2
    // sind für sie zwei Stufen), gilt der. Sonst bleibt der bestehende, und beim
    // Eintritt in H1 ohne Modus greift der Default „investing". Ausserhalb H1
    // räumt `investmentModeForHorizon` ihn in jedem Fall ab.
    const currentMode = existing.investmentMode as InvestmentMode | null;

    // Der Weg muss auf der Leiter stehen. Der Ist-Zustand wird dafür aus
    // `(horizon, investmentMode)` gelesen — derselbe Weg, den die Leiste geht.
    const from = solutionStatusOf(existing.horizon as Horizon, currentMode);
    const to = solutionStatusOf(horizon, investmentMode ?? currentMode);
    if (from !== to && !SOLUTION_TRANSITIONS[from].some((t) => t.to === to)) {
      return err({
        kind: "conflict" as const,
        reason: `Von „${from}" führt kein Schritt nach „${to}".`,
      });
    }

    const wanted = investmentMode !== undefined ? investmentMode : currentMode;
    const nextMode =
      horizon === "h1" ? (wanted ?? "investing") : investmentModeForHorizon(horizon, wanted);

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

// Der eigenständige Invest/Extract-Setzer ist entfallen. Mit der fünfstufigen
// Lebenszyklus-Leiter ist H1.1 → H1.2 ein Stufenwechsel wie jeder andere und
// läuft über `setSolutionLifecycle`; der Schieber, der ihn brauchte, gibt es
// nicht mehr. Alt-Audit-Zeilen `solution.investment_mode.changed` bleiben
// gültig — sie beschreiben, was damals geschah.
