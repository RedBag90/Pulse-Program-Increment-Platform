import type { Result } from "@/domain/errors";
import { ok, err, isErr } from "@/domain/errors";
import { authorize, authorizeResource } from "@/server/auth/authorize";
import type { RequestContext } from "@/server/http/mutation-handler";
import { withAuditedTransaction, toMutationContext } from "@/server/services/mutation";

/**
 * Controlling — Finance-Controller-Setter, der pro Epic-KPI den € pro
 * natuerlicher Einheit setzt. Reine Mutation; die Read-Surface lebt im
 * KPI-Coverage-Page-Model (`src/server/views/ziele-view.ts`).
 */

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
