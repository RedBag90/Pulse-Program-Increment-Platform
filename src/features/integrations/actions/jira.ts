"use server";

import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { TenantId } from "@/domain/types";
import type { Prisma } from "@/generated/prisma";

export interface JiraActionState {
  error?: string;
  success?: boolean;
}

export async function saveJiraProjectMapAction(
  projectKeyMap: Record<string, string>,
): Promise<JiraActionState> {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const canManage =
    principal.roles.includes("tenant_admin") || principal.roles.includes("platform_admin");
  if (!canManage) return { error: "Insufficient permissions" };

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });

  const config = await db.jiraConfig.findUnique({
    where: { tenantId: principal.tenantId as TenantId },
  });
  if (!config) return { error: "Jira integration not connected" };

  await db.jiraConfig.update({
    where: { tenantId: principal.tenantId as TenantId },
    data: { projectKeyMap: projectKeyMap as Prisma.InputJsonValue },
  });

  revalidatePath("/admin/integrations");
  return { success: true };
}

export async function disconnectJiraAction(): Promise<JiraActionState> {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const canManage =
    principal.roles.includes("tenant_admin") || principal.roles.includes("platform_admin");
  if (!canManage) return { error: "Insufficient permissions" };

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });

  await db.jiraConfig.deleteMany({
    where: { tenantId: principal.tenantId as TenantId },
  });

  revalidatePath("/admin/integrations");
  return { success: true };
}
