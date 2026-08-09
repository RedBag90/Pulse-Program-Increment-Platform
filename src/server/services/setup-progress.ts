import type { PrismaClient } from "@/generated/prisma";
import type { TenantId } from "@/domain/types";
import type { Result } from "@/domain/errors";
import { ok, err } from "@/domain/errors";
import type { RequestContext } from "@/server/http/mutation-handler";
import { withAuditedTransaction, toMutationContext } from "@/modules/core/kernel/server/mutation";
import { hasCapability } from "@/server/auth/authorize";

/**
 * Setup-Guide-Fortschritt — Tenant-weit geteilte Checkliste.
 *
 * Schreib-Recht ist auf Capability `tenant.users.manage` beschraenkt (de
 * facto: `tenant_admin` und `platform_admin`). Andere Rollen koennen den
 * Stand lesen, aber keine Boxes setzen — das ist die V0.2-Komplexitaets-
 * Reduktion: ein Verantwortlicher pro Tenant, kein Edit-Konflikt.
 *
 * Datenmodell ([prisma/schema.prisma](prisma/schema.prisma)): pro abgehaktem
 * Check existiert eine Row. Toggle on = Insert, Toggle off = Delete.
 */

export async function listSetupProgress(
  db: PrismaClient,
  tenantId: TenantId,
): Promise<Set<string>> {
  const rows = await db.setupProgress.findMany({
    where: { tenantId },
    select: { checkId: true },
  });
  return new Set(rows.map((r) => r.checkId));
}

export interface ToggleSetupCheckInput {
  checkId: string;
}

export async function toggleSetupCheck(
  ctx: RequestContext,
  input: ToggleSetupCheckInput,
): Promise<Result<{ checked: boolean }>> {
  const mctx = toMutationContext(ctx);
  const { checkId } = input;

  if (!hasCapability(ctx.principal, "tenant.users.manage")) {
    return err({
      kind: "forbidden" as const,
      reason: "Setup-Fortschritt darf nur der Tenant-Admin aendern",
    });
  }

  return withAuditedTransaction(mctx, async (tx) => {
    const existing = await tx.setupProgress.findUnique({
      where: { tenantId_checkId: { tenantId: mctx.tenantId, checkId } },
      select: { id: true },
    });

    if (existing) {
      await tx.setupProgress.delete({ where: { id: existing.id } });
      const result: { checked: boolean } = { checked: false };
      return ok({
        result,
        audit: {
          action: "setup.check.toggled",
          resourceType: "setup_progress",
          resourceId: existing.id,
          changes: {
            checkId: { before: checkId, after: checkId },
            completed: { before: true, after: false },
          },
        },
      });
    }

    const row = await tx.setupProgress.create({
      data: {
        tenantId: mctx.tenantId,
        checkId,
        updatedBy: mctx.actorId,
      },
      select: { id: true },
    });
    const result: { checked: boolean } = { checked: true };
    return ok({
      result,
      audit: {
        action: "setup.check.toggled",
        resourceType: "setup_progress",
        resourceId: row.id,
        changes: {
          checkId: { before: checkId, after: checkId },
          completed: { before: false, after: true },
        },
      },
    });
  });
}
