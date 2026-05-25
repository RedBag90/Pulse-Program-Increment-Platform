import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { listArts } from "@/server/services/art";
import { getArtRoadmap } from "@/server/services/roadmap";
import { RoadmapGantt } from "@/features/roadmap/components/roadmap-gantt";
import { artRoadmapRows, roadmapAxis } from "@/domain/roadmap";
import { Link } from "@/i18n/navigation";
import { redirect } from "next/navigation";
import type { ArtId } from "@/domain/types";

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
      <main className="mx-auto max-w-5xl space-y-2 p-8">
        <h1 className="text-2xl font-semibold">ART-Roadmap</h1>
        <p className="text-sm text-muted-foreground">Keine ARTs verfügbar.</p>
      </main>
    );
  }

  const activeArt = arts.find((a) => a.id === art) ?? arts[0]!;
  const features = await getArtRoadmap(db, principal.tenantId, activeArt.id as ArtId);

  const rows = artRoadmapRows(features);
  const axis = roadmapAxis(rows);

  return (
    <main className="space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold">ART-Roadmap</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Die Features eines ARTs, terminiert über ihre zugewiesene PI.
        </p>
      </div>

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
    </main>
  );
}
