import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requirePrincipal } from "@/server/auth/principal";
import { hasCapability } from "@/server/auth/authorize";
import { createPrismaClient } from "@/server/db/prisma";
import { loadIssues } from "@/modules/risks/server/views/issues";
import { IssuesListShell } from "@/modules/risks/features/issue/components/issues-list-shell";

/**
 * Issue register — the tenant-wide unified board of risks + impediments (ROAM
 * funnel + probability×impact matrix + facet filters + bulk), scoped reads
 * (`issueReadFilter`). Composition root for the merged risks/impediment surface.
 */
export default async function IssuesPage() {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const { model, userLabels } = await loadIssues(db, principal, { kind: "tenant" });

  const scope = { tenantId: principal.tenantId };
  const caps = {
    canDocument: hasCapability(principal, "risk.document", scope),
    canUpdate: hasCapability(principal, "risk.update", scope),
    canRoam: hasCapability(principal, "risk.roam", scope),
    canLink: hasCapability(principal, "risk.link", scope),
    canDelete: hasCapability(principal, "risk.delete", scope),
    canReview: hasCapability(principal, "risk.review", scope),
    canManageSettings: hasCapability(principal, "risk.settings.manage", scope),
  };

  return (
    <Suspense fallback={null}>
      <IssuesListShell model={model} userLabels={userLabels} caps={caps} />
    </Suspense>
  );
}
