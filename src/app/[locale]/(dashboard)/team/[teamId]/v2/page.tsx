import { requirePrincipal } from "@/server/auth/principal";
import { hasCapability } from "@/server/auth/authorize";
import { createPrismaClient } from "@/server/db/prisma";
import { getTeam } from "@/modules/core/org/server/services/team";
import { listAuditHistory } from "@/server/services/audit-history";
import { listTenantApprovers } from "@/server/services/epic-approval";
import { listTenantUserLabels } from "@/server/services/tenant-users";
import { TeamDetailShell, resolveTeamTab } from "@/features/team/components/team-detail-shell";
import { TeamOverviewTab } from "@/features/team/components/tabs/team-overview-tab";
import { TeamSettingsTab } from "@/features/team/components/tabs/team-settings-tab";
import { TeamHistoryTab } from "@/features/team/components/tabs/team-history-tab";
import { LayoutToggle } from "@/components/nav/layout-toggle";
import { tabToOldHref } from "@/components/nav/layout-toggle-routes";
import { redirect, notFound } from "next/navigation";
import type { TeamId } from "@/domain/types";

interface Props {
  params: Promise<{ teamId: string }>;
  searchParams: Promise<{ tab?: string }>;
}

/**
 * Tab-Detail-Variante von Team — parallel zu den klassischen Sub-Routes
 * `/team/[teamId]/settings` und `/team/[teamId]/history`. Per LayoutToggle
 * im Header kann zwischen beiden Welten umgeschaltet werden.
 */
export default async function TeamV2Page({ params, searchParams }: Props) {
  const [{ teamId }, { tab: rawTab }] = await Promise.all([params, searchParams]);
  const tab = resolveTeamTab(rawTab);

  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const team = await getTeam(db, principal.tenantId, teamId as TeamId);
  if (!team) notFound();

  const canEdit = hasCapability(principal, "team.update", {
    tenantId: principal.tenantId,
    teamId,
    artId: team.artId,
  });

  // Pro Tab nur was er braucht laden — Server-Component pro Tab-Branche.
  let tabContent: React.ReactNode = null;
  if (tab === "history") {
    const history = await listAuditHistory(db, principal.tenantId, "team", team.id);
    const events = history.map((e) => ({
      id: e.id,
      action: e.action,
      occurredAt: e.occurredAt.toISOString(),
    }));
    tabContent = <TeamHistoryTab events={events} />;
  } else if (tab === "settings") {
    const [approvers, userLabels] = await Promise.all([
      listTenantApprovers(db, principal.tenantId),
      listTenantUserLabels(db, principal.tenantId),
    ]);
    tabContent = (
      <TeamSettingsTab
        team={team}
        canEdit={canEdit}
        approvers={approvers}
        userLabels={userLabels}
      />
    );
  } else {
    // overview (default)
    const userLabels = await listTenantUserLabels(db, principal.tenantId);
    tabContent = <TeamOverviewTab team={team} userLabels={userLabels} />;
  }

  return (
    <TeamDetailShell
      teamId={teamId}
      teamName={team.name}
      artId={team.artId}
      artName={team.art.name}
      activeTab={tab}
      headerActions={<LayoutToggle current="new" otherHref={tabToOldHref("team", teamId, tab)} />}
    >
      {tabContent}
    </TeamDetailShell>
  );
}
