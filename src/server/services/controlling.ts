import type { PrismaClient } from "@/generated/prisma";
import type { TenantId } from "@/domain/types";
import { InitiativeLevel } from "@/domain/types";
import type { Result } from "@/domain/errors";
import { ok, err, isErr } from "@/domain/errors";
import { authorize, authorizeResource } from "@/server/auth/authorize";
import { parseKpiMeasurements, latestKpiValue } from "@/domain/kpi";
import { kpiValueContribution } from "@/domain/kpi-valuation";
import type { RequestContext } from "@/server/http/mutation-handler";
import { withAuditedTransaction, toMutationContext } from "@/server/services/mutation";

/**
 * Controlling — the KPI tree (Goal → strategic KPIs + linked Epics → operational
 * KPIs) and the Finance-Controller setters that attach a € value per KPI's
 * natural unit. Pure read path + two audited mutations.
 */

export interface OperationalKpiNode {
  id: string;
  name: string;
  unit: string | null;
  baseline: number | null;
  target: number | null;
  current: number | null;
  valuePerUnit: number | null;
  /** Monetary contribution at the current reading; null when uncomputable. */
  contribution: number | null;
}

export interface EpicNode {
  id: string;
  title: string;
  status: string;
  valueStreamId: string | null;
  valueStreamName: string | null;
  kpis: OperationalKpiNode[];
}

export interface StrategicKpiNode {
  id: string;
  title: string;
  metricUnit: string | null;
  baseline: number | null;
  target: number;
  current: number | null;
  valuePerUnit: number | null;
  contribution: number | null;
}

export interface GoalNode {
  id: string;
  title: string;
  description: string | null;
  ownerId: string | null;
  status: string;
  dueDate: string | null;
  strategicKpis: StrategicKpiNode[];
  epics: EpicNode[];
}

export interface KpiTree {
  goals: GoalNode[];
  /** Strategic KPIs not bound to any goal — surfaced at the bottom. */
  unboundStrategicKpis: StrategicKpiNode[];
}

const toNumber = (v: unknown): number | null =>
  v == null ? null : typeof v === "number" ? v : Number(v.toString());

function buildOperationalKpi(k: {
  id: string;
  name: string;
  unit: string | null;
  baseline: unknown;
  target: unknown;
  measurements: unknown;
  valuePerUnit: unknown;
}): OperationalKpiNode {
  const baseline = toNumber(k.baseline);
  const target = toNumber(k.target);
  const current = latestKpiValue(parseKpiMeasurements(k.measurements));
  const valuePerUnit = toNumber(k.valuePerUnit);
  return {
    id: k.id,
    name: k.name,
    unit: k.unit,
    baseline,
    target,
    current,
    valuePerUnit,
    contribution: kpiValueContribution({ baseline, target, current, valuePerUnit }),
  };
}

function buildStrategicKpi(o: {
  id: string;
  title: string;
  metricUnit: string | null;
  baseline: number | null;
  target: number;
  current: number | null;
  valuePerUnit: unknown;
}): StrategicKpiNode {
  const valuePerUnit = toNumber(o.valuePerUnit);
  return {
    id: o.id,
    title: o.title,
    metricUnit: o.metricUnit,
    baseline: o.baseline,
    target: o.target,
    current: o.current,
    valuePerUnit,
    contribution: kpiValueContribution({
      baseline: o.baseline,
      target: o.target,
      current: o.current,
      valuePerUnit,
    }),
  };
}

/** Assembles the Goal → KPIs + Epics → KPIs tree for the Controlling page. */
export async function getKpiTree(db: PrismaClient, tenantId: TenantId): Promise<KpiTree> {
  const [goals, unbound] = await Promise.all([
    db.transformationGoal.findMany({
      where: { tenantId },
      orderBy: { createdAt: "asc" },
      include: {
        kpis: { orderBy: { createdAt: "asc" } },
        epicLinks: {
          orderBy: { createdAt: "asc" },
          include: {
            epic: {
              include: {
                valueStream: { select: { id: true, name: true } },
                kpis: { orderBy: { createdAt: "asc" } },
              },
            },
          },
        },
      },
    }),
    db.targetOutcome.findMany({
      where: { tenantId, goalId: null },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return {
    goals: goals.map((g) => ({
      id: g.id,
      title: g.title,
      description: g.description,
      ownerId: g.ownerId,
      status: g.status,
      dueDate: g.dueDate?.toISOString() ?? null,
      strategicKpis: g.kpis.map(buildStrategicKpi),
      epics: g.epicLinks
        .filter((l) => l.epic.level === InitiativeLevel.EPIC && l.epic.deletedAt === null)
        .map((l) => ({
          id: l.epic.id,
          title: l.epic.title,
          status: l.epic.status,
          valueStreamId: l.epic.valueStream?.id ?? null,
          valueStreamName: l.epic.valueStream?.name ?? null,
          kpis: l.epic.kpis.map(buildOperationalKpi),
        })),
    })),
    unboundStrategicKpis: unbound.map(buildStrategicKpi),
  };
}

// ---------------------------------------------------------------------------
// Setters — Finance Controller valuation
// ---------------------------------------------------------------------------

/**
 * Sets (or clears) the € per natural unit on an Epic operational KPI. The
 * service-seam check honours the policy's value_stream scope AND additionally
 * allows the Epic's value-stream `financeApproverId` (mirrors `saveArtBudget`).
 */
export async function setKpiValuePerUnit(
  ctx: RequestContext,
  input: { kpiId: string; valuePerUnit: number | null },
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  const { kpiId, valuePerUnit } = input;

  return withAuditedTransaction(mctx, async (tx) => {
    const kpi = await tx.kpi.findFirst({
      where: { id: kpiId, tenantId: mctx.tenantId },
      include: {
        initiative: {
          select: {
            valueStreamId: true,
            valueStream: { select: { financeApproverId: true } },
          },
        },
      },
    });
    if (!kpi) return err({ kind: "not_found" as const, resourceType: "Kpi", id: kpiId });

    const valueStreamId = kpi.initiative.valueStreamId;
    const auth = authorizeResource(ctx.principal, "kpi.value.manage", {
      tenantId: mctx.tenantId,
      valueStreamId,
    });
    const isFinanceApprover = kpi.initiative.valueStream?.financeApproverId === ctx.principal.id;
    if (isErr(auth) && !isFinanceApprover) return auth;

    await tx.kpi.update({
      where: { id: kpiId },
      data: { valuePerUnit, updatedBy: mctx.actorId },
    });

    return ok({
      result: undefined,
      audit: { action: "kpi.updated", resourceType: "kpi", resourceId: kpiId },
    });
  });
}

/**
 * Sets (or clears) the € per natural unit on a strategic KPI (TargetOutcome).
 * No value-stream scope — the unscoped grants (portfolio_manager /
 * transformation_lead / admins) apply.
 */
export async function setTargetOutcomeValuePerUnit(
  ctx: RequestContext,
  input: { id: string; valuePerUnit: number | null },
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  const { id, valuePerUnit } = input;

  return withAuditedTransaction(mctx, async (tx) => {
    const existing = await tx.targetOutcome.findFirst({
      where: { id, tenantId: mctx.tenantId },
    });
    if (!existing) {
      return err({ kind: "not_found" as const, resourceType: "TargetOutcome", id });
    }

    const auth = authorizeResource(ctx.principal, "kpi.value.manage", {
      tenantId: mctx.tenantId,
    });
    if (isErr(auth)) return auth;

    await tx.targetOutcome.update({
      where: { id },
      data: { valuePerUnit, updatedBy: mctx.actorId },
    });

    return ok({
      result: undefined,
      audit: { action: "target_outcome.value_set", resourceType: "target_outcome", resourceId: id },
    });
  });
}

/** Coarse check: may the principal set ANY KPI valuation in this tenant? */
export function canEditKpiValues(principal: {
  roles: string[];
  tenantId: string;
  id: string;
}): boolean {
  return authorize(
    "kpi.value.manage",
    { tenantId: principal.tenantId },
    // The authorize() function accepts the broader Principal shape; cast minimal.
    principal as never,
  ).allow;
}
