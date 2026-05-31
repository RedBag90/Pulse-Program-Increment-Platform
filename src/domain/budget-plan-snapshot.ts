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

import { halfYearKey, halfYearLabel } from "@/domain/calendar";
import type { BudgetEpicView } from "@/domain/budgeting";

/** Marker for the synthetic Value-Stream bucket that catches Epics without a VS. */
export const UNASSIGNED_VALUE_STREAM_ID = "__unassigned__";

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
  // Real VS get rolled up under their id; Epics without a VS are bucketed
  // under a synthetic "Ohne Wertstrom" entry so they remain visible.
  const vsBuckets = new Map<
    string,
    { name: string; byPeriod: Record<string, number>; total: number }
  >();
  for (const e of snapshotEpics) {
    const vsId = e.valueStreamId ?? UNASSIGNED_VALUE_STREAM_ID;
    const vsName = e.valueStreamName ?? "Ohne Wertstrom";
    const bucket = vsBuckets.get(vsId) ?? { name: vsName, byPeriod: {}, total: 0 };
    for (const [k, v] of Object.entries(e.allocations)) {
      addCell(bucket.byPeriod, k, v);
      bucket.total += v;
    }
    vsBuckets.set(vsId, bucket);
  }
  const valueStreams: BudgetPlanSnapshotValueStream[] = [...vsBuckets.entries()]
    .map(([valueStreamId, v]) => ({
      valueStreamId,
      name: v.name,
      byPeriod: v.byPeriod,
      total: v.total,
    }))
    .sort((a, b) => b.total - a.total); // largest first

  // --- ART roll-up --------------------------------------------------------
  const arts: BudgetPlanSnapshotArt[] = artRows
    .map((a) => {
      const loadByPeriod: Record<string, { featureCount: number; jobSizeSum: number }> = {};
      for (const f of features) {
        if (f.artId !== a.artId) continue;
        const key = halfYearKey(f.piStartDate);
        const cell = loadByPeriod[key] ?? { featureCount: 0, jobSizeSum: 0 };
        cell.featureCount += 1;
        cell.jobSizeSum += f.wsjfJobSize ?? 0;
        loadByPeriod[key] = cell;
      }
      return {
        artId: a.artId,
        name: a.name,
        budgetByPeriod: { ...a.budgetByPeriod },
        loadByPeriod,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "de"));

  return {
    cycleKey,
    cycleLabel: halfYearLabel(cycleKey),
    capturedAt: capturedAt.toISOString(),
    periods,
    budgetPoolByPeriod: { ...pool },
    epics: snapshotEpics,
    valueStreams,
    arts,
  };
}
