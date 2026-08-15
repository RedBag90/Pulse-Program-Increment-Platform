import type { PrismaClient } from "@/generated/prisma";
import type { TenantId } from "@/modules/core/kernel/domain/types";
import { ok, err, type Result } from "@/modules/core/kernel/domain/errors";
import type { RequestContext } from "@/server/http/mutation-handler";
import { withAuditedTransaction, toMutationContext } from "@/modules/core/kernel/server/mutation";

export interface IssueSettingsView {
  prefix: string;
  lastNumber: number;
}

/** Lazy read — returns the tenant default when no settings row exists yet. */
export async function getIssueSettings(
  db: PrismaClient,
  tenantId: TenantId,
): Promise<IssueSettingsView> {
  const row = await db.issueSettings.findUnique({
    where: { tenantId },
    select: { prefix: true, lastNumber: true },
  });
  return row ?? { prefix: "R-", lastNumber: 0 };
}

const MAX_PREFIX = 8;

/**
 * Admin sets the display prefix; never touches `lastNumber` or existing rows.
 * Reuses the `risk.settings.updated` / `risk_settings` audit vocabulary (Phase 2
 * additive — no registry churn until the UI cutover).
 */
export async function setIssuePrefix(
  ctx: RequestContext,
  input: { prefix: string },
): Promise<Result<{ prefix: string }>> {
  const prefix = input.prefix.trim();
  if (prefix.length === 0 || prefix.length > MAX_PREFIX) {
    return err({
      kind: "validation" as const,
      issues: [`Präfix muss 1–${MAX_PREFIX} Zeichen lang sein.`],
    });
  }
  const mctx = toMutationContext(ctx);
  return withAuditedTransaction(mctx, async (tx) => {
    const before = await tx.issueSettings.findUnique({
      where: { tenantId: mctx.tenantId },
      select: { prefix: true },
    });
    await tx.issueSettings.upsert({
      where: { tenantId: mctx.tenantId },
      create: { tenantId: mctx.tenantId, prefix },
      update: { prefix },
    });
    return ok({
      result: { prefix },
      audit: {
        action: "risk.settings.updated" as const,
        resourceType: "risk_settings" as const,
        resourceId: mctx.tenantId,
        changes: { prefix: { before: before?.prefix ?? "R-", after: prefix } },
      },
    });
  });
}
