"use server";

import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import type { TenantId } from "@/domain/types";
import type { Prisma } from "@/generated/prisma";
import { revalidatePath } from "next/cache";

export async function saveAdoProjectMapAction(
  map: Record<string, string>,
): Promise<{ error?: string }> {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) return { error: "Unauthorized" };

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  await db.azureDevOpsConfig.update({
    where: { tenantId: principal.tenantId as TenantId },
    data: { projectMap: map as Prisma.InputJsonValue },
  });
  revalidatePath("/admin/integrations");
  return {};
}

export async function disconnectAdoAction(): Promise<{ error?: string }> {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) return { error: "Unauthorized" };

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  await db.azureDevOpsConfig.delete({ where: { tenantId: principal.tenantId as TenantId } });
  revalidatePath("/admin/integrations");
  return {};
}
