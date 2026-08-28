import { redirect, notFound } from "next/navigation";
import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { loadCockpitFeatureDetail } from "@/modules/drumbeat/server/views/cockpit-feature-detail";
import { FeatureDetailShell } from "@/modules/drumbeat/features/cockpit/components/feature-detail-shell";
import { DeleteFeatureButton } from "@/modules/work/features/feature/components/delete-feature-button";

/**
 * Feature-Detail-Vollroute (ART-Kontext) — deeplinkbar aus WSJF-Leaderboard,
 * Abhaengigkeiten-Uebersicht, Feature-Listen und Budget-Revisionen. Rendert
 * dieselbe `FeatureDetailShell` ueber demselben Loader wie `/umsetzung/feature/[id]`
 * und das Cockpit-Slide-Over; einziger Unterschied ist der ART-Rueck-Link und
 * die `?tab=`-Basis. So gibt es nur noch **eine** Feature-Detail-Flaeche.
 */
interface Props {
  params: Promise<{ featureId: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export default async function FeatureDetailPage({ params, searchParams }: Props) {
  const { featureId } = await params;
  const { tab } = await searchParams;

  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const detail = await loadCockpitFeatureDetail(db, principal, featureId);
  if (!detail) notFound();

  const artId = detail.model.art?.id ?? "";
  const artName = detail.model.art?.name ?? "ART";

  return (
    <FeatureDetailShell
      model={detail.model}
      canEdit={detail.canEdit}
      canTransition={detail.canTransition}
      canAssignOwner={detail.canAssignOwner}
      approvers={detail.approvers}
      canLinkDependency={detail.canLinkDependency}
      outgoing={detail.outgoing}
      incoming={detail.incoming}
      candidates={detail.candidates}
      historyEvents={detail.historyEvents}
      userLabels={detail.userLabels}
      blockerWindows={detail.blockerWindows}
      blockerSummary={detail.blockerSummary}
      backHref={`/umsetzung?art=${artId}&view=table`}
      backLabel={`Zurück zu ${artName}`}
      basePath={`/feature/${featureId}`}
      {...(tab !== undefined ? { activeTab: tab } : {})}
      {...(detail.canEdit
        ? {
            headerActions: (
              <DeleteFeatureButton id={featureId} artId={artId} title={detail.model.title} />
            ),
          }
        : {})}
    />
  );
}
