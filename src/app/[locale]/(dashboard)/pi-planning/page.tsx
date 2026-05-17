import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { listArts } from "@/server/services/art";
import { listFeatures } from "@/server/services/feature";
import {
  FeaturePlanningBoard,
  type PlanningFeature,
} from "@/features/pi/components/feature-planning-board";
import { FeaturePlanningTable } from "@/features/pi/components/feature-planning-table";
import { Link } from "@/i18n/navigation";
import { redirect } from "next/navigation";
import type { ArtId } from "@/domain/types";

interface Props {
  searchParams: Promise<{ art?: string; view?: string }>;
}

/**
 * PI Planning — an ART-scoped surface for assigning Features into the ART's PIs.
 * Switchable between a drag-and-drop board and a PI-grouped table.
 */
export default async function PiPlanningPage({ searchParams }: Props) {
  const { art, view } = await searchParams;
  const activeView = view === "table" ? "table" : "board";

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
        <h1 className="text-2xl font-semibold">PI Planning</h1>
        <p className="text-sm text-muted-foreground">
          Keine ARTs verfügbar. Lege im Capacity-Planning-Modul eine ART an.
        </p>
      </main>
    );
  }

  const activeArt = arts.find((a) => a.id === art) ?? arts[0]!;

  const canEdit =
    principal.roles.includes("portfolio_editor") ||
    principal.roles.includes("art_full_editor") ||
    principal.roles.includes("feature_editor") ||
    principal.roles.includes("tenant_admin") ||
    principal.roles.includes("platform_admin");

  const [pisRaw, featurePage] = await Promise.all([
    db.programIncrement.findMany({
      where: { tenantId: principal.tenantId, artId: activeArt.id },
      select: {
        id: true,
        name: true,
        status: true,
        startDate: true,
        endDate: true,
        _count: { select: { sprints: true } },
      },
      orderBy: { startDate: "asc" },
    }),
    listFeatures(db, principal.tenantId, activeArt.id as ArtId),
  ]);

  const pis = pisRaw.map((p) => ({
    id: p.id,
    name: p.name,
    status: p.status,
    startDate: p.startDate,
    endDate: p.endDate,
    sprintCount: p._count.sprints,
  }));

  const features: PlanningFeature[] = featurePage.items.map((f) => ({
    id: f.id,
    title: f.title,
    status: f.status,
    wsjf: Number(f.wsjfComputed ?? 0),
    epicTitle: f.parent?.title ?? null,
    piId: f.piId,
  }));

  return (
    <main className="space-y-6 p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">PI Planning</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Features in die PIs des ARTs einplanen — als Board oder Tabelle.
          </p>
        </div>
        <div className="flex shrink-0 overflow-hidden rounded-md border text-sm">
          {(["board", "table"] as const).map((v) => (
            <Link
              key={v}
              href={`/pi-planning?art=${activeArt.id}&view=${v}`}
              className={`px-3 py-1.5 transition-colors ${
                activeView === v
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {v === "board" ? "Board" : "Tabelle"}
            </Link>
          ))}
        </div>
      </div>

      {arts.length > 1 && (
        <div className="flex flex-wrap gap-1 border-b">
          {arts.map((a) => (
            <Link
              key={a.id}
              href={`/pi-planning?art=${a.id}&view=${activeView}`}
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

      {pis.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {activeArt.name} hat noch keine Program Increments. Lege zuerst eine PI an.
        </p>
      ) : activeView === "table" ? (
        <FeaturePlanningTable
          artId={activeArt.id}
          canEdit={canEdit}
          features={features}
          pis={pis}
        />
      ) : (
        <FeaturePlanningBoard
          artId={activeArt.id}
          canEdit={canEdit}
          features={features}
          pis={pis}
        />
      )}
    </main>
  );
}
