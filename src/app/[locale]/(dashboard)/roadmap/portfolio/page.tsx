import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { getPortfolioRoadmap } from "@/modules/drumbeat/server/services/roadmap";
import { RoadmapGantt } from "@/modules/drumbeat/features/roadmap/components/roadmap-gantt";
import { portfolioRoadmapRows, roadmapAxis } from "@/modules/work/domain/roadmap";
import { redirect } from "next/navigation";
import { Page, PageHeader } from "@/components/layout";

/** Portfolio roadmap — every Epic, timed via the PI windows of its Features. */
export default async function PortfolioRoadmapPage() {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const epics = await getPortfolioRoadmap(db, principal.tenantId);

  const rows = portfolioRoadmapRows(epics);
  const axis = roadmapAxis(rows);

  return (
    <Page>
      <PageHeader
        title="Portfolio-Roadmap"
        subtitle="Alle Epics, terminiert über die PI-Zeiträume ihrer Features."
      />
      <RoadmapGantt rows={rows} axis={axis} />
    </Page>
  );
}
