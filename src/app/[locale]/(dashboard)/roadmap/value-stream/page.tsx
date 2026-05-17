import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { listValueStreams } from "@/server/services/value-stream";
import { getValueStreamRoadmap } from "@/server/services/roadmap";
import { RoadmapGantt, type RoadmapRow } from "@/features/roadmap/components/roadmap-gantt";
import { buildMonthAxis, deriveTimeframe, type DateRange } from "@/domain/roadmap";
import { Link } from "@/i18n/navigation";
import { redirect } from "next/navigation";
import type { ValueStreamId } from "@/domain/types";

interface Props {
  searchParams: Promise<{ vs?: string; group?: string }>;
}

type VsEpic = Awaited<ReturnType<typeof getValueStreamRoadmap>>[number];
type VsFeature = VsEpic["children"][number];

function featureRange(f: VsFeature): DateRange | null {
  return f.pi ? { start: f.pi.startDate, end: f.pi.endDate } : null;
}

/** Rows for the hierarchical view: each Epic followed by its indented Features. */
function epicGroupedRows(epics: VsEpic[]): RoadmapRow[] {
  const rows: RoadmapRow[] = [];
  for (const e of epics) {
    rows.push({
      id: e.id,
      label: e.title,
      href: `/portfolio/epics/${e.id}`,
      range: deriveTimeframe(e.children.map(featureRange)),
      depth: 0,
      kind: "epic",
    });
    for (const f of e.children) {
      rows.push({
        id: f.id,
        label: f.title,
        sublabel: f.art?.name,
        href: `/feature/${f.id}`,
        range: featureRange(f),
        depth: 1,
        kind: "feature",
      });
    }
  }
  return rows;
}

/** Rows for the by-ART view: an Epics section, then one section per ART. */
function artGroupedRows(epics: VsEpic[]): RoadmapRow[] {
  const rows: RoadmapRow[] = [
    { id: "__epics__", label: "Epics", range: null, depth: 0, kind: "group" },
  ];
  for (const e of epics) {
    rows.push({
      id: e.id,
      label: e.title,
      href: `/portfolio/epics/${e.id}`,
      range: deriveTimeframe(e.children.map(featureRange)),
      depth: 0,
      kind: "epic",
    });
  }

  const byArt = new Map<string, { name: string; features: VsFeature[] }>();
  for (const f of epics.flatMap((e) => e.children)) {
    const key = f.artId ?? "__none__";
    if (!byArt.has(key)) byArt.set(key, { name: f.art?.name ?? "Ohne ART", features: [] });
    byArt.get(key)!.features.push(f);
  }
  for (const [key, group] of byArt) {
    rows.push({ id: `art-${key}`, label: group.name, range: null, depth: 0, kind: "group" });
    for (const f of group.features) {
      rows.push({
        id: f.id,
        label: f.title,
        href: `/feature/${f.id}`,
        range: featureRange(f),
        depth: 1,
        kind: "feature",
      });
    }
  }
  return rows;
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
      <main className="mx-auto max-w-5xl space-y-2 p-8">
        <h1 className="text-2xl font-semibold">Wertstrom-Roadmap</h1>
        <p className="text-sm text-muted-foreground">Keine Wertströme verfügbar.</p>
      </main>
    );
  }

  const activeVs = valueStreams.find((v) => v.id === vs) ?? valueStreams[0]!;
  const epics = await getValueStreamRoadmap(db, principal.tenantId, activeVs.id as ValueStreamId);

  const rows = activeGroup === "art" ? artGroupedRows(epics) : epicGroupedRows(epics);
  const axis = buildMonthAxis(rows.map((r) => r.range).filter((r): r is DateRange => r !== null));

  return (
    <main className="space-y-6 p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Wertstrom-Roadmap</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Epics des Wertstroms und die Features seiner ARTs.
          </p>
        </div>
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
      </div>

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
    </main>
  );
}
