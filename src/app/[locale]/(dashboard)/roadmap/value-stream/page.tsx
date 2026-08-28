import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { listValueStreams } from "@/modules/core/org/server/services/value-stream";
import { getValueStreamRoadmap } from "@/modules/drumbeat/server/services/roadmap";
import { RoadmapGantt } from "@/modules/drumbeat/features/roadmap/components/roadmap-gantt";
import { valueStreamRoadmapRows, roadmapAxis } from "@/modules/work/domain/roadmap";
import { Link } from "@/i18n/navigation";
import { redirect } from "next/navigation";
import type { ValueStreamId } from "@/modules/core/kernel/domain/types";
import { Page, PageHeader } from "@/components/layout";

interface Props {
  searchParams: Promise<{ vs?: string; group?: string }>;
}

/**
 * Value Stream roadmap — the VS's Epics and the Features of its ARTs, viewable
 * hierarchically (Epic → Features) or grouped by ART.
 */
export default async function ValueStreamRoadmapPage({ searchParams }: Props) {
  const { vs, group } = await searchParams;
  const activeGroup = group === "art" ? "art" : "epic";

  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const valueStreams = await listValueStreams(db, principal.tenantId);

  if (valueStreams.length === 0) {
    return (
      <Page>
        <PageHeader title="Wertstrom-Roadmap" subtitle="Keine Wertströme verfügbar." />
      </Page>
    );
  }

  const activeVs = valueStreams.find((v) => v.id === vs) ?? valueStreams[0]!;
  const epics = await getValueStreamRoadmap(db, principal.tenantId, activeVs.id as ValueStreamId);

  const rows = valueStreamRoadmapRows(epics, activeGroup);
  const axis = roadmapAxis(rows);

  return (
    <Page>
      <PageHeader
        title="Wertstrom-Roadmap"
        subtitle="Epics des Wertstroms und die Features seiner ARTs."
        actions={
          <div className="flex shrink-0 overflow-hidden rounded-md border text-sm">
            {(["epic", "art"] as const).map((g) => (
              <Link
                key={g}
                href={`/roadmap/value-stream?vs=${activeVs.id}&group=${g}`}
                className={`px-3 py-1.5 transition-colors ${
                  activeGroup === g
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {g === "epic" ? "Hierarchisch" : "Nach ART"}
              </Link>
            ))}
          </div>
        }
      />

      {valueStreams.length > 1 && (
        <div className="flex flex-wrap gap-1 border-b">
          {valueStreams.map((v) => (
            <Link
              key={v.id}
              href={`/roadmap/value-stream?vs=${v.id}&group=${activeGroup}`}
              className={`-mb-px border-b-2 px-3 py-1.5 text-sm transition-colors ${
                v.id === activeVs.id
                  ? "border-primary font-medium text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {v.name}
            </Link>
          ))}
        </div>
      )}

      <RoadmapGantt rows={rows} axis={axis} />
    </Page>
  );
}
