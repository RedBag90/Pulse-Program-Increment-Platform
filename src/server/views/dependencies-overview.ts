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

import { diffInDays } from "@/domain/calendar";
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
