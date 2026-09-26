import type { RequestContext } from "@/server/http/mutation-handler";
import { withAuditedTransaction, toMutationContext } from "@/modules/core/kernel/server/mutation";
import { ok, err, type Result } from "@/modules/core/kernel/domain/errors";
import { authorizeResource } from "@/server/auth/authorize";

/**
 * **Den €-Satz je Job Size eines ARTs schätzen** — für den Fall, dass die
 * Historie keinen hergibt (`deriveJobSizeRate`: empirisch, dann diese
 * Schätzung, dann der Mandanten-Satz).
 *
 * Recht: `art_budget.distribute` auf das ART **samt seinem Wertstrom** —
 * Admin, Portfolio Manager, der Business Owner des Wertstroms und der RTE des
 * ARTs. Der Wertstrom muss mit, sonst wäre dessen Scope hier vakuant wahr
 * (siehe `art-pot.ts`). `null` entfernt die Schätzung.
 */
export async function setArtJobSizeRateEstimate(
  ctx: RequestContext,
  input: { artId: string; estimate: number | null },
): Promise<Result<{ estimate: number | null }>> {
  const mctx = toMutationContext(ctx);
  return withAuditedTransaction(mctx, async (tx) => {
    const art = await tx.art.findFirst({
      where: { id: input.artId, tenantId: mctx.tenantId, deletedAt: null },
      select: { valueStreamId: true, jobSizeRateEstimate: true },
    });
    if (!art) return err({ kind: "not_found" as const, resourceType: "Art", id: input.artId });

    const darf = authorizeResource(ctx.principal, "art_budget.distribute", {
      tenantId: mctx.tenantId,
      artId: input.artId,
      valueStreamId: art.valueStreamId,
    }).ok;
    if (!darf) {
      return err({ kind: "forbidden" as const, reason: "budgeting.art.schaetzenVerweigert" });
    }

    await tx.art.update({
      where: { id: input.artId },
      data: { jobSizeRateEstimate: input.estimate },
    });
    return ok({
      result: { estimate: input.estimate },
      audit: {
        action: "art.job_size_rate_estimate.set" as const,
        resourceType: "art" as const,
        resourceId: input.artId,
        changes: {
          jobSizeRateEstimate: {
            before: art.jobSizeRateEstimate != null ? Number(art.jobSizeRateEstimate) : null,
            after: input.estimate,
          },
        },
      },
    });
  });
}
