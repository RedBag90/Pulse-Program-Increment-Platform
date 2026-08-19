import type { Prisma, PrismaClient } from "@/generated/prisma";
import type { TenantId, ValueStreamId } from "@/modules/core/kernel/domain/types";
import { InitiativeLevel } from "@/modules/core/kernel/domain/types";
import type { Result } from "@/modules/core/kernel/domain/errors";
import { ok, err } from "@/modules/core/kernel/domain/errors";
import { budgetPlusLoadPeriods } from "@/modules/budgeting/domain/period-window";
import {
  aggregateArtFeatureLoad,
  type ArtFeatureLoad,
} from "@/modules/budgeting/domain/art-budget";
import { parsePeriodAmountMap } from "@/modules/budgeting/domain/budgeting";
import { getValueStreamBudget } from "@/modules/budgeting/server/services/budgeting";
import type { RequestContext } from "@/server/http/mutation-handler";
import { withAuditedTransaction, toMutationContext } from "@/modules/core/kernel/server/mutation";
import { authorizeResource } from "@/server/auth/authorize";

export interface ArtBudgetRow {
  artId: string;
  name: string;
  /** Finance's budget allocation per half-year. */
  budgetByPeriod: Record<string, number>;
  /** Feature count + Σ Job Size per half-year + backlog. */
  load: ArtFeatureLoad;
}

export interface ArtBudgetBreakdown {
  /** Half-year columns: the VS budget-plan periods ∪ the periods features' PIs fall in. */
  periods: { key: string; label: string }[];
  /** The Value Stream's budget per half-year — what the ARTs draw against. */
  vsByPeriod: Record<string, number>;
  arts: ArtBudgetRow[];
}

/**
 * The per-ART budget breakdown + feature load for one Value Stream. Periods are
 * the VS budget plan's half-years extended to cover any half-year a Feature's PI
 * falls in. Read-only; the VS budget comes from participatory budgeting.
 */
export async function getArtBudgetBreakdown(
  db: PrismaClient,
  tenantId: TenantId,
  valueStreamId: ValueStreamId,
): Promise<ArtBudgetBreakdown> {
  const [vsBudget, arts] = await Promise.all([
    getValueStreamBudget(db, tenantId, valueStreamId),
    db.art.findMany({
      where: { tenantId, valueStreamId, deletedAt: null },
      select: { id: true, name: true, budget: { select: { byPeriod: true } } },
      orderBy: { name: "asc" },
    }),
  ]);

  const vsByPeriod = vsBudget.budget?.byPeriod ?? {};
  const artIds = arts.map((a) => a.id);

  const features = await db.initiative.findMany({
    where: {
      tenantId,
      level: InitiativeLevel.FEATURE,
      deletedAt: null,
      artId: { in: artIds },
    },
    select: { artId: true, wsjfJobSize: true, pi: { select: { startDate: true } } },
  });

  const loads = new Map(
    aggregateArtFeatureLoad(
      artIds,
      features.map((f) => ({
        artId: f.artId ?? "",
        piStart: f.pi?.startDate ?? null,
        jobSize: f.wsjfJobSize ?? 0,
      })),
    ).map((l) => [l.artId, l]),
  );

  // Columns: the budget-plan periods ∪ any half-year a feature's PI sits in —
  // the named rule lives in the pure `period-window` seam.
  const periods = budgetPlusLoadPeriods(
    vsBudget.periods.map((p) => p.key),
    features.flatMap((f) => (f.pi ? [f.pi.startDate] : [])),
  );

  const rows: ArtBudgetRow[] = arts.map((a) => ({
    artId: a.id,
    name: a.name,
    budgetByPeriod: parsePeriodAmountMap(a.budget?.byPeriod),
    // `aggregateArtFeatureLoad(artIds, …)` guarantees exactly one entry per id
    // in `artIds` (= `arts.map(a => a.id)`), so this lookup is always present.
    load: loads.get(a.id)!,
  }));

  return { periods, vsByPeriod, arts: rows };
}

/**
 * Upserts an ART's budget breakdown (per-half-year amounts).
 *
 * Autorisierung nach ADR-0002 **hier** am Service-Seam, gegen die GELADENE Zeile:
 * erst wird der ART samt Wertstrom geholt, dann entscheidet `authorizeResource`
 * mit dem echten `valueStreamId`/`artId` — der `value_stream`-Scope der Policy
 * greift also wirklich. Zusätzlich zugelassen ist die Finance-Partei des
 * Wertstroms (`ValueStream.financeApproverId`), die keine Rolle dafür braucht.
 *
 * Vorher stand hier eine handgeschriebene Rollenliste, die enger war als die
 * Policy: ein Wertstrom-Owner passierte den Action-Guard, bekam ein editierbares
 * Grid und lief dann in ein `forbidden` (Befund F-01).
 */
export async function saveArtBudget(
  ctx: RequestContext,
  input: { artId: string; byPeriod: Record<string, number> },
): Promise<Result<{ id: string }>> {
  const mctx = toMutationContext(ctx);
  const { artId, byPeriod } = input;

  return withAuditedTransaction(mctx, async (tx) => {
    const art = await tx.art.findFirst({
      where: { id: artId, tenantId: mctx.tenantId, deletedAt: null },
      select: {
        id: true,
        valueStreamId: true,
        valueStream: { select: { financeApproverId: true } },
      },
    });
    if (!art) return err({ kind: "not_found" as const, resourceType: "Art", id: artId });

    const isFinance = art.valueStream?.financeApproverId === mctx.actorId;
    if (!isFinance) {
      const decision = authorizeResource(ctx.principal, "art_budget.manage", {
        tenantId: mctx.tenantId,
        valueStreamId: art.valueStreamId,
        artId: art.id,
      });
      if (!decision.ok) {
        return err({
          kind: "forbidden" as const,
          reason:
            "Nur die Finance-Partei des Wertstroms (oder Portfolio-Manager/Wertstrom-Owner/Admin) darf ART-Budgets verteilen",
        });
      }
    }

    const row = await tx.artBudget.upsert({
      where: { artId },
      update: { byPeriod: byPeriod as Prisma.InputJsonValue, updatedBy: mctx.actorId },
      create: {
        tenantId: mctx.tenantId,
        artId,
        byPeriod: byPeriod as Prisma.InputJsonValue,
        createdBy: mctx.actorId,
        updatedBy: mctx.actorId,
      },
    });

    return ok({
      result: { id: row.id },
      audit: { action: "art_budget.saved", resourceType: "art_budget", resourceId: row.id },
    });
  });
}
