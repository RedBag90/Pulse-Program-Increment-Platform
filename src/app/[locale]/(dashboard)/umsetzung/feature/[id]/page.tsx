import { Suspense } from "react";
import { redirect, notFound } from "next/navigation";
import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { loadCockpitFeatureDetail } from "@/server/views/cockpit-feature-detail";
import { FeatureDetailShell } from "@/features/umsetzung/components/feature-detail-shell";

/**
 * Feature-Detail-Vollroute — der deeplinkbare Pfad fuer Bookmarks und
 * Cross-User-Sharing (Entscheidung #3). Das Cockpit-Slide-Over rendert
 * die gleiche `FeatureDetailShell` ueber demselben Loader; der Vollbild-
 * Pfad bleibt fuer Faelle in denen das Slide-Over nicht ausreicht
 * (Standalone-Tab, Email-Link, etc.).
 */
export default async function FeatureDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;

  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const detail = await loadCockpitFeatureDetail(db, principal, id);
  if (!detail) notFound();

  return (
    <Suspense fallback={null}>
      <FeatureDetailShell
        model={detail.model}
        canEdit={detail.canEdit}
        canTransition={detail.canTransition}
        canLinkDependency={detail.canLinkDependency}
        outgoing={detail.outgoing}
        incoming={detail.incoming}
        candidates={detail.candidates}
        historyEvents={detail.historyEvents}
        userLabels={detail.userLabels}
        {...(tab !== undefined ? { activeTab: tab } : {})}
      />
    </Suspense>
  );
}
