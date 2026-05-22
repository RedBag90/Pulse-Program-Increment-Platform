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
