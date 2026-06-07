/**
 * Feature backlog page-model — turns the loaded Prisma rows (features +
 * parent Epic + PI + dependency counts) into the rich row DTO the master
 * list renders. Mirrors `portfolio-epics-list` in shape; the differences
 * are domain (WSJF tiers instead of business-case economics, Epic chip
 * instead of value-stream chip, no approval phase).
 */

/** Funnel category — the four feature lifecycle stages. */
export const FEATURE_STATUSES = ["draft", "approved", "in_progress", "completed"] as const;
export type FeatureStatus = (typeof FEATURE_STATUSES)[number];

/** WSJF tier — derived from `wsjfComputed` (0..N). */
export type WsjfTier = "high" | "medium" | "low" | "none";

export interface FeatureListRow {
  id: string;
  title: string;
  /** Backlog status — drives the funnel filter + the QS status pill. */
  status: string;
  /** Parent Epic (null only if the relation is somehow broken). */
  epic: { id: string; title: string } | null;
  /** Owning ART — needed by per-row mutations (PI assign / WSJF / delete)
   *  whose auth resource is ART-scoped. Always set: every Feature belongs
   *  to exactly one ART. */
  artId: string;
  /** Assigned PI — null means Backlog. */
  pi: { id: string; name: string } | null;
  wsjfComputed: number | null;
  wsjfTier: WsjfTier;
  wsjfBusinessValue: number | null;
  wsjfTimeCriticality: number | null;
  wsjfRiskReduction: number | null;
  wsjfJobSize: number | null;
  acceptanceCriteriaCount: number;
  /** True if this feature is the target of any "blocks" dependency. */
  isBlocked: boolean;
  createdAtMs: number;
}

export interface EpicOption {
  id: string;
  title: string;
}

export interface PiOption {
  id: string;
  name: string;
  status: string;
}

export interface FeaturesListModel {
  rows: FeatureListRow[];
  funnelCounts: Record<FeatureStatus, number>;
  epicOptions: EpicOption[];
  /** PIs that exist for this ART — used by both the filter and the bulk PI picker. */
  piOptions: PiOption[];
  /** PIs eligible as bulk-assignment targets (status != "completed"). */
  assignablePis: PiOption[];
  /** Has the tenant enabled the WSJF practice? Drives column visibility. */
  showWsjf: boolean;
}

// ---- Input row types ----

interface FeatureRow {
  id: string;
  title: string;
  status: string;
  /** Owning ART id — surfaces on the resulting row, used by per-row mutations. */
  artId: string;
  piId: string | null;
  parent: { id: string; title: string } | null;
  pi: { id: string; name: string } | null;
  wsjfBusinessValue: number | null;
  wsjfTimeCriticality: number | null;
  wsjfRiskReduction: number | null;
  wsjfJobSize: number | null;
  /** Prisma returns Decimal; the page maps to number. */
  wsjfComputed: number | null;
  acceptanceCriteria: string[];
  createdAt: Date;
}

interface PiRow {
  id: string;
  name: string;
  status: string;
}

/**
 * WSJF tier thresholds (per the rework plan). Decoupled from the column
 * sort so the chip filter stays stable when the user resorts.
 */
function tierFor(wsjfComputed: number | null): WsjfTier {
  if (wsjfComputed == null) return "none";
  if (wsjfComputed >= 5) return "high";
  if (wsjfComputed >= 2) return "medium";
  return "low";
}

export function buildFeaturesListModel(input: {
  features: readonly FeatureRow[];
  /** All Epics in the tenant — used by the Epic filter facet. */
  epics: readonly { id: string; title: string }[];
  /** PIs that belong to this ART. */
  pis: readonly PiRow[];
  /** IDs of features that are the target of a `blocks` dependency. */
  blockedFeatureIds: ReadonlySet<string>;
  showWsjf: boolean;
}): FeaturesListModel {
  const { features, epics, pis, blockedFeatureIds, showWsjf } = input;

  const rows: FeatureListRow[] = features.map((f) => ({
    id: f.id,
    title: f.title,
    status: f.status,
    epic: f.parent,
    artId: f.artId,
    pi: f.pi,
    wsjfComputed: f.wsjfComputed,
    wsjfTier: tierFor(f.wsjfComputed),
    wsjfBusinessValue: f.wsjfBusinessValue,
    wsjfTimeCriticality: f.wsjfTimeCriticality,
    wsjfRiskReduction: f.wsjfRiskReduction,
    wsjfJobSize: f.wsjfJobSize,
    acceptanceCriteriaCount: f.acceptanceCriteria.length,
    isBlocked: blockedFeatureIds.has(f.id),
    createdAtMs: f.createdAt.getTime(),
  }));

  // Funnel counts — every status gets a slot (empty stays at 0) so the
  // header is stable across renders.
  const funnelCounts = Object.fromEntries(FEATURE_STATUSES.map((s) => [s, 0])) as Record<
    FeatureStatus,
    number
  >;
  for (const r of rows) {
    if (funnelCounts[r.status as FeatureStatus] != null) {
      funnelCounts[r.status as FeatureStatus] += 1;
    }
  }

  // Epic options: only Epics that actually parent a feature in this ART
  // surface as filter chips (keeps the dropdown short).
  const usedEpicIds = new Set(rows.map((r) => r.epic?.id).filter(Boolean));
  const epicOptions = epics
    .filter((e) => usedEpicIds.has(e.id))
    .sort((a, b) => a.title.localeCompare(b.title, "de"));

  const piOptions = pis.map((p) => ({ id: p.id, name: p.name, status: p.status }));
  const assignablePis = piOptions.filter((p) => p.status !== "completed");

  return {
    rows,
    funnelCounts,
    epicOptions,
    piOptions,
    assignablePis,
    showWsjf,
  };
}
