import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { getPortfolioRoadmap } from "@/server/services/roadmap";
import { RoadmapGantt } from "@/features/roadmap/components/roadmap-gantt";
import { portfolioRoadmapRows, roadmapAxis } from "@/domain/roadmap";
import { redirect } from "next/navigation";

/** Portfolio roadmap — every Epic, timed via the PI windows of its Features. */
export default async function PortfolioRoadmapPage() {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const epics = await getPortfolioRoadmap(db, principal.tenantId);

  const rows = portfolioRoadmapRows(epics);
  const axis = roadmapAxis(rows);

  return (
    <main className="space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold">Portfolio-Roadmap</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Alle Epics, terminiert über die PI-Zeiträume ihrer Features.
        </p>
      </div>
      <RoadmapGantt rows={rows} axis={axis} />
    </main>
  );
}
