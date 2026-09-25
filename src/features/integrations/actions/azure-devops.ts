"use server";

import { requirePrincipal } from "@/server/auth/principal";
import { authorize } from "@/server/auth/authorize";
import { createPrismaClient } from "@/server/db/prisma";
import type { TenantId } from "@/modules/core/kernel/domain/types";
import type { Prisma } from "@/generated/prisma";
import { revalidateRoute } from "@/server/http/revalidation";

export async function saveAdoProjectMapAction(
  map: Record<string, string>,
): Promise<{ error?: string }> {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) return { error: "Unauthorized" };

  if (!authorize("integration.manage", { tenantId: principal.tenantId }, principal).allow) {
    return { error: "Insufficient permissions" };
  }

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  await db.azureDevOpsConfig.update({
    where: { tenantId: principal.tenantId as TenantId },
    data: { projectMap: map as Prisma.InputJsonValue },
  });
  revalidateRoute("/admin/integrations");
  return {};
}

export async function disconnectAdoAction(): Promise<{ error?: string }> {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) return { error: "Unauthorized" };

  if (!authorize("integration.manage", { tenantId: principal.tenantId }, principal).allow) {
    return { error: "Insufficient permissions" };
  }

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  await db.azureDevOpsConfig.delete({ where: { tenantId: principal.tenantId as TenantId } });
  revalidateRoute("/admin/integrations");
  return {};
}
