import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requirePrincipal } from "@/server/auth/principal";
import { hasCapability } from "@/server/auth/authorize";
import { createPrismaClient } from "@/server/db/prisma";
import type { TenantId } from "@/modules/core/kernel/domain/types";
import { buildIntegrationsPageModel } from "@/server/views/admin-integrations";
import { IntegrationsPageShell } from "@/features/admin/components/integrations-page-shell";

interface Props {
  searchParams: Promise<{ connected?: string; error?: string }>;
}

/**
 * Admin integrations page — master-detail layout with the two integrations
 * (Jira Cloud · Azure DevOps) as list items on the left and the selected
 * one's connection / mapping / webhook detail on the right. Replaces the
 * two duplicated section blocks of the old page with one shared shape.
 */
export default async function IntegrationsPage({ searchParams }: Props) {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");
  if (!hasCapability(principal, "integration.manage")) redirect("/portfolio");

  const { connected, error } = await searchParams;

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const [jiraConfig, adoConfig, arts] = await Promise.all([
    db.jiraConfig.findUnique({ where: { tenantId: principal.tenantId as TenantId } }),
    db.azureDevOpsConfig.findUnique({ where: { tenantId: principal.tenantId as TenantId } }),
    db.art.findMany({
      where: { tenantId: principal.tenantId, deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const model = buildIntegrationsPageModel({
    jiraConfig: jiraConfig
      ? {
          instanceUrl: jiraConfig.instanceUrl,
          cloudId: jiraConfig.cloudId,
          projectKeyMap: jiraConfig.projectKeyMap,
        }
      : null,
    adoConfig: adoConfig
      ? { organization: adoConfig.organization, projectMap: adoConfig.projectMap }
      : null,
    arts,
    tenantId: principal.tenantId,
    appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "",
  });

  const banner =
    connected === "1"
      ? ({ kind: "success", message: "Jira erfolgreich verbunden." } as const)
      : error
        ? ({ kind: "error", message: `Fehler: ${error}` } as const)
        : undefined;

  return (
    <Suspense fallback={null}>
      <IntegrationsPageShell model={model} canManage={true} banner={banner} />
    </Suspense>
  );
}
