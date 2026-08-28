import { redirect, notFound } from "next/navigation";
import { requirePrincipal } from "@/server/auth/principal";
import { hasCapability } from "@/server/auth/authorize";
import { createPrismaClient } from "@/server/db/prisma";
import { loadIssueDetail } from "@/modules/risks/server/views/issues";
import { IssueDetailShell } from "@/modules/risks/features/issue/components/issue-detail-shell";

/**
 * Issue-Detail-Vollroute — deeplinkbar, rendert dieselbe `IssueDetailShell` über
 * demselben Read wie der Register-Slide-Over (`?issue=`). Ein Datenmodell, ein
 * Tab-Set; hier mit URL-Tab-Routing (`?tab=`) und Zurück-Link ins Register.
 */
interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export default async function IssueDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { tab } = await searchParams;

  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const detail = await loadIssueDetail(db, principal, id);
  if (!detail) notFound();

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
    <IssueDetailShell
      issue={detail.row}
      userLabels={detail.userLabels}
      caps={caps}
      backHref="/issues"
      backLabel="Zurück zum Register"
      {...(tab !== undefined ? { activeTab: tab } : {})}
    />
  );
}
