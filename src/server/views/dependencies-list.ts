/**
 * Dependencies list page-model — shapes the loaded Prisma rows (deps + each
 * end's parent Feature with ART + PI) into the rich row DTO the master list
 * renders. The funnel category is the dependency type (blocks / depends_on /
 * relates_to); governance flags (cross-ART, critical path) are derived
 * here so the row stays a pure render seam.
 */

import { diffInDays } from "@/domain/calendar";

export const DEPENDENCY_TYPES = ["blocks", "depends_on", "relates_to"] as const;
export type DependencyType = (typeof DEPENDENCY_TYPES)[number];

export interface DependencyEndpoint {
  id: string;
  title: string;
  status: string;
  artId: string | null;
  artName: string | null;
  piId: string | null;
  piName: string | null;
  /** True when this endpoint is a Feature assigned to the active PI for this page. */
  inPi: boolean;
}

export interface DependencyListRow {
  id: string;
  type: DependencyType;
  from: DependencyEndpoint;
  to: DependencyEndpoint;
  /** Days since the dependency was created. */
  daysOpen: number;
  /** True when from.artId !== to.artId (both non-null). */
  isCrossArt: boolean;
  /** True when type=blocks AND the `to` endpoint is in the active PI. */
  isCriticalPath: boolean;
  createdAtMs: number;
}

export interface FeatureOption {
  id: string;
  title: string;
}

export interface DependenciesListModel {
  rows: DependencyListRow[];
  funnelCounts: Record<DependencyType, number>;
  /** Features eligible as the "from" facet — the union of from + to feature ids. */
  featureOptions: FeatureOption[];
  /** Distinct statuses present on the "to" endpoints — to-feature status filter. */
  toStatusOptions: string[];
  /** Number of orphan features in the PI (no deps either direction). */
  orphanCount: number;
}

// ---- Input row types ----

interface FeatureRowInput {
  id: string;
  title: string;
  status: string;
  /** Endpoint's ART id (Initiative.artId). */
  artId: string | null;
  /** Endpoint's parent Initiative id — usually the Epic. */
  parentId: string | null;
  /** PI assignment — only Features carry one. */
  piId: string | null;
}

interface ArtRowInput {
  id: string;
  name: string;
}

interface PiRowInput {
  id: string;
  name: string;
}

interface DependencyRowInput {
  id: string;
  type: string;
  fromId: string;
  toId: string;
  createdAt: Date;
}

function endpoint(
  feature: FeatureRowInput | undefined,
  artLookup: Map<string, string>,
  piLookup: Map<string, string>,
  piIdInScope: string,
): DependencyEndpoint {
  if (!feature) {
    return {
      id: "",
      title: "Unbekanntes Feature",
      status: "unknown",
      artId: null,
      artName: null,
      piId: null,
      piName: null,
      inPi: false,
    };
  }
  return {
    id: feature.id,
    title: feature.title,
    status: feature.status,
    artId: feature.artId,
    artName: feature.artId ? (artLookup.get(feature.artId) ?? null) : null,
    piId: feature.piId,
    piName: feature.piId ? (piLookup.get(feature.piId) ?? null) : null,
    inPi: feature.piId === piIdInScope,
  };
}

export function buildDependenciesListModel(input: {
  dependencies: readonly DependencyRowInput[];
  features: readonly FeatureRowInput[];
  arts: readonly ArtRowInput[];
  pis: readonly PiRowInput[];
  /** PI id whose dependencies this page surfaces — drives the `inPi` flag. */
  piIdInScope: string;
  /** Orphan Features (Features in the PI that have no incident dependency). */
  orphanCount: number;
  now?: Date;
}): DependenciesListModel {
  const { dependencies, features, arts, pis, piIdInScope, orphanCount } = input;
  const nowMs = (input.now ?? new Date()).getTime();

  const featureById = new Map(features.map((f) => [f.id, f]));
  const artLookup = new Map(arts.map((a) => [a.id, a.name]));
  const piLookup = new Map(pis.map((p) => [p.id, p.name]));

  const rows: DependencyListRow[] = dependencies.map((d) => {
    const from = endpoint(featureById.get(d.fromId), artLookup, piLookup, piIdInScope);
    const to = endpoint(featureById.get(d.toId), artLookup, piLookup, piIdInScope);
    const type = (DEPENDENCY_TYPES as readonly string[]).includes(d.type)
      ? (d.type as DependencyType)
      : "relates_to";
    return {
      id: d.id,
      type,
      from,
      to,
      daysOpen: diffInDays(nowMs, d.createdAt.getTime()),
      isCrossArt: from.artId != null && to.artId != null && from.artId !== to.artId,
      isCriticalPath: type === "blocks" && to.inPi,
      createdAtMs: d.createdAt.getTime(),
    };
  });

  const funnelCounts = Object.fromEntries(DEPENDENCY_TYPES.map((t) => [t, 0])) as Record<
    DependencyType,
    number
  >;
  for (const r of rows) funnelCounts[r.type] += 1;

  // Feature facet options — union of all from + to ids that appear, sorted by title.
  const featureIdsInUse = new Set<string>();
  for (const r of rows) {
    if (r.from.id) featureIdsInUse.add(r.from.id);
    if (r.to.id) featureIdsInUse.add(r.to.id);
  }
  const featureOptions: FeatureOption[] = [...featureIdsInUse]
    .map((id) => {
      const f = featureById.get(id);
      return { id, title: f?.title ?? id };
    })
    .sort((a, b) => a.title.localeCompare(b.title, "de"));

  const toStatusOptions = [...new Set(rows.map((r) => r.to.status))].sort();

  return {
    rows,
    funnelCounts,
    featureOptions,
    toStatusOptions,
    orphanCount,
  };
}
