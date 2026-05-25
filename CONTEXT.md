# Pulse — Domain Language (CONTEXT.md)

The ubiquitous language for the Pulse Program Increment Platform. Architecture
reviews, module names, and new code should use these terms exactly. Deeper
narrative lives in `docs/concepts/`; role↔capability mapping in
`docs/role-function-matrix.md`.

## Core entities

- **Tenant** — one customer workspace. Every row is tenant-scoped (RLS).
- **Initiative** — the shared substrate for **Epic** and **Feature**; both are
  rows in the `initiative` table discriminated by `level`
  (`InitiativeLevel.EPIC` / `FEATURE`). Code that applies to both says
  _Initiative_, not "Epic or Feature".
- **Epic** — portfolio-level Initiative. Carries a Business Case and a Benefit
  Hypothesis.
- **Feature** — program-level Initiative under an ART; carries a WSJF score.
- **Value Stream** — funds and groups Epics.
- **ART** (Agile Release Train) — groups Features and Teams; runs PIs.
- **PI** (Program Increment) — a planning cadence; has Objectives and Sprints.
- **Story / Task** — team-level work under a Feature.
- **Team** — an execution unit within an ART.
- **Dependency** — a directed link between work items (cycle-checked).
- **Impediment** — a blocker that can be raised, escalated, resolved.

## Time & periods

- **Calendar** — `src/domain/calendar.ts`, the single source of UTC date
  arithmetic. Owns the **day** (`isoDay`, `dayStart`), **month**
  (`monthStart`/`addMonths`/`monthDiff`/`parseIsoMonth`, `MONTH_LABELS`) and
  **half-year** primitives, plus the two **period axes** below. Every other
  module builds on it instead of reimplementing date maths.
- **Period key** — the canonical string for a bucket: **month** `YYYY-MM`,
  **half-year** `YYYY-H1` / `YYYY-H2` (one half-year = one 6-month business-case
  cost slice).
- **Month axis** (`MonthAxis`) — an inclusive `{ start, monthCount, months[] }`
  span used by portfolio economics. Distinct from the roadmap's own
  end-exclusive `{ start, end, months[] }` axis (Gantt projection) — the two are
  intentionally not unified.
- **Half-year axis** (`HalfYearAxis`) — the inclusive `{ start, count, periods[] }`
  span used by participatory budgeting.
- **Epic Schedule** — `src/domain/epic-schedule.ts`, the pure read/derivation
  model of an Epic's delivery timeline. Resolves the two anchors —
  **costStart** (the Backlog milestone, where cost begins) and **goLive** (the
  Implementation milestone, completion) — from the timeline's
  actual → estimate → approval → createdAt fallback chain, and owns the rule
  that turns a budgeting decision into timeline estimates
  (`scheduleFromFundedWindow`) plus the actuals-preserving merge
  (`withScheduleEstimates`). Conflict policy between the owner's `saveTimeline`
  and budgeting's `saveBudgetAllocation` is **last writer wins**; budgeting only
  touches the backlog/implementation estimates, so owner actuals always survive.
- **Epic Economics read-model** — `src/domain/epic-economics.ts`,
  `deriveEpicEconomics(source)`: given one Epic's raw artefacts it derives the
  single economic view both the Portfolio Dashboard and Participatory Budgeting
  consume — parsed Business Case, cost slices, totals, costStart/goLive (via the
  Epic Schedule), and the KPIs that realise the recurring benefit with their
  resolved weights. The **benefit-weight fallback** (literal weights → equal
  split → empty) lives here, so it is consistent across consumers.
- **Portfolio Series** — `buildPortfolioSeries(data, query)` in
  `src/domain/portfolio-economics.ts`: a pure montage from the dashboard DTO
  (`PortfolioEconomicsData`) plus the slicer state (`selectedEpicIds`, the
  Stichtag `from`/`to` window) to the rendered `PortfolioSeries`. Runs the same
  in the server loader and the client `useMemo`, so the assembly is tested at
  this seam rather than through the React component.
- **Roadmap view** — the render-ready Gantt rows + month axis in
  `src/domain/roadmap.ts`: `RoadmapRow` plus one pure builder per perspective
  (`portfolioRoadmapRows`, `artRoadmapRows`, `valueStreamRoadmapRows`) and
  `roadmapAxis(rows)`. The roadmap service loads the initiative rows; these
  builders shape them, so the roadmap pages are load → build → render and the
  shaping is tested at the builder seam (not through the page). Uses the
  roadmap's own end-exclusive `MonthAxis` (Gantt projection).
- **Page-model** — `src/server/views/*`: pure server-side assembly that turns
  loaded rows into the render-ready props a page passes to its client
  components (filter, reshape, serialise Date→ISO). `buildPlanningModel`
  (PI planning) and `buildCockpitModel` (transformation cockpit) are the current
  ones; the page becomes load → build → render and the assembly is tested at the
  builder seam. Distinct from a domain read-model (e.g. Portfolio Series): a
  page-model is presentation glue, not business computation.

## State axes on an Initiative (independent — do not conflate)

- **Stage Gate** (`stageGate`, L0–L5) — the investment funnel. Governed by
  `src/domain/stage-gate.ts`; advanced via the `epic.approve` capability.
  Reaching L3 is the portfolio approval decision.
- **Review status** (`status`: `draft → in_review → approved`) — the **QS
  gate**, a.k.a. quality assurance. Governed by
  `src/domain/initiative-status.ts`. Orthogonal to the Stage Gate: an Initiative
  has both a stage-gate level and a review status, set independently.

## Review (QS) — the quality workflow

- **Submit for review** — an owner moves a draft Initiative to `in_review`.
- **Review decision** — a reviewer approves (`→ approved`) or returns
  (`→ draft`). Separation of duties: the submitter does not decide.
- **Initiative Review** — the (proposed deep) module that owns this workflow for
  any Initiative kind, distinct from the pure state machine in
  `initiative-status.ts`. Epic review is decided by the **VMO**; Feature review
  by the **RTE**.

## Authorization

- **Principal** — the authenticated user resolved to roles + visibility scopes.
- **Role** — one of 12 SAFe-oriented roles (`src/domain/roles.ts`).
- **Capability / Action** — a state-changing operation gated by policy
  (`epic.update`, `feature.review.decide`, …). The full list is the `Action`
  union.
- **Policy / Grant** — `POLICIES` maps each Action to the roles (and optional
  **Scope**) allowed to perform it. `platform_admin` / `tenant_admin` bypass.
- **Scope** — an extra match a grant may require: `value_stream`, `art`, `team`,
  or `own`. Empty principal scope = "all in reach".
- **Permission seam** — `authorize()` / `hasPermission()` / `PermissionGate`:
  the single place a role↔capability decision is made. `POLICIES` is the source
  of truth for both server mutations and UI affordances; pages should ask for a
  **capability**, never re-list roles inline.
- **Service-seam authorization** — `authorizeResource(principal, action,
resource)` is the _authoritative, scope-aware_ check, run inside a service
  **after** the target row is loaded so `value_stream`/`art`/`own` scope fields
  come from the real row (not the raw input). The action factory's `authorize`
  is a cheap pre-filter; by-id mutations would otherwise satisfy scope grants
  vacuously. See ADR-0002 (and its deferred story/task/dependency ancestor-scope
  cases).
