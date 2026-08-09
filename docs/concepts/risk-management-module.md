# Risk Management module (`risks`) — ROAM + n:m Epic links

Design spec for a new sellable module. Status: approved, pre-implementation.

## Context

Pulse has no first-class **Risk** entity. SAFe's **ROAM** technique is half-implemented today: the
vocabulary (`open | resolved | owned | accepted | mitigated`) is bolted onto **Impediments**
(`Impediment.roamStatus`, `setImpedimentRoam`, the `/impediments` "Risks & Impediments — ROAM" overview in
the _Drumbeat_ module), and `pi-workspace.riskCount` is an explicit `"Platzhalter bis Risk-Register"` stub
that is always `0`. This module adds the missing noun: a first-class, tenant-level **Risk register** with
its own ROAM disposition and a probability × impact matrix, whose Risks link many-to-many to Epics.

**ROAM (analysis).** SAFe risk technique applied when risks surface during PI Planning. Each risk is worked
into exactly one disposition: **Resolved** (eliminated), **Owned** (someone accountable, stays live),
**Accepted** (nothing more to do), **Mitigated** (a reduction plan is in place) — plus the pre-ROAM
**open/identified** state. The primary artifact is the **ROAM board**: a funnel by disposition, surfacing
how many risks are still un-ROAMed.

**Locked decisions.**

1. **Tenant-level register** — a Risk is portfolio-level, connected to the org ONLY via its n:m Epic links.
   The module depends on **Work + Core only**; no Drumbeat/ART/PI coupling → clean sibling boundary.
2. **Keep impediment-ROAM separate** — the Drumbeat impediment ROAM stays untouched; Risk is a distinct
   entity with its own ROAM. The ROAM _vocabulary_ is lifted to a shared Core primitive so both consume it
   downward (retires today's double-definition of `ROAM_STATUSES`).
3. **Probability × Impact matrix** (5×5) — two enums → a computed **exposure band**, the module's deep pure
   seam.

## Module shape

New top-level sellable module **`risks`**, prerequisite **`work`**, sibling of drumbeat/budgeting
(Core ← Work ← {Drumbeat, Budgeting, **Risks**}). Code lives in `src/modules/risks/`. ROAM is the single
status axis on a Risk (no separate workflow axis like Impediment has).

Mirrors two proven slices: **Impediment** for CRUD+ROAM (`src/modules/drumbeat/server/services/impediment.ts`

- `.../features/impediment/*`), and **`GoalRelatedWork`** for the referential n:m Epic link
  (`src/modules/core/goals/server/services/goal-related-work.ts`) — but with a **hard FK** to `Initiative`
  (single target type = Epic) instead of its polymorphic `kind`+`refId`, and **no value rollup** (unlike
  `GoalEpicLink`).

## Domain model

- **ROAM primitive → Core** (`src/modules/core/kernel/domain/roam.ts`): `RoamStatus`, `ROAM_STATUSES`,
  `ROAM_LABELS`, `isRoamStatus`, and a canonical **`ROAM_COLORS`** map (one hue per disposition — the
  ROAM-cluster palette shared by every surface: `open` = neutral/gray, `resolved` = green, `owned` = blue,
  `accepted` = amber, `mitigated` = violet). Both `risks` and the drumbeat impediment import these downward
  (retires the duplicate `ROAM_STATUSES` defs in `impediment.ts` + `impediments-overview.ts` and the ad-hoc
  `ROAM_DOT` map in the impediment overview shell). `open` = identified/un-ROAMed.

  **Two color axes (kept distinct on purpose):** the **exposure band** (probability × impact) colors the
  Risk-Matrix **cell background** (heat: green→amber→red→dark-red); the **ROAM cluster** (`ROAM_COLORS`)
  colors the **individual risk** everywhere it appears — the ROAM-board funnel segments, the list-row
  disposition chip, and the risk markers plotted inside the matrix cells.

- **Risk matrix** (`src/modules/risks/domain/risk-matrix.ts`, the deep testable seam): a **5×5** grid.
  `Probability` / `Impact = "very_low"|"low"|"medium"|"high"|"very_high"` (levels 1..5); pure
  `riskExposure(p, i): { score: 1..25; band: "low"|"medium"|"high"|"critical" }` where `score = p·i` and the
  band thresholds are `≤4 low · 5–9 medium · 10–15 high · 16–25 critical` (a named, tunable `BAND_THRESHOLDS`
  table). **Single source of truth for band color** — the same function drives the list-row exposure badge
  AND the matrix cell colors. `MATRIX_CELLS` enumerates the 25 cells with their band for legend/axes.
  - **Unscored risks:** probability/impact are optional — a risk with no scoring has **no matrix position**
    (it sits in an "unscored" list/count, not plotted).
  - **Inherent → residual trail:** a scored risk has an **inherent** `(probability, impact)` plus an ordered
    **assessment trail** (each `reassessRisk` appends one; a reassessment may raise or lower exposure). Pure
    `riskPosition(risk, assessments)` → `{ inherent?, trail: [{p, i, band, cell}...], current: last(trail) ??
inherent ?? null }`. `current` drives the exposure badge, the ROAM board bucket, and the live cell; the
    trail (inherent → … → current) is the **multi-hop mitigation vector**.

- **Risk category** (`src/modules/risks/domain/risk-category.ts`, pure): `RISK_CATEGORIES = ["technical",
"business", "schedule", "external"]` + `isRiskCategory` guard.
- **Risk number** (`src/modules/risks/domain/risk-number.ts`, pure): `formatRiskNumber(prefix, n, pad = 3)`
  → e.g. `"RISK-042"`. Only the integer is stored; the display is computed from the tenant prefix at render,
  so changing the prefix reformats every risk with **no backfill**.
- **Review axis** (`src/modules/risks/domain/risk-review.ts`, pure): `RISK_REVIEW_STATUSES =
suggested | documented | rejected` + transition guards.

## Authoring workflow — Epic Owner documents, everyone suggests

A Risk carries a **review axis** independent of ROAM. ROAM/exposure apply to **documented** risks;
suggested risks are proposals awaiting an Owner's decision.

- **Everyone suggests** — capability `risk.suggest` (broad, incl. viewer). Creates a Risk in `suggested`,
  suggester recorded (`raisedBy`), pre-linked to an Epic when raised from that Epic's Risks tab. Suggestions
  are minimal: only a title is required.
- **Epic Owner documents** — capability `risk.document` (epic_owner, portfolio_manager, rte). Creates a Risk
  directly in `documented` and edits documented risks.
- **Owner reviews suggestions** — capability `risk.review` (epic_owner, portfolio_manager): accept
  (`suggested → documented`, stamps `reviewedBy`/`reviewedAt`) or reject (`suggested → rejected`).
- **Scope (ADR-0002 service-seam):** `risk.document` / `risk.review` are scope-aware — an `epic_owner` may
  act only on a risk linked to an Epic in their value-stream scope. The check loads the risk + its
  `RiskEpicLink` epics and runs `authorizeResource` against those value streams (portfolio manager / admins
  bypass). This is how "per Epic" ownership works despite Risk being tenant-level + n:m — authority is
  derived from the linked Epics. An **unlinked** risk has no VS scope, so only portfolio_manager/admin can
  review it. Reviewer conflict on multi-Epic risks: **first-accept-wins**.

## Persistence (`prisma/schema.prisma`, then `prisma db push` — NO migrations)

- **`model Risk`** (plain `tenantId @db.Uuid` column, like `Impediment`): `id`, `tenantId`,
  `riskNumber Int?` (per-tenant sequential handle — **null until documented**), `title`, `description?`,
  `probability?`, `impact?` (the **inherent** assessment — optional; current = latest `RiskAssessment` else
  inherent), `category?` (allow-list technical/business/schedule/external), `targetResolutionDate?`
  (→ overdue flag), `reviewStatus @default("suggested")`, `roamStatus @default("open")`, `roamRationale?`,
  `ownerId?` (the **Risk owner** — accountable person, assignable any time, independent of ROAM),
  `raisedBy`, `reviewedBy?`, `reviewedAt?`, `createdAt`, `updatedAt`, `deletedAt?` (soft-delete).
  `@@unique([tenantId, riskNumber])`, `@@index` on `[tenantId, reviewStatus]`, `[tenantId, roamStatus]`,
  `[tenantId, ownerId]`. `@@map("risks")`.
- **`model RiskMitigation`** — mitigation activities (text-only; a risk has many): `id`, `tenantId`, `riskId`
  (FK cascade), `description`, `createdAt`, `createdBy`. `@@map("risk_mitigations")`.
- **`model RiskAssessment`** — the reassessment **trail** (every valuation over time → multi-hop matrix
  movement): `id`, `tenantId`, `riskId` (FK cascade), `probability`, `impact`, `note?`, `createdAt`,
  `createdBy`. Inherent is assessment #0; each `reassessRisk` appends a row; current = latest.
  `@@map("risk_assessments")`.
- **`model RiskSettings`** — risks-owned per-tenant config + gapless counter: `id`, `tenantId @unique`,
  `prefix @default("R-")`, `lastNumber @default(0)`, timestamps. Upserted lazily. `@@map("risk_settings")`.
- **`model RiskEpicLink`** — minimal referential n:m, hard FK to epic: `id`, `tenantId`, `riskId`
  (FK cascade), `epicId` (FK→Initiative cascade), `createdAt`, `createdBy`. `@@unique([riskId, epicId])`,
  `@@index` on `[tenantId, riskId]` + `[epicId]`. **Zero value columns.** `@@map("risk_epic_links")`.
- Back-relations on `Risk` (`mitigations`, `assessments`, `riskEpicLinks`) and `Initiative` (`riskLinks`).
  No `tenant` relation on `Risk`; Tenant hard-delete stays blocked (no cascade).

## Layer-by-layer

Mirrors the Impediment + GoalRelatedWork checklists. Services use the standard mutation pattern
(`toMutationContext` → `withAuditedTransaction` → `findOr404` → guard → `ok({ result, audit })`).

- **`risk.ts`** — `suggestRisk` (title-only OK; no number yet), `documentRisk` (assigns the number),
  `reviewRisk(accept|reject)` (accept assigns the number; scope-checked), `updateRisk`
  (title/desc/prob/impact/category/targetResolutionDate/ownerId), `assignRiskOwner`, `addRiskMitigation` /
  `removeRiskMitigation`, `reassessRisk` (appends a `RiskAssessment`), `setRiskRoam`, `deleteRisk` (soft),
  `listRisks(db, principal, …)` (read-scoped). **Number assignment only at the `→ documented` transition**,
  inside a per-tenant `pg_advisory_xact_lock` (upsert-and-increment `RiskSettings.lastNumber`); gapless,
  concurrency-safe; `@@unique` is the backstop (nullable, so numberless suggestions don't collide).
- **`risk-settings.ts`** — `getRiskSettings` (lazy default) + `setRiskPrefix` (audit `risk.settings.updated`;
  never touches `lastNumber` or existing rows — display reformats at render).
- **`risk-epic-link.ts`** — `linkRiskToEpic` / `unlinkRiskFromEpic`; owner-exists + epic-exists checks,
  `onUniqueConstraint` backstop; no rollup.
- **`risk-read-scope.ts`** — pure `riskReadFilter(principal)` → Prisma `where`: managers/empty-scope ⇒ all;
  scoped member ⇒ only risks linked to Epics in their VS/ART scope; unlinked risks are manager-only.
- **Page-model `risks-list.ts`** — pure `buildRisksListModel(prefix, userLabels, …)`; rows carry
  `displayNumber` (null → "Vorschlag" chip), `reviewStatus`, `ownerLabel`, `category`, `targetResolutionDate`
  - `isOverdue`, `exposure` band (null for unscored). Partitions documented vs suggested: the ROAM funnel +
    matrix run over **documented** risks. Matrix data is two-part — `cells` (heat backdrop counts) + per-risk
    `plots` (the assessment trail coords for dot/ghost/connector). Unscored → `unscored` list; a `suggestions`
    list backs the review queue.
- **Actions `risk.ts`** (`createServerAction`): `suggestRiskAction`, `documentRiskAction`, `reviewRiskAction`,
  `updateRiskAction`, `assignRiskOwnerAction`, `addRiskMitigationAction`/`removeRiskMitigationAction`/
  `reassessRiskAction`, `setRiskRoamAction` (+ batch), `deleteRiskAction`, `linkRiskToEpicAction`/
  `unlinkRiskToEpicAction`, `setRiskPrefixAction`.
- **Components** — `risks-list-shell` (owns the Suggestions queue), `create-risk-dialog` (title required,
  rest optional; documents or suggests by capability), `risk-roam-board` (ROAM funnel + bulk), **`risk-matrix`**
  (5×5 heat map; ROAM-colored dots at current position; crowding = jitter/"+N"; **hover-only multi-hop
  mitigation vector** revealing the trail as hollow circles + dotted connectors), `risk-list-table`/`-row`
  (number + ROAM chip + exposure badge + owner), `risk-filter-bar` (category/owner filters, overdue toggle,
  "Meine Risiken"), `risk-detail-drawer` (owner picker, mitigation log + reassess, Epic link picker),
  `risk-settings-dialog` (admin prefix editor behind `risk.settings.manage`).
- **Global "+" create menu** — a `{ key: "risk", group: "more", inPlace: true }` entry in
  `src/features/create/registry.ts`; the dialog wired into `src/app/[locale]/(dashboard)/_components/create-menu.tsx`
  (composition root), mirroring impediment/dependency.
- **Route** `src/app/[locale]/(dashboard)/risks/page.tsx` — `listRisks(db, principal, …)` (applies
  `riskReadFilter`) + settings + trails + epic links + user labels → `buildRisksListModel` → `RisksListShell`.

## Epic detail integration — a "Risks" tab with an epic-scoped Risk Matrix

Extends the Epic Detail composition read-model (`epic-detail.ts`, `loadEpicDetail`) with a third
entitlement-gated slice, mirroring its Drumbeat/Budgeting slices — Work never imports the `risks` module.

- **`loadEpicRiskMatrix(db, tenantId, epicId)`** (risks view) — the risks linked to the epic via
  `RiskEpicLink.epicId`, through the same matrix aggregation (incl. trail plots), numbers formatted via the
  tenant prefix.
- **Epic Detail model** gains a structural `EpicRisksPort` + a discriminated `risks` slice, gated on
  `enabled.risks`. Work holds only the DTO (P7-safe).
- **Epic route** injects the adapter and renders a **Risks tab** (`EPIC_TABS`): the epic-scoped `RiskMatrix`,
  the linked-risk list, a document/suggest shortcut pre-linked to this Epic, a "Risiko verknüpfen" affordance,
  and the suggestions-for-this-Epic review queue. Tab absent when `risks.disabled` — degrades cleanly.

## Auth · Registry · Boundary

- **Policies** (`src/server/auth/policies/index.ts`): eight `risk.*` actions —
  `suggest | document | review | update | roam | delete | link | settings.manage`. `risk.suggest` → everyone
  (incl. viewer); `risk.document` → `[EPIC_OWNER, PORTFOLIO_MANAGER, RTE]` (scope-checked); `risk.review` →
  `[EPIC_OWNER, PORTFOLIO_MANAGER]`; update/link/roam → `[EPIC_OWNER, PORTFOLIO_MANAGER, RTE]`; delete →
  `[PORTFOLIO_MANAGER]`; `settings.manage` → `[TENANT_ADMIN, PORTFOLIO_MANAGER]` (+ admin fast-path). All gate
  under the `risks` module via the `"risk."` prefix.
- **Registry** (`src/modules/core/kernel/domain/modules.ts`, 3 edits): `MODULE_KEYS += "risks"`;
  `MODULE_PREREQUISITES.risks = ["work"]`; `MODULES.risks = { label: "Risks", segments: ["risks"], actions:
["risk."], home: "/risks" }`.
- **ESLint** (`eslint.config.mjs`): new `src/modules/risks/**` block forbidding drumbeat + budgeting; add
  `@/modules/risks` to the core / work / drumbeat / budgeting / composition-root forbid-groups.
- **Nav — top-level entry** (`src/components/nav/nav-config.ts`): a single-item `NavGroup` (`labelKey:
"risks"`, `defaultHref: "/risks"`, `ShieldAlert` icon) — renders as a standalone top-level link like
  _Ziele_, placed after `implementation` / before `setupControlling`. Auto-hides for non-entitled tenants via
  `moduleAllowed`. Adds the `risks` i18n label.

## Tests

- `risk-matrix.test.ts` — exposure per 5×5 cell + `BAND_THRESHOLDS` + `MATRIX_CELLS` + `riskPosition` over a
  trail (current selection, multi-hop, unscored).
- `risk-read-scope.test.ts` — `riskReadFilter` (manager → all; scoped → linked-in-scope; unlinked hidden).
- `risks-list.test.ts` — page-model: funnel counts, matrix cells + plots, review partition, display numbers,
  facets, overdue.
- `risk-number.test.ts`, `risk-review.test.ts`, `risk-category.test.ts` — pure domain guards.
- `risk.integration.test.ts` — CRUD, ROAM, numbering-on-document (gapless, no reuse), prefix change, the
  authoring workflow (suggest → scope-rejected document/review → owner accept stamps reviewer), reassessment
  trail, concurrency (two `documentRisk` → distinct numbers).
- `risk-epic-link.integration.test.ts` — link/unlink, `@@unique`, epic-exists rejection, referential.
- `epic-risk-matrix.test.ts` + `epic-detail.test.ts` (extend) — epic-scoped aggregation + the `risks`
  degradation slice.
- `modules.test.ts` (extend) — `moduleForPath`/`moduleForAction`/prereq-closure for `risks`.

## Staged roadmap (each stage independently green + revertible)

- **S1 — Module skeleton + domain.** Registry (3 edits) + eslint blocks + `core/roam.ts` (repoint the
  drumbeat impediment imports) + `risk-matrix`/`risk-number`/`risk-review`/`risk-category` domain +
  `modules.test`/domain tests. No DB, no UI.
- **S2 — Schema + services.** The five models → `prisma db push` + `generate`; `risk.ts`, `risk-settings.ts`,
  `risk-epic-link.ts`, `risk-read-scope.ts` + integration tests.
- **S3 — Actions + policies + page-model + UI + route + nav + create-menu.**
- **S4 — Epic detail Risks tab.** `loadEpicRiskMatrix` + the `EpicRisksPort`/`risks` slice + `EPIC_TABS` +
  the epic route wiring; extend `epic-detail.test.ts`.
- **S5 — Docs.** `CONTEXT.md` domain terms, `docs/role-function-matrix.md` (the eight `risk.*` capabilities),
  ADR-0016 (tenant-level register; ROAM its status axis; review authority from linked-Epic scope; kept
  separate from Impediment-ROAM; shared ROAM primitive in Core).

## Verification

- **Per stage:** `tsc` 0, `eslint` 0 (the new boundary block + composition-root stay green), `vitest`
  (baseline 937 passed; risk integration tests run when `DATABASE_URL_TEST` is set).
- **S2 DB:** `prisma db push` + `generate` regenerate the client with the five models.
- **Smoke:** Risks top-level nav (entitled only); "+" menu → Risk under MORE; `/risks` renders the ROAM
  board + 5×5 matrix; document → sequential number, suggestion → "Vorschlag"; admin prefix change reformats
  all; owner assignment + category/overdue filters; reassess twice → dot shifts, hover reveals the multi-hop
  trail; scoped reads; ROAM recolors everywhere; Epic detail Risks tab shows the epic-scoped matrix and
  degrades when risks is off.

## Operational notes

- **ROAM→Core regression:** moving the ROAM primitive into Core touches the live drumbeat impediment ROAM —
  keep `/impediments` + `impediment.integration` green as a regression gate.
- **i18n (de+en):** ROAM/review labels, probability/impact levels, matrix axes, capability strings, nav +
  create-menu labels.
- **RLS:** owner-bypass stance — every risks service filters by `tenantId` itself.

## Resolved edge-case decisions

Queue-only notifications (no event/inbox in v1) · number-on-document · minimal suggestions (title only) ·
5×5 matrix (`p·i`, bands ≤4/5–9/10–15/16–25) · reassessment trail (not single residual) · text-only
mitigations · scoped reads · `category` + `targetResolutionDate` · closure = ROAM `resolved` ·
first-accept-wins for multi-Epic reviewers.

**Assumed defaults (changeable):** Impact=X / Probability=Y axes; `very_low…very_high` labels; drawer detail
(no `/risks/[id]` page); default sort by exposure desc; inherent scoring editable post-document; no
per-risk activity feed / bulk document-reject / export / comments.

## Deferred (not in this module)

Impediment-ROAM consolidation · PI-planning surfacing (`riskCount`) · portfolio-health / reporting rollup ·
Impediment↔Risk / Goal↔Risk links · REST API (`/api/v1/risks`) · structured mitigation activities
(owner/due/status) · source/origin + tags fields · `EntitySelect kind="epic"` (confirm/add).
