import { requirePrincipal } from "@/server/auth/principal";
import { hasCapability } from "@/server/auth/authorize";
import { createPrismaClient } from "@/server/db/prisma";
import { getArt } from "@/modules/core/org/server/services/art";
import { listPis } from "@/modules/drumbeat/server/services/pi";
import { listAuditHistory } from "@/server/services/audit-history";
import { listTenantApprovers } from "@/modules/work/server/services/epic-approval";
import { listTenantUserLabels } from "@/server/services/tenant-users";
import {
  ArtDetailShell,
  resolveArtTab,
} from "@/modules/core/org/features/art/components/art-detail-shell";
import { ArtOverviewTab } from "@/modules/core/org/features/art/components/tabs/art-overview-tab";
import { ArtPiTab } from "@/modules/core/org/features/art/components/tabs/art-pi-tab";
import { ArtSettingsTab } from "@/modules/core/org/features/art/components/tabs/art-settings-tab";
import { ArtHistoryTab } from "@/modules/core/org/features/art/components/tabs/art-history-tab";
import { LayoutToggle } from "@/components/nav/layout-toggle";
import { tabToOldHref } from "@/components/nav/layout-toggle-routes";
import { redirect, notFound } from "next/navigation";
import { InitiativeLevel } from "@/modules/core/kernel/domain/types";
import type { ArtId, TenantId } from "@/modules/core/kernel/domain/types";

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

  if (tab === "pi") {
    const { items: pis } = await listPis(db, principal.tenantId, artId as ArtId);
    tabContent = <ArtPiTab pis={pis} piCadenceWeeks={art.piCadenceWeeks} />;
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
    const featureCount = await db.initiative.count({
      where: {
        artId,
        tenantId: principal.tenantId as TenantId,
        level: InitiativeLevel.FEATURE,
        deletedAt: null,
      },
    });
    tabContent = <ArtOverviewTab artId={artId} pis={art.pis} featureCount={featureCount} />;
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
