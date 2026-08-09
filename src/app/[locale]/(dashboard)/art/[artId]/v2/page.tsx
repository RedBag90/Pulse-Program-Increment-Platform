import { requirePrincipal } from "@/server/auth/principal";
import { hasCapability } from "@/server/auth/authorize";
import { createPrismaClient } from "@/server/db/prisma";
import { getArt } from "@/modules/core/org/server/services/art";
import { listTeams } from "@/modules/core/org/server/services/team";
import { listPis } from "@/server/services/pi";
import { listImpediments } from "@/server/services/impediment";
import { listAuditHistory } from "@/server/services/audit-history";
import { listTenantApprovers } from "@/server/services/epic-approval";
import { listTenantUserLabels } from "@/server/services/tenant-users";
import { buildImpedimentsListModel } from "@/server/views/impediments-list";
import { ArtDetailShell, resolveArtTab } from "@/modules/core/org/features/art/components/art-detail-shell";
import { ArtOverviewTab } from "@/modules/core/org/features/art/components/tabs/art-overview-tab";
import { ArtTeamsTab } from "@/modules/core/org/features/art/components/tabs/art-teams-tab";
import { ArtPiTab } from "@/modules/core/org/features/art/components/tabs/art-pi-tab";
import { ArtImpedimentsTab } from "@/modules/core/org/features/art/components/tabs/art-impediments-tab";
import { ArtSettingsTab } from "@/modules/core/org/features/art/components/tabs/art-settings-tab";
import { ArtHistoryTab } from "@/modules/core/org/features/art/components/tabs/art-history-tab";
import { LayoutToggle } from "@/components/nav/layout-toggle";
import { tabToOldHref } from "@/components/nav/layout-toggle-routes";
import { redirect, notFound } from "next/navigation";
import { InitiativeLevel } from "@/domain/types";
import type { ArtId, TenantId } from "@/domain/types";

interface Props {
  params: Promise<{ artId: string }>;
  searchParams: Promise<{ tab?: string }>;
}

/**
 * Tab-Detail-Variante von ART — parallel zur klassischen Sub-Route-Welt
 * (`/art/[artId]` + teams, pi, impediments, settings, history). LayoutToggle
 * im Header wechselt zwischen beiden Varianten.
 */
export default async function ArtV2Page({ params, searchParams }: Props) {
  const [{ artId }, { tab: rawTab }] = await Promise.all([params, searchParams]);
  const tab = resolveArtTab(rawTab);

  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const art = await getArt(db, principal.tenantId, artId as ArtId);
  if (!art) notFound();

  let tabContent: React.ReactNode = null;

  if (tab === "teams") {
    const teams = await listTeams(db, principal.tenantId, artId as ArtId);
    const canEdit = hasCapability(principal, "team.create", {
      tenantId: principal.tenantId,
      artId,
    });
    tabContent = <ArtTeamsTab artId={artId} teams={teams} canEdit={canEdit} />;
  } else if (tab === "pi") {
    const { items: pis } = await listPis(db, principal.tenantId, artId as ArtId);
    tabContent = <ArtPiTab pis={pis} piCadenceWeeks={art.piCadenceWeeks} />;
  } else if (tab === "impediments") {
    const [{ items: impediments }, pis, userLabels] = await Promise.all([
      listImpediments(db, principal.tenantId as TenantId, artId as ArtId, {}),
      db.programIncrement.findMany({
        where: { tenantId: principal.tenantId, artId },
        orderBy: { startDate: "desc" },
        select: { id: true, name: true },
      }),
      listTenantUserLabels(db, principal.tenantId),
    ]);
    const canCreate = hasCapability(principal, "impediment.create", {
      tenantId: principal.tenantId,
      artId,
    });
    const canEscalate = hasCapability(principal, "impediment.escalate", {
      tenantId: principal.tenantId,
      artId,
    });
    const canResolve = hasCapability(principal, "impediment.resolve", {
      tenantId: principal.tenantId,
      artId,
    });
    const model = buildImpedimentsListModel({
      impediments: impediments.map((i) => ({
        id: i.id,
        title: i.title,
        description: i.description,
        status: i.status,
        severity: i.severity,
        raisedBy: i.raisedBy,
        piId: i.piId,
        sprintId: null,
        createdAt: i.createdAt,
        resolution: i.resolution,
        resolvedAt: i.resolvedAt,
      })),
      pis,
      userLabels,
    });
    tabContent = (
      <ArtImpedimentsTab
        artId={artId}
        model={model}
        canCreate={canCreate}
        canEscalate={canEscalate}
        canResolve={canResolve}
      />
    );
  } else if (tab === "settings") {
    const [approvers, userLabels] = await Promise.all([
      listTenantApprovers(db, principal.tenantId),
      listTenantUserLabels(db, principal.tenantId),
    ]);
    const canEdit = hasCapability(principal, "art.update", {
      tenantId: principal.tenantId,
      artId,
    });
    tabContent = (
      <ArtSettingsTab art={art} canEdit={canEdit} approvers={approvers} userLabels={userLabels} />
    );
  } else if (tab === "history") {
    const history = await listAuditHistory(db, principal.tenantId, "art", art.id);
    const events = history.map((e) => ({
      id: e.id,
      action: e.action,
      occurredAt: e.occurredAt.toISOString(),
    }));
    tabContent = <ArtHistoryTab events={events} />;
  } else {
    // overview (default)
    const [teamCount, featureCount] = await Promise.all([
      db.team.count({ where: { artId, tenantId: principal.tenantId as TenantId } }),
      db.initiative.count({
        where: {
          artId,
          tenantId: principal.tenantId as TenantId,
          level: InitiativeLevel.FEATURE,
          deletedAt: null,
        },
      }),
    ]);
    tabContent = (
      <ArtOverviewTab
        artId={artId}
        pis={art.pis}
        teamCount={teamCount}
        featureCount={featureCount}
      />
    );
  }

  return (
    <ArtDetailShell
      artId={artId}
      artName={art.name}
      valueStreamName={art.valueStream.name}
      activeTab={tab}
      headerActions={<LayoutToggle current="new" otherHref={tabToOldHref("art", artId, tab)} />}
    >
      {tabContent}
    </ArtDetailShell>
  );
}
