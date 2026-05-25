# ADR-0001: Goal achievement is two distinct metrics (cockpit vs. snapshot)

- Status: accepted
- Date: 2026-05-24

## Context

"Goal achievement" appears in two places that look like they should agree but
compute over different goal sets:

- **Live cockpit** ([transformation-cockpit.tsx](../../src/features/transformation/components/transformation-cockpit.tsx))
  averages per-goal KPI progress over **all non-archived** goals that carry KPIs
  — achieved goals included (they sit near 1.0 and keep the average high).
- **Snapshot trend** (`computeSnapshotMetrics` in
  [transformation-snapshot.ts](../../src/server/services/transformation-snapshot.ts))
  averages over **active-only** goals that carry KPIs, and counts completed
  goals separately via `achievedGoalCount`.

Both already share the per-goal primitive `goalKpiProgress`
([transformation.ts](../../src/server/services/transformation.ts)); only the set
they average over differs. A stale comment claimed the snapshot "mirrors the
cockpit", which it does not — and an architecture review flagged the gap as a
drift bug and proposed unifying them behind one read-model.

## Decision

Keep them as **two distinct metrics with the same display label**. Do not unify.

- The cockpit answers "how are my goals doing right now" — achieved goals are
  part of that picture.
- The snapshot answers "how much in-flight progress was there on this day" and
  reports completion separately (`achievedGoalCount`), so an achieved goal
  _leaves_ the average rather than pinning it near 1.0. Including achieved goals
  would double-count the completion signal in the trend.

The only defect was the misleading comment; it has been corrected on both sides,
and each computation now points at the other and at this ADR.

## Consequences

- No `deriveCockpitMetrics` read-model is introduced. The shared logic that
  warrants a single home (`goalKpiProgress`) already has one.
- Future architecture reviews should not re-propose unifying these two — the
  divergence is intentional. If product later wants a single number, that is a
  product decision (which set is canonical), recorded as a new ADR superseding
  this one.
