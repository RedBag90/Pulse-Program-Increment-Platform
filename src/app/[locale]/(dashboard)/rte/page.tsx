import { redirect } from "next/navigation";
import { requirePrincipal } from "@/server/auth/principal";
import { authorize } from "@/server/auth/authorize";
import { createPrismaClient } from "@/server/db/prisma";
import { buildRtePortfolioModel } from "@/server/views/rte-cockpit";
import { RtePortfolioShell } from "@/features/rte/components/rte-portfolio-shell";

/**
 * RTE-Cockpit Einstieg — Portfolio-Modus. Wenn der Principal genau
 * einen ART sieht (entweder über `scopes.artIds = [id]` oder weil im
 * Tenant nur ein ART existiert), wird direkt auf `/rte/<artId>`
 * weitergeleitet. Sonst rendert die Seite die ART-Auswahlliste mit
 * Roll-up-Zeile pro ART.
 */
export default async function RteCockpitIndexPage() {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  if (!authorize("feature.review.decide", { tenantId: principal.tenantId }, principal).allow) {
    redirect("/");
  }

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });

  const scopedArtIds = principal.scopes.artIds;
  const tenantArtIds =
    scopedArtIds.length > 0
      ? scopedArtIds
      : (
          await db.art.findMany({
            where: { tenantId: principal.tenantId, deletedAt: null },
            select: { id: true },
          })
        ).map((a) => a.id);

  if (tenantArtIds.length === 1) {
    redirect(`/rte/${tenantArtIds[0]}`);
  }

  const model = await buildRtePortfolioModel(db, principal, tenantArtIds);
  return <RtePortfolioShell model={model} />;
}
