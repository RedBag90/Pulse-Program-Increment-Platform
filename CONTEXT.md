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
  end-exclusive `GanttMonthSpan` (`{ start, end, months[] }`, Gantt projection) —
  the two are intentionally not unified; the **names** carry the semantics, so
  callers see whether they get inclusive (`MonthAxis`) or end-exclusive
  (`GanttMonthSpan`).
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
- **Realisierter KPI-Wert (eine Quelle)** — der realisierte €-Wert eines Epics
  ist überall `achievement × valuePerUnit` (letzter Messwert, **einmalig**, ohne
  Horizont-Skalierung), wie das Epic-„Realisierter Mehrwert"-Tile (`kpi-valuation.ts`).
  **Related Work / Ziel-Trio** (`goals-rollup.ts`): `realized = achievement ×
planned`, kein `horizonShare` mehr. **Benefit Velocity** (`portfolio-economics.ts`
  `kpiRealizedValueByMonth` → `epicMonthlyFlows`): der monatliche Business-Value =
  Zuwachs der kumulierten KPI-Realisierung (`Σ fulfilment × |target−baseline| ×
valuePerUnit`), summiert über die Messmonate auf den vollen KPI-Wert. Der
  Business-Case-`recurringBenefit` ist nur noch der Flat-Forecast-Fallback für
  Epics **ohne** bewertete KPI.
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
  (PI planning), `buildCockpitModel` (transformation cockpit),
  `loadStrategyTree` (Themes + KRs + tenant trio for `/ziele` and `/strategy`)
  and `loadKpiInventory` (KPI library + KR index for `/controlling/kpi-coverage`)
  are the current ones; the page becomes load → build → render and the assembly
  is tested at the builder seam. Distinct from a domain read-model (e.g.
  Portfolio Series): a page-model is presentation glue, not business
  computation. Each page-model owns the queries for _its_ page only — a single
  god-loader is a smell.
- **Goal-Forest read-model** — `src/server/views/goals-forest.ts`, the **pure**
  derivation behind `loadStrategyTree`/`loadGoalDetail`: normalisierte Objective-
  Zeilen + Per-Knoten-Lookups → GoalNode-Baum (mit €-Trios/Fortschritt) via
  `buildStrategyTree`, und die Fortschrittsgraf-Serie via `buildProgressChart`.
  Der Loader (`ziele-view.ts`) ist nur noch Adapter (Prisma-Fetch + Normalisieren);
  die Ableitung ist DB-frei testbar (`__tests__/goals-forest.test.ts`). Der Seam
  ist `resolveNode` — die _eine_ Auflösung „Zeile → effektive Fortschrittsquelle
  (progressMode) + Ist-Wert + progressLeaf/trioLeaf/trioEpicLinks" für Baum **und**
  Graf (kein paralleler RollupNode-/SeriesNode-Schattenbaum mehr im Loader).

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

## Strategy & KPI bindings

- **Goal-Knoten** — seit ADR-0010 der **eine, rekursive** Knotentyp: `Objective`
  absorbiert `KeyResult`. Jeder Knoten kann `children` (Self-Relation `parentObjectiveId`,
  `level`, materialisierter `path`) **und/oder** eine eigene Metrik tragen. Beliebig tief
  kaskadierbar. Loader baut den Baum flach über `parentObjectiveId`; ein rekursiver
  `GoalNode`-DTO ersetzt die alten `ZieleTreeTheme`/`ZieleTreeKeyResult` (Aliase).
  `KrKpiContribution`, `GoalCheckin`, `GoalComment`, `GoalEpicLink` hängen nur noch an
  `objectiveId`. In der UI heißt jeder Knoten **„Ziel"** (Top-Level = „Theme (OKR)"); ein
  Erstellungspfad (`createGoalNodeAction`/`GoalPane`). `nodeKind` ist seit ADR-0011
  vestigial (nur Legacy-Label, behavioral nicht gelesen).
- **Fortschrittsquelle (ADR-0011)** — `Objective.progressMode` (`src/domain/goal-progress-mode.ts`)
  wählt **pro Ziel** die 0..1-Fortschritts-Berechnung: `manual` (eigener `current`),
  `rollup` (gewichteter Kinder-Ø), `auto_kpi` (Ist = **Summe** der einheitengleichen
  KPI-Ist-Werte aus verknüpften Epics, dann `keyResultProgress` gegen target). `null` ⇒
  abgeleitet (`hasChildren ? rollup : manual`, = Alt-Verhalten). `nodeProgress`
  (`goals-rollup.ts`) respektiert den Modus; `manual`/`auto_kpi` gewinnen **auch mit
  Kindern** (Override). **Getrennt von der Geld-Achse**: der €-Trio (`nodeTrio`, `formula`,
  `KrKpiContribution`, Epic-Links) bleibt unverändert — `auto_kpi` liest die Epic-KPIs nur
  zusätzlich für den Fortschritt (Count-once/ADR-0009 unberührt).
- **Fortschrittsgraf** — `loadGoalDetail` liefert `progressChart { mode, series, yDomain }`
  (`ziele-view.ts`, Serie via `src/domain/goal-progress-series.ts`). Die **Linie** folgt der
  Fortschrittsquelle: `auto_kpi` → zeitlicher KPI-Verlauf (`buildAutoKpiSeries`, laufende
  einheitengleiche Summe), `rollup` → gewichteter Ø der Unterziele über die Zeit
  (`buildNodeProgressSeries`, rekursiv über den Subtree), `manual` → Snapshots + Live-Ende.
  **Punkte** sind zweierlei: **farbige Status-Punkte** aus `recordGoalCheckin` (Status am gewählten
  `entryDate` → `GoalCheckin.createdAt`, eingefrorener `value`, `goalStatusColor`) und **neutrale
  Wert-Punkte** aus `recordGoalProgress` (statusloser Check-in mit `value` + `entryDate`, hohler
  grauer Dot). `ProgressChartPoint.entry` markiert Letztere; die KPI-Pflege bewegt nur die Linie
  (kein Punkt). Höhe: Roh-Wert (messbar) bzw. % (Rollup); Zeit-X-Achse. **Ein Check-in pro Tag:**
  `recordGoalCheckin`/`recordGoalProgress` upserten nach Tagesschlüssel (`dayStart`, UTC-Mitternacht)
  über `upsertDayCheckin` — der letzte Eintrag eines Datums überschreibt den Slot (Wert-Eintrag und
  Status-Update teilen ihn). Die „Latest status"-Card liest den authoritativen `objective.status`
  (nicht den Feed, wo das gleichnamige Audit-Event `goal.checkin` kollidiert).
- **Goal-Custom-Fields** — tenant-weit definierbare Zusatzfelder an Ziel-Knoten
  (`GoalCustomFieldDef` type text/number/select; Werte je Knoten in
  `GoalCustomFieldValue`, `@@unique([objectiveId, defId])`). Tenant-Admin verwaltet
  die Definitionen unter `/admin/goal-fields` (Capability `goal.custom_field.manage`);
  Werte pflegt man im Ziel-Drawer. `type`/`value` als validierte Strings am Domain-Seam
  (`src/domain/goal-custom-field.ts`). Loader hängt `customFields[]` an jeden `GoalNode`.
- **Strategy Map** — der Netzplan-Layout (`strategy-network-view.tsx`, ReactFlow +
  dagre) rendert den Goal-Baum rekursiv mit Goal-Status-Pill + Progress je Knoten,
  Expand/Collapse je Knoten (eingeklappt = „+N" verborgene Nachfahren, Teilbaum
  wird nicht gelayoutet) und Klick → Drawer als Side-Pane. Client-only auf dem
  `GoalNode`-DTO; Collapse-Zustand ephemer.
- **Theme (OKR)** — Top-Level-Goal-Knoten (parentObjectiveId = null) unter dem
  Tenant. Stored as `Objective`-Row; der legacy `StrategicTheme` bleibt versteckter
  Default-Anker. Carries title, narrative, period (see **Goal-Zeitraum**),
  confidence (1–5), status, rollt zu einem tenant trio hoch.
- **Key Result (KR)** — Goal-Knoten mit `nodeKind="key_result"`, messbares Blatt (oder
  selbst Zweig). Either `formula="manual"` (own baseline/target/current) or
  `formula="auto_from_kpi"` (€-rollup via bound Epic-KPIs). Eigenes optionales `period`.
- **Goal-Zeitraum** — a goal's time period (`Objective.period` /
  `KeyResult.period`), one canonical form: `YYYY-Qn` (quarter), `YYYY-Hn` (half),
  or `YYYY` (full year); `null` = backlog. All parsing/formatting/labelling lives
  in `src/domain/goal-period.ts`; the edit UI is the structured `PeriodPicker`
  (not free text). The OKR board anchors half/full-year goals to their starting
  quarter via `anchorQuarterKey`. Legacy malformed values fall back to their raw
  string on display.
- **Goal-Status** — the open/closed status model on Themes and Key Results
  (`src/domain/goal-status.ts`): open `on_track|at_risk|off_track`, closed
  `achieved|partial|missed|dropped`, `null` = "no recent updates". **Orthogonal
  to progress** — status is set at a check-in, progress is a separate number.
- **Check-in** — a `GoalCheckin` row: a status- and/or progress-update on a
  Theme or KR. Carries `status?`, a raw `value?` (frozen at check-in time),
  normalised `progress?`, and an optional note. Backs the history chart and the
  goal activity feed (`GoalComment` for free-text comments). Status-less rows
  (`status=null`) are pure progress updates.
- **Objective progress** — a Theme's completion is the (weighted) **normalised
  average** of its KR progresses (0–1), unit-independent (ADR-0008). Distinct
  from the **€-trio** (planned/realized/run-rate), which stays the money view.
- _Planned goal capabilities_ (metric units %/€, related work, access levels
  admin/editor/viewer, VS/ART responsibility) are specified in
  `docs/backlog/goals-asana-adoption.md` + `…-implementation-roadmap.md` and are
  **not yet** part of the domain.
- **Epic-KPI** — the single success metric per Epic (1 Epic = 1 KPI, enforced
  at seed). Carries `valuePerUnit` (€ per natural unit of improvement
  baseline→target), set by Controlling.
- **Pyramid binding** — the domain invariant for KR↔KPI bindings: every KPI
  feeds **at most one** Key Result. Combined with 1 Epic = 1 KPI, this gives a
  strict pyramid Epic → KPI → ≤ 1 KR, so every euro of realized benefit is
  countable exactly once at every level of the rollup. Enforced at three seams:
  (1) the `kpi-binding-invariant` domain module — pure validator, returns a
  `BindingPlan`; (2) the `setKpiBinding` service — acquires a per-kpi
  `pg_advisory_xact_lock` _before_ loading existing, so two concurrent calls
  on the same KPI serialize and the second is rejected with `pyramid_violated`
  (not a DB constraint error); (3) the `UNIQUE(kpiId)` constraint on
  `KrKpiContribution` — DB backstop for any bypass. No new caller may mutate
  the bridge table without going through the service.
- **Ziel-Epic-Verknüpfung ("Related work")** — a `GoalEpicLink` row links an Epic
  directly to a goal node (Objective **or** Key Result, polymorphic like
  `GoalCheckin`). Referential (deep-link) **and** value-bearing: the epic's KPI
  value (`epicLinkTrio`) rolls into the node's €-trio, the coarse alternative to
  binding each KPI individually. **Count-once (ADR-0009):** a KPI's value reaches
  goals via exactly one path — a `KrKpiContribution` **or** its epic being linked,
  never both. Three seams mirror the pyramid: `checkEpicLink` (pure validator,
  `conflict` on overlap), the `linkEpicToGoal` service (per-epic advisory lock +
  symmetric guard in `setKpiBinding`), and `UNIQUE(epicId)` on `goal_epic_links`
  (each epic feeds ≤ 1 goal). Capability `kpi.bind`; soft-deleted epics are
  filtered out (`Initiative.deletedAt`).
- **Related work: Feature/PI (referenziell)** — a `GoalRelatedWork` row attaches a
  Feature (Initiative level 1) or Program Increment to a goal node **purely
  referentially** (deep-link only, **no €-contribution** — unlike `GoalEpicLink`).
  `kind` is a validated string (`RELATED_WORK_KINDS = ["feature","pi"]`,
  `src/domain/goal-related-work.ts`), `refId` is a soft FK (polymorphic; existence
  checked in the service — Feature `...notDeleted`, PI plain). Service
  `goal-related-work.ts` (`addGoalRelatedWork`/`removeGoalRelatedWork`), gate
  `target.manage`, audit `goal.related_work.added/removed`. `UNIQUE(objectiveId,
kind, refId)`, FK `objective onDelete: Cascade`. The loader resolves titles +
  deep-links (`RelatedWorkItem[]` on `GoalNode`): Feature →
  `/portfolio/epics/{parentEpicId}?featureId={id}` (no own route — shown as a
  slide-over in its parent epic), PI → `/pi/{id}`. Drawer picker cascades
  ART → Feature/PI (`EntitySelect kind="feature"/"pi"` need an `artId`).
- **VS/ART-Verantwortung (Epic 6a)** — a goal node may be assigned to **many**
  Value Streams and/or ARTs (n:m), purely organisational — **no auth effect**
  (goal mutations stay gated only by `target.manage` at the action layer; the
  access-level model admin/editor/viewer is a deferred follow-up, ADR-0007).
  Tables `GoalValueStreamLink` / `GoalArtLink` (`UNIQUE(objectiveId, vs|art)`,
  FK `onDelete: Cascade` on both sides). Service `goal-scope-link.ts`
  (`link/unlinkGoalValueStream`, `link/unlinkGoalArt`), audit
  `goal.value_stream.linked/unlinked` + `goal.art.linked/unlinked`. Loader hangs
  `valueStreams[]` / `arts[]` (`ScopeRef`) on each `GoalNode` and accepts
  `{ valueStreamId?, artId? }` — filtering **top-level** nodes (subtrees stay
  whole, like the period filter). Pages read `?vs=` / `?art=`; the shell's
  `GoalScopeFilterBar` (self-fetching `<select>`s) writes them via `useUrlState`.
  Drawer edits via `GoalScopeLinks` chips (`EntitySelect kind="valueStream"/"art"`,
  standalone — no cascade).

## Authorization

- **Principal** — the authenticated user resolved to roles + visibility scopes.
- **Role** — one of 8 SAFe-oriented roles (`src/domain/roles.ts`): `platform_admin`,
  `tenant_admin`, `portfolio_manager` (the consolidated portfolio lead — folds in the
  former `transformation_lead` and `vmo`), `value_stream_owner`, `epic_owner`, `rte`
  (also absorbs the former `team_editor`), `feature_owner`, `viewer`.
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

## Modules (Freemium-Entitlements)

- **Module** — a sellable feature block (`src/domain/modules.ts`): `ziele`,
  `portfolio`, `program`, `controlling`, `roadmap`, `reporting`, `structure`,
  `admin`, plus the always-on **core** segments (`start`, `my-tasks`,
  `my-approvals`). The registry maps each module to route segments and action
  prefixes — one source for nav filter, route guard and action gate.
- **Entitlement** — `Tenant.enabledModules` (empty = kind default). Managed
  **only** via the platform-admin API (`POST/PATCH /api/v1/admin/tenants`,
  `tenant.create` gate) — never tenant self-service. Orthogonal to practices
  (operating model) and RBAC: effective visibility = entitlement ∧ practice ∧
  capability.
- **Tenant kinds** — `organization` (client tenant, platform-admin-created,
  default all modules) and `personal` (auto-created free workspace via
  `ensurePersonalTenant` on `/start`, default `["ziele"]`, its user is
  `tenant_admin` of it, not invitable — `tenant.users.manage` maps to the
  locked `admin` module).
- **Active tenant** — the `pulse-tenant` cookie selects among a user's role
  assignments (`resolveActiveAssignments`); roles/scopes/capabilities are
  aggregated **per active tenant only** (never across tenants). The topbar
  `TenantSwitcher` sets the cookie; sign-out clears it.
- **Enforcement (fail-closed)** — dashboard layout redirects deep links to
  locked modules (`x-pathname` header from middleware → `moduleForPath`);
  module-locked nav groups render greyed with a lock + "Vollversion" popover
  (practice/capability-hidden items stay hidden); `createServerAction`,
  `createMutationHandler` and `createQueryHandler` (with `readAction`) block
  actions via `moduleForAction`. Unregistered route segments are locked — the
  module-registry completeness test forces new segments to be registered.

## UI layout

- **Layout primitives** — `<Page>`, `<PageHeader>`, `<PageSection>` from
  `src/components/layout/`. Every page wraps its content in `<Page>` instead of
  a raw `<main className="p-8 ...">`. Page padding, max-width and section
  rhythm come from CSS tokens defined in `src/app/globals.css` — see
  `docs/design-tokens.md`. Do not inline `p-6`/`p-8`/`space-y-6` on page
  wrappers; the primitives own that rhythm.
