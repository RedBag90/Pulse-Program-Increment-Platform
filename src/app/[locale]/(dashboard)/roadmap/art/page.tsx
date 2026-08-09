import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { listArts } from "@/modules/core/org/server/services/art";
import { getArtRoadmap } from "@/modules/drumbeat/server/services/roadmap";
import { RoadmapGantt } from "@/features/roadmap/components/roadmap-gantt";
import { artRoadmapRows, roadmapAxis } from "@/modules/drumbeat/domain/roadmap";
import { Link } from "@/i18n/navigation";
import { redirect } from "next/navigation";
import type { ArtId } from "@/modules/core/kernel/domain/types";
import { Page, PageHeader } from "@/components/layout";

interface Props {
  searchParams: Promise<{ art?: string }>;
}

/** ART roadmap — every Feature of one ART, timed via its assigned PI. */
export default async function ArtRoadmapPage({ searchParams }: Props) {
  const { art } = await searchParams;

  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });

  const allArts = await listArts(db, principal.tenantId);
  const scopedArtIds = principal.scopes.artIds;
  const arts =
    scopedArtIds.length > 0 ? allArts.filter((a) => scopedArtIds.includes(a.id)) : allArts;

  if (arts.length === 0) {
    return (
      <Page>
        <PageHeader title="ART-Roadmap" subtitle="Keine ARTs verfügbar." />
      </Page>
    );
  }

  const activeArt = arts.find((a) => a.id === art) ?? arts[0]!;
  const features = await getArtRoadmap(db, principal.tenantId, activeArt.id as ArtId);

  const rows = artRoadmapRows(features);
  const axis = roadmapAxis(rows);

  return (
    <Page>
      <PageHeader
        title="ART-Roadmap"
        subtitle="Die Features eines ARTs, terminiert über ihre zugewiesene PI."
      />

      {arts.length > 1 && (
        <div className="flex flex-wrap gap-1 border-b">
          {arts.map((a) => (
            <Link
              key={a.id}
              href={`/roadmap/art?art=${a.id}`}
              className={`-mb-px border-b-2 px-3 py-1.5 text-sm transition-colors ${
                a.id === activeArt.id
                  ? "border-primary font-medium text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {a.name}
            </Link>
          ))}
        </div>
      )}

      <RoadmapGantt rows={rows} axis={axis} />
    </Page>
  );
}
