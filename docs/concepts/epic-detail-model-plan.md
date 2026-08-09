# Plan: Epic Detail model — deepen the Epic page into a cross-module composition read-model

## Motivation

`src/app/[locale]/(dashboard)/portfolio/epics/[id]/page.tsx` is 683 lines, ~340 of
real logic before the JSX. It is a cross-module read-model wearing a route's
clothing: it stitches Work (hero/economics/approvals), Drumbeat (PI columns +
dependency graph), Budgeting (funded-window) and Core (goals/KPI/history) together
inline, reaches **raw Prisma around two module seams** (`db.budgetAllocation`,
`db.dependency`), and holds the highest-value-but-untestable business rules on the
page — the `HYPO_LOCK`/`BC_LOCK` reason maps and the `showHypoReviewDiff` /
`showBcOwnerEdit` revision-diff visibility algebra.

This violates ADR-0013 (route shells are the composition root — thin; they compose
module read-models). The reference for the target shape already exists in the repo:
`loadPortfolioOverview(db, tenantId, impedimentPort, budgetingPort)` in
`src/modules/work/server/views/portfolio-overview.ts`, split into an impure
`loadPortfolioOverviewInputs` (Prisma + injected ports) and a pure
`buildPortfolioOverviewModel` tested against in-memory fixtures.

**Goal:** extract a deep **Epic Detail model** so the route becomes `load → render`,
the composition logic gets a single home + test surface, and Drumbeat/Budgeting
degrade cleanly when the tenant is not entitled.

## Vocabulary (architecture)

- **Module / Interface / Implementation / Depth / Seam / Adapter / Leverage /
  Locality** — as defined in the architecture-review glossary.
- **Composition read-model** — the new named animal this plan introduces: a
  cross-module page composite (distinct from the four single-module pure
  read-models like Epic Schedule/Economics). Lives in the owning module's
  `server/views/`, takes the other modules' data via injected **ports**, and is
  composed only at the `src/app` composition root.

## Design decisions (the four forks)

1. **The model owns the policy pile, not just the data.** It takes `principal`; the
   impure loader resolves the raw capability booleans via `authorize()`, then the
   **pure builder** combines `{epic artefacts, approvals, capability booleans,
entitlement}` into the full view — including the lock-reason maps and the
   revision-diff visibility algebra. Those pure rules are the primary test payoff.

2. **Degradation is explicit, not implicit.** The builder receives
   `enabled: { drumbeat, budgeting }` and emits **discriminated slices**, so the UI
   distinguishes "module off" from "entitled but no data yet". This is also what
   gives each Drumbeat/Budgeting port its genuine **second adapter** (real route
   adapter + disabled adapter), converting today's single-adapter indirection into
   a real two-adapter seam.

3. **Seam placement mirrors `loadPortfolioOverview`.** Impure
   `loadEpicDetail(db, principal, id, ports, enabled)` → pure
   `buildEpicDetailModel(inputs)` as the external seam / test surface. The two raw
   cross-module Prisma reads become the Drumbeat/Budgeting adapters. Dependency
   category: impure loader (Prisma + `authorize`), pure builder tested with
   in-memory fixtures — no PGLite, matching the rest of the repo.

4. **What deliberately stays in the shell:** tab resolution (`resolveTab` /
   `EPIC_TABS`), all JSX, the lazy `slideOverDetail` (loaded only when `?featureId=`
   is present — URL-param-driven and orthogonal), and the `authorize` calls
   themselves (loader-side; the builder receives plain booleans).

## Interface sketch

Three ports, each with a real adapter (route, entitled) and a disabled adapter:

```ts
// src/modules/work/server/views/epic-detail.ts
export type EpicPisPort = (artIds: ArtId[]) => Promise<EpicPi[]>; // Drumbeat
export type EpicDependenciesPort = (featureIds: string[]) => Promise<BreakdownEdge[]>; // Drumbeat
export type EpicBudgetPort = () => Promise<{ allocatedSum: number } | null>; // Budgeting

export interface EpicDetailEnabled {
  drumbeat: boolean;
  budgeting: boolean;
}

// discriminated slices — "off" is not the same value as "empty"
export type DrumbeatSlice =
  | { disabled: true }
  | {
      disabled: false;
      pisByArt: Record<string, PiRef[]>;
      breakdownPis: PiRef[];
      dependencies: BreakdownEdge[];
    };
export type BudgetingSlice = { disabled: true } | { disabled: false; allocated: boolean };

export interface EpicDetailModel {
  // Work/Core (always present): epic facts, breakdownFeatures, kpiRows, heroTotals,
  // heroKpiAvgPct, activityEvents, breakdownSignoff, kpisSignoff, lock reasons,
  // showHypoReviewDiff/showBcReviewDiff/showHypoOwnerEdit/showBcOwnerEdit, caps…
  drumbeat: DrumbeatSlice;
  budgeting: BudgetingSlice;
}

export function buildEpicDetailModel(inputs: EpicDetailInputs): EpicDetailModel; // pure — test surface
export async function loadEpicDetailInputs(
  db,
  principal,
  id,
  ports,
  enabled,
): Promise<EpicDetailInputs>;
export async function loadEpicDetail(db, principal, id, ports, enabled): Promise<EpicDetailModel>;
```

## Staged execution — each stage independently green + revertible

### Stage 0 — Housekeeping

Remove the 27 untracked `* 2.*` duplicate files (merge artifacts from the module
migration; none imported). They would collide with the new service files and
fracture navigation. **Gate:** tsc/eslint/vitest unchanged.

### Stage 1 — Module-owned reader services (page unchanged)

- **Budgeting** owns the `budgetAllocation` table → new
  `src/modules/budgeting/server/services/epic-allocation.ts`:
  `getEpicBudgetAllocation(db, tenantId, epicId): Promise<{ allocatedSum: number } | null>`.
- **Drumbeat** owns dependencies → add `listBreakdownDependencies(db, tenantId,
featureIds)` to `dependency.ts`: edges with ≥1 endpoint in `featureIds`, selecting
  `from/to` + `parent` for the ghost-node click-through.
- **Gate:** green; both readers return shapes identical to the page's current inline
  queries (verify against page lines 142-189).

### Stage 2 — The read-model, fully tested, NOT wired in (parallel construction)

- Create `epic-detail.ts` with the ports, inputs, model, `buildEpicDetailModel`,
  `loadEpicDetailInputs`, `loadEpicDetail`.
- Move every pure derivation from the page (lines 99-420) into the builder:
  breakdownFeatures map + artIds, pisByArt + breakdownPis, activity-feed merge+sort,
  section sign-off state, kpiRows, hero economics, `HYPO_LOCK`/`BC_LOCK` maps, the
  revision-diff visibility algebra, `budgetAllocated`.
- `__tests__/epic-detail.test.ts` — the payoff:
  - **Degradation matrix**: drumbeat on/off × budgeting on/off → correct
    present/absent slices, no leakage.
  - **Visibility algebra**: each `show*Diff` / `show*OwnerEdit` branch.
  - **Lock reasons**: correct string per `approvalPhase` (and `undefined` when
    `!canEdit`).
  - **Activity merge**: audit + approval comments, newest-first.
- **Gate:** builder green against fixtures; page still untouched.

### Stage 3 — Cutover (the mechanical swap)

Replace the page body (lines 91-429) with adapter wiring + one `loadEpicDetail`
call; each Drumbeat/Budgeting adapter is real-or-disabled per
`principal.enabledModules`. JSX consumes `model.*` and switches on
`model.drumbeat.disabled` / `model.budgeting.disabled`. Delete the dead inline
logic; the two raw cross-module Prisma reads are gone. Route shrinks to
`load → render` (~683 → ~200 lines, mostly JSX). Keep the lazy `slideOverDetail`.

- **Gate:** green + smoke (renders as before; a drumbeat-off tenant renders
  degraded with no errors).

### Stage 4 — Docs

- `CONTEXT.md`: add the **Epic Detail model** term (cross-module composition
  read-model; contrast with single-module page-models).
- `ADR-0013`: one line naming composition read-models as the home for cross-module
  page composites, and noting that entitlement degradation is what makes each
  upper-module port a real two-adapter seam.

## Test strategy (replace, don't layer)

The page currently has **zero** tests (an untestable async server component), so
there is nothing to delete — the builder suite is net-new coverage at the new seam.
Tests assert on `EpicDetailModel` output, not internals, so they survive internal
refactors.

## Risk / reversibility

Each stage is a standalone commit, revertible by branch-revert. The only risky stage
is 3 (the cutover); Stage 2 de-risks it by building and testing the model in full
_before_ the page is touched, so Stage 3 is a mechanical swap against a proven
builder. No DB/schema changes anywhere (`prisma db push`, no migrations).

## Scope

Budgeting (1 new file), Drumbeat (1 function), Work (1 model + tests), the route.
~4 commits.
