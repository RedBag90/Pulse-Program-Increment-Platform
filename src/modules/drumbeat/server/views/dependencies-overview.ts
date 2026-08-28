/**
 * Dependencies-Overview page-model — cross-PI / cross-ART.
 *
 * Strukturidentisch zu `buildDependenciesListModel` (per-PI), aber ohne
 * den `piIdInScope`. Stattdessen tragen die Endpoints den Namen ihres
 * jeweiligen PIs; `isCriticalPath` ist neu definiert als „Blocker mit
 * Ziel-Feature in einer aktiven PI" (statt „in der einen PI dieser
 * Seite"). Filter-Facetten: type-Funnel + From-ART + To-ART + From-PI
 * + To-PI + Scope (cross-ART / cross-PI / in-PI).
 */

import type { PrismaClient } from "@/generated/prisma";
import type { TenantId } from "@/modules/core/kernel/domain/types";
import { InitiativeLevel } from "@/modules/core/kernel/domain/types";
import { diffInDays } from "@/modules/core/kernel/domain/calendar";
import { buildFunnelCounts } from "@/server/views/lib/page-model-utils";

export const DEPENDENCY_TYPES = ["blocks", "depends_on", "relates_to"] as const;
export type DependencyType = (typeof DEPENDENCY_TYPES)[number];

export interface DependencyEndpoint {
  id: string;
  title: string;
  status: string;
  art: { id: string; name: string } | null;
  pi: { id: string; name: string; status: string } | null;
}

export interface DependencyOverviewRow {
  id: string;
  type: DependencyType;
  from: DependencyEndpoint;
  to: DependencyEndpoint;
  daysOpen: number;
  isCrossArt: boolean;
  isCrossPi: boolean;
  /** type=blocks AND to.pi.status="active" — der bridge nach prod-Risk. */
  isCriticalPath: boolean;
  createdAtMs: number;
}

export interface ArtOption {
  id: string;
  name: string;
}

export interface PiOption {
  id: string;
  name: string;
}

export interface DependenciesOverviewModel {
  rows: DependencyOverviewRow[];
  funnelCounts: Record<DependencyType, number>;
  artOptions: ArtOption[];
  piOptions: PiOption[];
  toStatusOptions: string[];
}

// ---- Input row types ----

interface FeatureInput {
  id: string;
  title: string;
  status: string;
  artId: string | null;
  piId: string | null;
}

interface ArtInput {
  id: string;
  name: string;
}

interface PiInput {
  id: string;
  name: string;
  status: string;
}

interface DependencyInput {
  id: string;
  type: string;
  fromId: string;
  toId: string;
  createdAt: Date;
}

const UNKNOWN_ENDPOINT: DependencyEndpoint = {
  id: "",
  title: "Unbekanntes Feature",
  status: "unknown",
  art: null,
  pi: null,
};

function endpoint(
  feature: FeatureInput | undefined,
  artById: Map<string, ArtInput>,
  piById: Map<string, PiInput>,
): DependencyEndpoint {
  if (!feature) return UNKNOWN_ENDPOINT;
  const art = feature.artId ? artById.get(feature.artId) : undefined;
  const pi = feature.piId ? piById.get(feature.piId) : undefined;
  return {
    id: feature.id,
    title: feature.title,
    status: feature.status,
    art: art ? { id: art.id, name: art.name } : null,
    pi: pi ? { id: pi.id, name: pi.name, status: pi.status } : null,
  };
}

export function buildDependenciesOverviewModel(input: {
  dependencies: readonly DependencyInput[];
  features: readonly FeatureInput[];
  arts: readonly ArtInput[];
  pis: readonly PiInput[];
  now?: Date;
}): DependenciesOverviewModel {
  const { dependencies, features, arts, pis } = input;
  const nowMs = (input.now ?? new Date()).getTime();

  const featureById = new Map(features.map((f) => [f.id, f] as const));
  const artById = new Map(arts.map((a) => [a.id, a] as const));
  const piById = new Map(pis.map((p) => [p.id, p] as const));

  const rows: DependencyOverviewRow[] = dependencies.map((d) => {
    const from = endpoint(featureById.get(d.fromId), artById, piById);
    const to = endpoint(featureById.get(d.toId), artById, piById);
    const type = (DEPENDENCY_TYPES as readonly string[]).includes(d.type)
      ? (d.type as DependencyType)
      : "relates_to";
    const isCrossArt = from.art != null && to.art != null && from.art.id !== to.art.id;
    const isCrossPi = from.pi != null && to.pi != null && from.pi.id !== to.pi.id;
    const isCriticalPath = type === "blocks" && to.pi?.status === "active";
    return {
      id: d.id,
      type,
      from,
      to,
      daysOpen: diffInDays(nowMs, d.createdAt.getTime()),
      isCrossArt,
      isCrossPi,
      isCriticalPath,
      createdAtMs: d.createdAt.getTime(),
    };
  });

  const funnelCounts = buildFunnelCounts(rows, DEPENDENCY_TYPES, (r) => r.type);

  const usedArtIds = new Set<string>();
  for (const r of rows) {
    if (r.from.art) usedArtIds.add(r.from.art.id);
    if (r.to.art) usedArtIds.add(r.to.art.id);
  }
  const artOptions = arts
    .filter((a) => usedArtIds.has(a.id))
    .map((a) => ({ id: a.id, name: a.name }))
    .sort((a, b) => a.name.localeCompare(b.name, "de"));

  const usedPiIds = new Set<string>();
  for (const r of rows) {
    if (r.from.pi) usedPiIds.add(r.from.pi.id);
    if (r.to.pi) usedPiIds.add(r.to.pi.id);
  }
  const piOptions = pis
    .filter((p) => usedPiIds.has(p.id))
    .map((p) => ({ id: p.id, name: p.name }))
    .sort((a, b) => a.name.localeCompare(b.name, "de"));

  const toStatusOptions = [...new Set(rows.map((r) => r.to.status))].sort();

  return {
    rows,
    funnelCounts,
    artOptions,
    piOptions,
    toStatusOptions,
  };
}

// ---------------------------------------------------------------------------
// Loader — Service = einzige Datenquelle (ADR-0013): der Fan-out über die
// drumbeat-eigenen Tabellen (`dependency`/`programIncrement`) lebt hier, nicht
// als roher Prisma-Zugriff in der Page.
// ---------------------------------------------------------------------------

function emptyOverviewModel(): DependenciesOverviewModel {
  return {
    rows: [],
    funnelCounts: { blocks: 0, depends_on: 0, relates_to: 0 },
    artOptions: [],
    piOptions: [],
    toStatusOptions: [],
  };
}

export interface DependenciesOverviewLoad {
  /** Die ARTs im Scope; leer ⇒ die Page zeigt „kein ART-Zugriff". */
  artIds: string[];
  model: DependenciesOverviewModel;
}

/**
 * Lädt die Cross-PI/ART-Abhängigkeits-Übersicht für den ART-Scope des Principals
 * und baut das Page-Model. `scopedArtIds` leer ⇒ alle ARTs des Tenants.
 */
export async function loadDependenciesOverview(
  db: PrismaClient,
  tenantId: TenantId,
  scopedArtIds: readonly string[],
): Promise<DependenciesOverviewLoad> {
  const artWhere =
    scopedArtIds.length > 0
      ? { id: { in: [...scopedArtIds] }, tenantId, deletedAt: null }
      : { tenantId, deletedAt: null };
  const arts = await db.art.findMany({ where: artWhere, select: { id: true, name: true } });
  const artIds = arts.map((a) => a.id);
  if (artIds.length === 0) return { artIds, model: emptyOverviewModel() };

  const features = await db.initiative.findMany({
    where: { tenantId, level: InitiativeLevel.FEATURE, deletedAt: null, artId: { in: artIds } },
    select: { id: true, title: true, status: true, artId: true, piId: true },
  });
  const featureIds = features.map((f) => f.id);
  if (featureIds.length === 0) return { artIds, model: emptyOverviewModel() };

  const [dependencies, pis] = await Promise.all([
    db.dependency.findMany({
      where: { tenantId, OR: [{ fromId: { in: featureIds } }, { toId: { in: featureIds } }] },
      orderBy: { createdAt: "desc" },
    }),
    db.programIncrement.findMany({
      where: { tenantId, artId: { in: artIds } },
      orderBy: { startDate: "desc" },
      select: { id: true, name: true, status: true },
    }),
  ]);

  // Cross-Feature-Endpunkte können in Features außerhalb des Scopes liegen —
  // sie werden mit dem Namen ihres tatsächlichen ARTs/PIs nachgeladen.
  const externalFeatureIds = [
    ...new Set([...dependencies.map((d) => d.fromId), ...dependencies.map((d) => d.toId)]),
  ].filter((id) => !featureIds.includes(id));
  const externalFeatures =
    externalFeatureIds.length > 0
      ? await db.initiative.findMany({
          where: {
            tenantId,
            id: { in: externalFeatureIds },
            level: InitiativeLevel.FEATURE,
            deletedAt: null,
          },
          select: { id: true, title: true, status: true, artId: true, piId: true },
        })
      : [];

  const externalArtIds = [
    ...new Set(externalFeatures.map((f) => f.artId).filter((id): id is string => !!id)),
  ];
  const externalPiIds = [
    ...new Set(externalFeatures.map((f) => f.piId).filter((id): id is string => !!id)),
  ];
  const [externalArts, externalPis] = await Promise.all([
    externalArtIds.length > 0
      ? db.art.findMany({
          where: { id: { in: externalArtIds }, tenantId },
          select: { id: true, name: true },
        })
      : Promise.resolve([] as { id: string; name: string }[]),
    externalPiIds.length > 0
      ? db.programIncrement.findMany({
          where: { id: { in: externalPiIds }, tenantId },
          select: { id: true, name: true, status: true },
        })
      : Promise.resolve([] as { id: string; name: string; status: string }[]),
  ]);

  const seenPi = new Set<string>();
  const mergedPis = [...pis, ...externalPis].filter((p) => {
    if (seenPi.has(p.id)) return false;
    seenPi.add(p.id);
    return true;
  });
  const seenArt = new Set<string>();
  const mergedArts = [...arts, ...externalArts].filter((a) => {
    if (seenArt.has(a.id)) return false;
    seenArt.add(a.id);
    return true;
  });

  const model = buildDependenciesOverviewModel({
    dependencies,
    features: [...features, ...externalFeatures],
    arts: mergedArts,
    pis: mergedPis,
  });
  return { artIds, model };
}
