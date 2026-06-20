import { ok, err, type Result } from "@/domain/errors";
import { checkKpiBinding } from "@/domain/kpi-binding-invariant";
import type { RequestContext } from "@/server/http/mutation-handler";
import { authorizeResource } from "@/server/auth/authorize";
import { withAuditedTransaction, toMutationContext } from "@/server/services/mutation";

/**
 * KPI ↔ KR-Bindungs-Service. Eigenes Modul (statt im breiten
 * `ziele`-Service zu leben), weil die Bindung eine eigene Capability
 * traegt (`kpi.bind`) und damit auch eine eigene Permission-Seam haben
 * sollte. CONTEXT.md §Strategy & KPI bindings benennt die drei Seams:
 * Domain-Invariante (`checkKpiBinding`), atomarer Service (hier) und
 * DB-Backstop (`UNIQUE(kpiId)` auf `kr_kpi_contributions`).
 *
 * Die Permission wird gemaess ADR-0002 *nach* dem Load des KR
 * geprueft, damit eine spaeter eingefuehrte Scope-Pruefung den echten
 * Tenant/Theme des Ziel-KR sieht (heute nur Rollen-Check, aber der
 * Seam ist bereits da).
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
        if (existing && (input.weight !== undefined || input.valuePerUnitOverride !== undefined)) {
          const authz = authorizeResource(ctx.principal, "kpi.bind", { tenantId: mctx.tenantId });
          if (!authz.ok) return authz;
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
        const authz = authorizeResource(ctx.principal, "kpi.bind", { tenantId: mctx.tenantId });
        if (!authz.ok) return authz;
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
      case "rebind":
      case "create": {
        const targetKrId = plan.kind === "rebind" ? plan.toKeyResultId : plan.keyResultId;
        const kr = await tx.keyResult.findFirst({
          where: { id: targetKrId, tenantId: mctx.tenantId },
        });
        if (!kr) {
          return err({
            kind: "not_found" as const,
            resourceType: "KeyResult",
            id: targetKrId,
          });
        }
        const authz = authorizeResource(ctx.principal, "kpi.bind", { tenantId: mctx.tenantId });
        if (!authz.ok) return authz;
        if (plan.kind === "rebind") {
          await tx.krKpiContribution.delete({ where: { id: existing!.id } });
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
