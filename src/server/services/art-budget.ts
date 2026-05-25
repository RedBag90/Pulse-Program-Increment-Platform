import type { Prisma, PrismaClient } from "@/generated/prisma";
import type { TenantId, ValueStreamId } from "@/domain/types";
import { InitiativeLevel } from "@/domain/types";
import type { Result } from "@/domain/errors";
import { ok, err } from "@/domain/errors";
import { halfYearKey, halfYearLabel } from "@/domain/calendar";
import { aggregateArtFeatureLoad, type ArtFeatureLoad } from "@/domain/art-budget";
import { getValueStreamBudgets } from "@/server/services/budgeting";
import type { RequestContext } from "@/server/http/mutation-handler";
import { withAuditedTransaction, toMutationContext } from "@/server/services/mutation";

/** Reads a JSON map of period-key → number, discarding malformed entries. */
function parsePeriodMap(raw: unknown): Record<string, number> {
  if (raw == null || typeof raw !== "object") return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
  }
  return out;
}

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
  const [vsBudgets, arts] = await Promise.all([
    getValueStreamBudgets(db, tenantId),
    db.art.findMany({
      where: { tenantId, valueStreamId, deletedAt: null },
      select: { id: true, name: true, budget: { select: { byPeriod: true } } },
      orderBy: { name: "asc" },
    }),
  ]);

  const vs = vsBudgets.valueStreams.find((b) => b.valueStreamId === valueStreamId);
  const vsByPeriod = vs?.byPeriod ?? {};
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

  // Columns: the budget-plan periods plus any half-year a feature's PI sits in.
  const keys = new Set<string>(vsBudgets.periods.map((p) => p.key));
  for (const f of features) if (f.pi) keys.add(halfYearKey(f.pi.startDate));
  const periods = [...keys].sort().map((key) => ({ key, label: halfYearLabel(key) }));

  const rows: ArtBudgetRow[] = arts.map((a) => ({
    artId: a.id,
    name: a.name,
    budgetByPeriod: parsePeriodMap(a.budget?.byPeriod),
    load: loads.get(a.id) ?? {
      artId: a.id,
      byPeriod: {},
      backlog: { count: 0, jobSize: 0 },
      total: { count: 0, jobSize: 0 },
    },
  }));

  return { periods, vsByPeriod, arts: rows };
}

/**
 * Upserts an ART's budget breakdown (per-half-year amounts). Authoritative
 * permission is enforced here: the Value Stream's finance approver, or a
 * portfolio manager / admin (mirrors the approver service-seam check in
 * `epic-approval.decideApproval`).
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
      select: { id: true, valueStream: { select: { financeApproverId: true } } },
    });
    if (!art) return err({ kind: "not_found" as const, resourceType: "Art", id: artId });

    const roles = ctx.principal.roles;
    const isManager =
      roles.includes("portfolio_manager") ||
      roles.includes("tenant_admin") ||
      roles.includes("platform_admin");
    const isFinance = art.valueStream?.financeApproverId === mctx.actorId;
    if (!isManager && !isFinance) {
      return err({
        kind: "forbidden" as const,
        reason:
          "Nur die Finance-Partei des Wertstroms (oder Portfolio-Manager/Admin) darf ART-Budgets verteilen",
      });
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
