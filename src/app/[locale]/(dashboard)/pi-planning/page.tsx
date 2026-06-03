import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { listArts } from "@/server/services/art";
import { listArtPlanningPis } from "@/server/services/pi";
import { listFeatures } from "@/server/services/feature";
import { getBlockerWindowsForFeatures } from "@/server/services/dependency";
import { buildPlanningModel, earliestFundedCycle } from "@/server/views/pi-planning";
import { halfYearKey } from "@/domain/calendar";
import { FeaturePlanningBoard } from "@/features/pi/components/feature-planning-board";
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
      <main className="space-y-2 p-8">
        <h1 className="text-2xl font-semibold">PI Planning</h1>
        <p className="text-sm text-muted-foreground">
          Keine ARTs verfügbar. Lege im Capacity-Planning-Modul eine ART an.
        </p>
      </main>
    );
  }

  const activeArt = arts.find((a) => a.id === art) ?? arts[0]!;

  const canEdit =
    principal.roles.includes("portfolio_manager") ||
    principal.roles.includes("rte") ||
    principal.roles.includes("feature_owner") ||
    principal.roles.includes("tenant_admin") ||
    principal.roles.includes("platform_admin");

  const [pisRaw, featurePage, artBudget, tenant] = await Promise.all([
    listArtPlanningPis(db, principal.tenantId, activeArt.id as ArtId),
    listFeatures(db, principal.tenantId, activeArt.id as ArtId),
    db.artBudget.findFirst({
      where: { tenantId: principal.tenantId, artId: activeArt.id },
      select: { byPeriod: true },
    }),
    db.tenant.findUnique({
      where: { id: principal.tenantId },
      select: { costPerJobSizePoint: true },
    }),
  ]);

  // Pull the half-year cells from the ArtBudget JSON for the capacity overlay.
  const artBudgetByPeriod: Record<string, number> | null = (() => {
    const raw = artBudget?.byPeriod;
    if (!raw || typeof raw !== "object") return null;
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
    }
    return Object.keys(out).length > 0 ? out : null;
  })();

  const costPerJobSizePoint =
    tenant?.costPerJobSizePoint != null ? Number(tenant.costPerJobSizePoint) : null;

  // Load direct blockers for the ART's Features in one query; feeds the
  // earliest-PI chip on each card and the warning when a drop violates it.
  const featureIds = featurePage.items.map((f) => f.id);
  const blockerWindowsByFeature = await getBlockerWindowsForFeatures(
    db,
    principal.tenantId,
    featureIds,
  );

  // Pull the budget allocations of the Features' parent Epics in one query;
  // drives the Backlog grouping by "earliest funded half-year" → Epic.
  const epicIds = Array.from(
    new Set(
      featurePage.items
        .map((f) => f.parent?.id)
        .filter((id): id is string => typeof id === "string"),
    ),
  );
  const epicAllocs =
    epicIds.length === 0
      ? []
      : await db.budgetAllocation.findMany({
          where: { tenantId: principal.tenantId, epicId: { in: epicIds } },
          select: { epicId: true, allocations: true },
        });
  const epicCycleByEpicId: Record<string, string | null> = Object.fromEntries(
    epicAllocs.map((a) => {
      const raw = a.allocations;
      const map: Record<string, number> = {};
      if (raw && typeof raw === "object") {
        for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
          if (typeof v === "number" && Number.isFinite(v)) map[k] = v;
        }
      }
      return [a.epicId, earliestFundedCycle(map)];
    }),
  );

  const { pis, features, capacity, blockers } = buildPlanningModel({
    pis: pisRaw,
    features: featurePage.items,
    artBudgetByPeriod,
    costPerJobSizePoint,
    blockerWindowsByFeature,
    epicCycleByEpicId,
  });

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
          capacity={capacity}
          blockers={blockers}
          currentCycleKey={halfYearKey(new Date())}
        />
      ) : (
        <FeaturePlanningBoard
          artId={activeArt.id}
          canEdit={canEdit}
          features={features}
          pis={pis}
          capacity={capacity}
          blockers={blockers}
          currentCycleKey={halfYearKey(new Date())}
        />
      )}
    </main>
  );
}
