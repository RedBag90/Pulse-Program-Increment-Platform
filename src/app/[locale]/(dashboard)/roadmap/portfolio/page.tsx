import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { getPortfolioRoadmap } from "@/server/services/roadmap";
import { RoadmapGantt, type RoadmapRow } from "@/features/roadmap/components/roadmap-gantt";
import { buildMonthAxis, deriveTimeframe, type DateRange } from "@/domain/roadmap";
import { redirect } from "next/navigation";

/** Portfolio roadmap — every Epic, timed via the PI windows of its Features. */
export default async function PortfolioRoadmapPage() {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const epics = await getPortfolioRoadmap(db, principal.tenantId);

  const rows: RoadmapRow[] = epics.map((e): RoadmapRow => {
    const featureRanges = e.children.map((c) =>
      c.pi ? { start: c.pi.startDate, end: c.pi.endDate } : null,
    );
    return {
      id: e.id,
      label: e.title,
      sublabel: e.valueStream?.name,
      href: `/portfolio/epics/${e.id}`,
      range: deriveTimeframe(featureRanges),
      depth: 0,
      kind: "epic",
    };
  });

  const axis = buildMonthAxis(rows.map((r) => r.range).filter((r): r is DateRange => r !== null));

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
