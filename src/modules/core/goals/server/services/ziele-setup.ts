import type { PrismaClient } from "@/generated/prisma";
import type { TenantId } from "@/modules/core/kernel/domain/types";
import type { Result } from "@/modules/core/kernel/domain/errors";
import { ok } from "@/modules/core/kernel/domain/errors";
import type { RequestContext } from "@/server/http/mutation-handler";
import { withAuditedTransaction, toMutationContext } from "@/modules/core/kernel/server/mutation";
import { ZIELE_SETUP_DISMISSED_KEY } from "@/modules/core/goals/domain/goal-setup";

/**
 * Persistence for the Ziele first-run setup guide's **dismissed** flag. Reuses the
 * tenant-level `setup_progress` key→flag store (a reserved `checkId`) — no schema
 * change. Tenant-wide: once an editor dismisses the guide it stays hidden for the
 * tenant. Write-authorization runs in the server action (`target.manage`, ADR-0002);
 * this service is pure CRUD + audit.
 */

export async function isZieleSetupDismissed(
  db: PrismaClient,
  tenantId: TenantId,
): Promise<boolean> {
  const row = await db.setupProgress.findUnique({
    where: { tenantId_checkId: { tenantId, checkId: ZIELE_SETUP_DISMISSED_KEY } },
    select: { id: true },
  });
  return row != null;
}

/** Idempotent set-once: hides the guide for the tenant. */
export async function dismissZieleSetup(ctx: RequestContext): Promise<Result<{ dismissed: true }>> {
  const mctx = toMutationContext(ctx);
  return withAuditedTransaction(mctx, async (tx) => {
    const existing = await tx.setupProgress.findUnique({
      where: {
        tenantId_checkId: { tenantId: mctx.tenantId, checkId: ZIELE_SETUP_DISMISSED_KEY },
      },
      select: { id: true },
    });
    const id =
      existing?.id ??
      (
        await tx.setupProgress.create({
          data: {
            tenantId: mctx.tenantId,
            checkId: ZIELE_SETUP_DISMISSED_KEY,
            updatedBy: mctx.actorId,
          },
          select: { id: true },
        })
      ).id;

    return ok({
      result: { dismissed: true as const },
      audit: {
        action: "setup.check.toggled",
        resourceType: "setup_progress",
        resourceId: id,
        changes: {
          checkId: { before: ZIELE_SETUP_DISMISSED_KEY, after: ZIELE_SETUP_DISMISSED_KEY },
          completed: { before: false, after: true },
        },
      },
    });
  });
}
