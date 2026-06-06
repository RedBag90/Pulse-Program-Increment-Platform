import { redirect } from "next/navigation";
import { requirePrincipal } from "@/server/auth/principal";
import { authorize } from "@/server/auth/authorize";
import { createPrismaClient } from "@/server/db/prisma";
import { buildRteCockpitModel } from "@/server/views/rte-cockpit";
import { RteCockpitShell } from "@/features/rte/components/rte-cockpit-shell";

/**
 * RTE-Cockpit für einen einzelnen ART. Hero · 3 Today-Karten · Per-Team
 * RAG · Epic→Feature-Rollup — alle CTAs verlinken in die bestehenden
 * Listen / Drawer (`/my-approvals`, `/art/<id>/impediments`, `/pi/
 * <id>/dependencies`, `/portfolio/epics/<id>`).
 */
export default async function RteCockpitArtPage({
  params,
}: {
  params: Promise<{ locale: string; artId: string }>;
}) {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const { artId } = await params;
  if (
    !authorize("feature.review.decide", { tenantId: principal.tenantId, artId }, principal).allow
  ) {
    redirect("/");
  }

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const model = await buildRteCockpitModel(db, principal, artId);
  return <RteCockpitShell model={model} />;
}
