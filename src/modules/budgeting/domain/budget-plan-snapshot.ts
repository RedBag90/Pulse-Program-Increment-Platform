/**
 * Budget-Plan-Snapshot — the immutable shape of a participatory-budgeting
 * revision. Owns one job: fold the live budgeting model (Epics + ART budget
 * cells + cycle-window Features) into a fully denormalised payload that can be
 * stored as JSON and rendered back without touching the live tables.
 *
 * No I/O, no Prisma — pure. The persistence layer
 * (`src/server/services/budget-plan-revision.ts`) loads the inputs, calls
 * `buildBudgetPlanSnapshot`, and upserts the result onto `BudgetPlanRevision`.
 */

import {
  halfYearKey,
  halfYearLabel,
  parseHalfYearKey,
  addHalfYears,
  buildHalfYearAxis,
} from "@/modules/core/kernel/domain/calendar";
import { rollupByValueStream, type BudgetEpicView } from "@/modules/budgeting/domain/budgeting";
import { aggregateArtFeatureLoad } from "@/modules/budgeting/domain/art-budget";

/**
 * Canonical key for the synthetic Value-Stream bucket that catches Epics without
 * a VS. Unified with the deep-domain primitive (`rollupByValueStream`), which
 * buckets unassigned Epics under `"__none__"` — so the live board and the
 * captured snapshot use one id. The "Ohne Wertstrom" display name stays a
 * presentation concern (applied by the builder when projecting the rollup).
 */
export const UNASSIGNED_VALUE_STREAM_ID = "__none__";

export interface BudgetPlanSnapshotFeature {
  featureId: string;
  title: string;
  artId: string;
  artName: string;
  piId: string;
  piName: string;
  /** ISO date (yyyy-mm-dd) — start of the PI the Feature was assigned to. */
  piStartDate: string;
  piEndDate: string;
  status: string;
  wsjfJobSize: number | null;
}

export interface BudgetPlanSnapshotEpic {
  epicId: string;
  title: string;
  valueStreamId: string | null;
  valueStreamName: string | null;
  /** Snapshot rank — directly reflects the live `BudgetAllocation.priority`. */
  priority: number;
  /** Half-year allocations as they stood at snapshot time. */
  allocations: Record<string, number>;
  /** Σ across all half-years — total commitment for this Epic. */
  total: number;
  /** Allocation in the captured cycle (`cycleKey` lookup on `allocations`). */
  cycleBudget: number;
  /** Features that were assigned to a PI in the captured cycle's half-year. */
  cycleFeatures: BudgetPlanSnapshotFeature[];
}

export interface BudgetPlanSnapshotPeriod {
  /** Half-year key, e.g. "2026-H1". */
  key: string;
  /** Human label via `halfYearLabel`, e.g. "H1 2026". */
  label: string;
  /** Σ across all Epic allocations + ART budgets in this period. */
  total: number;
}

export interface BudgetPlanSnapshotValueStream {
  valueStreamId: string;
  name: string;
  /** Σ Epic allocations in this VS per half-year. */
  byPeriod: Record<string, number>;
  total: number;
}

export interface BudgetPlanSnapshotArt {
  artId: string;
  name: string;
  /** Frozen `ArtBudget.byPeriod` at snapshot time. */
  budgetByPeriod: Record<string, number>;
  /** Σ Job Size + count of Features whose PI start falls into the given period. */
  loadByPeriod: Record<string, { featureCount: number; jobSizeSum: number }>;
  /**
   * Features on this ART without a scheduled PI (the primitive's Backlog bucket).
   * Always present on NEW snapshots — zeroed when every Feature is scheduled.
   */
  loadBacklog: { featureCount: number; jobSizeSum: number };
}

export interface BudgetPlanSnapshot {
  cycleKey: string;
  cycleLabel: string;
  /** ISO timestamp the snapshot was taken. */
  capturedAt: string;
  /** All half-year keys with any data (Epic allocation > 0 OR ART budget > 0). */
  periods: BudgetPlanSnapshotPeriod[];
  /** Tenant pool per half-year — frozen from `Tenant.budgetPoolByPeriod`. */
  budgetPoolByPeriod: Record<string, number>;
  /** Epics in snapshot order — lowest `priority` first. Stable for ties. */
  epics: BudgetPlanSnapshotEpic[];
  /** Real Value Streams + one synthetic "Ohne Wertstrom" bucket when needed. */
  valueStreams: BudgetPlanSnapshotValueStream[];
  arts: BudgetPlanSnapshotArt[];
  /** Σ epic.cycleBudget — the commitment landing in the captured cycle. */
  cycleBudgetSum: number;
  /** Σ (epic.total − epic.cycleBudget) — follow-on budget in later half-years. */
  followBudgetSum: number;
}

// ---------------------------------------------------------------------------
// Inputs to the folder — structural shapes consumed by the persistence layer.
// ---------------------------------------------------------------------------

export interface ArtSnapshotInput {
  artId: string;
  name: string;
  budgetByPeriod: Record<string, number>;
}

export interface FeatureSnapshotInput {
  featureId: string;
  parentEpicId: string;
  title: string;
  status: string;
  artId: string;
  artName: string;
  wsjfJobSize: number | null;
  piId: string;
  piName: string;
  /** Start/end of the assigned PI (UTC midnight Dates). */
  piStartDate: Date;
  piEndDate: Date;
}

export interface BuildBudgetPlanSnapshotInputs {
  cycleKey: string;
  capturedAt: Date;
  pool: Record<string, number>;
  /** From `loadBudgetingModel` — Epics with allocations, priority, etc. */
  epics: ReadonlyArray<BudgetEpicView>;
  artRows: ReadonlyArray<ArtSnapshotInput>;
  /** All scheduled Features that may contribute to a cycle bucket or ART load. */
  features: ReadonlyArray<FeatureSnapshotInput>;
}

// ---------------------------------------------------------------------------
// Folder
// ---------------------------------------------------------------------------

/** Sums non-zero halv-year cells; mutates a target Record in place. */
function addCell(target: Record<string, number>, key: string, amount: number): void {
  if (amount === 0) return;
  target[key] = (target[key] ?? 0) + amount;
}

/** Stable order — preserves input ordering for equal priorities. */
function byPriority(a: BudgetEpicView, b: BudgetEpicView): number {
  return a.priority - b.priority;
}

export function buildBudgetPlanSnapshot(inputs: BuildBudgetPlanSnapshotInputs): BudgetPlanSnapshot {
  const { cycleKey, capturedAt, pool, epics, artRows, features } = inputs;

  // Index Features by their parent Epic — used twice (Epic.cycleFeatures + ART load).
  const featuresByEpic = new Map<string, FeatureSnapshotInput[]>();
  for (const f of features) {
    const list = featuresByEpic.get(f.parentEpicId) ?? [];
    list.push(f);
    featuresByEpic.set(f.parentEpicId, list);
  }

  // --- Epics --------------------------------------------------------------
  const sortedEpics = [...epics].sort(byPriority);
  const snapshotEpics: BudgetPlanSnapshotEpic[] = sortedEpics.map((e) => {
    const total = Object.values(e.allocations).reduce((s, v) => s + v, 0);
    const cycleBudget = e.allocations[cycleKey] ?? 0;

    const epicFeatures = (featuresByEpic.get(e.id) ?? []).filter(
      (f) => halfYearKey(f.piStartDate) === cycleKey,
    );
    const cycleFeatures: BudgetPlanSnapshotFeature[] = epicFeatures.map((f) => ({
      featureId: f.featureId,
      title: f.title,
      artId: f.artId,
      artName: f.artName,
      piId: f.piId,
      piName: f.piName,
      piStartDate: f.piStartDate.toISOString().slice(0, 10),
      piEndDate: f.piEndDate.toISOString().slice(0, 10),
      status: f.status,
      wsjfJobSize: f.wsjfJobSize,
    }));

    return {
      epicId: e.id,
      title: e.title,
      valueStreamId: e.valueStreamId,
      valueStreamName: e.valueStream,
      priority: e.priority,
      allocations: { ...e.allocations },
      total,
      cycleBudget,
      cycleFeatures,
    };
  });

  // --- Period roll-up -----------------------------------------------------
  // The period grid covers every key that has data on any axis (Epic, ART,
  // or pool) — keeps the snapshot self-contained without zero-padding.
  const periodTotals: Record<string, number> = {};
  for (const e of snapshotEpics) {
    for (const [k, v] of Object.entries(e.allocations)) addCell(periodTotals, k, v);
  }
  for (const a of artRows) {
    for (const [k, v] of Object.entries(a.budgetByPeriod)) addCell(periodTotals, k, v);
  }
  for (const [k, v] of Object.entries(pool)) addCell(periodTotals, k, v);

  const periods: BudgetPlanSnapshotPeriod[] = Object.keys(periodTotals)
    .sort()
    .map((k) => ({ key: k, label: halfYearLabel(k), total: periodTotals[k]! }));

  // --- Value Stream roll-up ----------------------------------------------
  // Reuse the canonical deep-domain primitive so the captured roll-up matches
  // what the live board shows, then PROJECT into the snapshot's presentation
  // shape (unassigned Epics under `UNASSIGNED_VALUE_STREAM_ID` with the "Ohne
  // Wertstrom" label, largest-total-first). The axis spans every half-year that
  // carries data, so the primitive's axis-filter drops nothing the grid shows.
  const dataDates = Object.keys(periodTotals)
    .map((k) => parseHalfYearKey(k))
    .filter((d): d is Date => d != null);
  const from = dataDates.length ? dataDates.reduce((m, d) => (d < m ? d : m)) : capturedAt;
  const to = dataDates.length ? dataDates.reduce((m, d) => (d > m ? d : m)) : capturedAt;
  const axis = buildHalfYearAxis(from, to);

  const valueStreams: BudgetPlanSnapshotValueStream[] = rollupByValueStream([...epics], axis)
    .map((r) => ({
      valueStreamId: r.valueStreamId ?? UNASSIGNED_VALUE_STREAM_ID,
      name: r.valueStream ?? "Ohne Wertstrom",
      byPeriod: r.byPeriod,
      total: r.total,
    }))
    .sort((a, b) => b.total - a.total); // largest first

  // --- ART roll-up --------------------------------------------------------
  // Reuse `aggregateArtFeatureLoad` (guarantees one entry per ART + a Backlog
  // bucket for unscheduled Features), then project its {count, jobSize} cells
  // into the snapshot's {featureCount, jobSizeSum} presentation shape.
  const artLoads = new Map(
    aggregateArtFeatureLoad(
      artRows.map((a) => a.artId),
      features.map((f) => ({
        artId: f.artId,
        piStart: f.piStartDate,
        jobSize: f.wsjfJobSize ?? 0,
      })),
    ).map((l) => [l.artId, l] as const),
  );

  const arts: BudgetPlanSnapshotArt[] = artRows
    .map((a) => {
      const load = artLoads.get(a.artId);
      const loadByPeriod: Record<string, { featureCount: number; jobSizeSum: number }> = {};
      for (const [key, cell] of Object.entries(load?.byPeriod ?? {})) {
        loadByPeriod[key] = { featureCount: cell.count, jobSizeSum: cell.jobSize };
      }
      const backlog = load?.backlog ?? { count: 0, jobSize: 0 };
      return {
        artId: a.artId,
        name: a.name,
        budgetByPeriod: { ...a.budgetByPeriod },
        loadByPeriod,
        loadBacklog: { featureCount: backlog.count, jobSizeSum: backlog.jobSize },
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "de"));

  const { cycleBudgetSum, followBudgetSum } = sumEpicTotals(snapshotEpics);

  return {
    cycleKey,
    cycleLabel: halfYearLabel(cycleKey),
    capturedAt: capturedAt.toISOString(),
    periods,
    budgetPoolByPeriod: { ...pool },
    epics: snapshotEpics,
    valueStreams,
    arts,
    cycleBudgetSum,
    followBudgetSum,
  };
}

// ---------------------------------------------------------------------------
// Derived read-models (pure) — one home for the numbers every reader needs.
// ---------------------------------------------------------------------------

function sumEpicTotals(
  epics: ReadonlyArray<{ cycleBudget: number; total: number }>,
): { cycleBudgetSum: number; followBudgetSum: number } {
  let cycleBudgetSum = 0;
  let followBudgetSum = 0;
  for (const e of epics) {
    cycleBudgetSum += e.cycleBudget;
    followBudgetSum += e.total - e.cycleBudget;
  }
  return { cycleBudgetSum, followBudgetSum };
}

/**
 * Cycle- and follow-budget sums for a snapshot. Prefers the values the builder
 * froze onto the snapshot; falls back to reducing the Epic list for OLD
 * (pre-totals) captured snapshots that never stored them. The single source of
 * truth so the header list, detail read and view all report identical numbers.
 */
export function summarizeSnapshot(
  snapshot: BudgetPlanSnapshot,
): { cycleBudgetSum: number; followBudgetSum: number } {
  if (
    typeof snapshot.cycleBudgetSum === "number" &&
    typeof snapshot.followBudgetSum === "number"
  ) {
    return {
      cycleBudgetSum: snapshot.cycleBudgetSum,
      followBudgetSum: snapshot.followBudgetSum,
    };
  }
  return sumEpicTotals(snapshot.epics);
}

/** A visible half-year column for the revision view (current cycle flagged). */
export interface SnapshotDisplayPeriod {
  key: string;
  label: string;
  isCurrent: boolean;
}

/**
 * The visible columns for a revision: the half-year *immediately before* the
 * captured cycle (anchor), the captured cycle itself, and every later half-year
 * that carries data. Earlier history is hidden so the table stays anchored on
 * "next steps". Pure — lifted out of the view so it is unit-testable.
 */
export function computeDisplayPeriods(
  snapshot: Pick<BudgetPlanSnapshot, "cycleKey" | "periods">,
): SnapshotDisplayPeriod[] {
  const cycleStart = parseHalfYearKey(snapshot.cycleKey);
  const previousKey = cycleStart ? halfYearKey(addHalfYears(cycleStart, -1)) : null;

  const keys = new Set<string>();
  if (previousKey) keys.add(previousKey);
  keys.add(snapshot.cycleKey);
  for (const p of snapshot.periods) {
    if (p.key >= snapshot.cycleKey) keys.add(p.key);
  }
  return [...keys].sort().map((key) => ({
    key,
    label: halfYearLabel(key),
    isCurrent: key === snapshot.cycleKey,
  }));
}
