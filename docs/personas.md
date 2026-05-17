# Pulse — User Personas

One persona per RBAC role. The role model in
[`src/domain/roles.ts`](../src/domain/roles.ts) has **12 roles** — a SAFe-oriented
set. Below, every role gets exactly one persona.

Permissions are cross-checked against the live policy registry
[`src/server/auth/policies/index.ts`](../src/server/auth/policies/index.ts).
For a function-by-function breakdown see
[`role-function-matrix.md`](./role-function-matrix.md). `viewer` appears in **no
grant** — it is a pure read-only role, scoped by Row-Level Security.

## Summary

| RBAC role            | Persona                         | In one line                                           |
| -------------------- | ------------------------------- | ----------------------------------------------------- |
| `platform_admin`     | Raffi — Platform Operator       | Runs the Pulse platform across all tenants            |
| `tenant_admin`       | Nadia — Workspace Administrator | Owns one tenant: users, roles, ARTs, integrations     |
| `portfolio_manager`  | Priya — Portfolio Lead          | Manages the portfolio backlog and funds value streams |
| `value_stream_owner` | Bea — Value Stream Owner        | Steers one value stream and its Epic backlog          |
| `epic_owner`         | Erik — Epic Owner               | Formulates Epics and submits them to QS               |
| `vmo`                | Vera — Value Management Office  | Reviews Epics and governs the investment funnel       |
| `rte`                | Anna — Release Train Engineer   | Orchestrates an ART, runs PI Planning and Feature QS  |
| `feature_owner`      | Sven — Product Manager          | Owns the Feature backlog and WSJF scoring             |
| `team_editor`        | Tom — Scrum Master              | Runs a team's sprints, stories and impediments        |
| `story_owner`        | Jonas — Tech Lead               | Owns specific Stories end-to-end                      |
| `task_owner`         | Daniel — Developer              | Picks up Tasks and reports progress                   |
| `viewer`             | Mara — Stakeholder              | Watches portfolio health and PI outcomes, read-only   |

---

## Raffi — Platform Operator

- **RBAC role:** `platform_admin`
- **Context:** Works for the Pulse vendor, not for any customer. Operates the
  platform itself — provisions tenants, watches telemetry, keeps background jobs
  healthy. The only role that is not a SAFe role.
- **Goals:** Onboard new customer tenants quickly; keep the platform healthy and
  observable; resolve incidents before customers notice.
- **How they use Pulse:** Tenant provisioning and cross-tenant operations;
  monitors Sentry and the outbox/cron processor.
- **Permissions & scope:** Allowed every action (handled directly in
  `authorize()`); the only role that may `tenant.create`. **Scope: cross-tenant.**

## Nadia — Workspace Administrator

- **RBAC role:** `tenant_admin`
- **Context:** The customer-side owner of one Pulse tenant — typically an
  Agile/Transformation Office lead.
- **Goals:** Get the right people the right access; stand up ARTs and teams;
  connect Jira/Azure DevOps; satisfy audit and compliance asks.
- **How they use Pulse:** `/admin/users`, `/admin/integrations`,
  `/admin/audit-log`; creates ARTs and teams.
- **Permissions & scope:** `tenant.users.manage`, `integration.manage`, full ART
  and team lifecycle, `epic.delete`, `feature.delete`, audit-log and user-list
  reads. `authorize()` allows `tenant_admin` every action **within their
  tenant**. **Scope: the whole tenant.**

## Priya — Portfolio Lead

- **RBAC role:** `portfolio_manager`
- **Context:** Lean Portfolio Management. Owns the portfolio backlog and decides
  where investment goes.
- **Goals:** Keep a clear, prioritised Epic backlog; fund value streams
  deliberately; move Epics through their stage gates with evidence.
- **How they use Pulse:** `/portfolio` overview, `/portfolio/epics` (Portfolio
  Kanban, create/approve Epics), `/portfolio/value-streams`.
- **Permissions & scope:** `value_stream.create/update`, full `epic.*` including
  `approve`, `delete` and `review.submit`, full `feature.*` (incl. `delete`),
  `story`/`task` actions (ART-scoped), `dependency.link/unlink`, all
  `impediment.*`. **Scope: value streams** (empty = whole tenant).

## Bea — Value Stream Owner

- **RBAC role:** `value_stream_owner`
- **Context:** A business stakeholder accountable for the outcomes of one value
  stream — close to the SAFe Business Owner. Steers the Epic backlog of that
  stream.
- **Goals:** A funded, prioritised Epic backlog for her value stream; Epics that
  move through QS with evidence.
- **How they use Pulse:** `/capacity` and the value-stream views; creates and
  edits Epics under her stream and submits them to QS.
- **Permissions & scope:** `value_stream.update`, `epic.create/update`,
  `epic.review.submit` — all **value_stream-scoped** to her own stream.
  **Scope: value streams.** (See `role-function-matrix.md` for the known
  `epic.update` scope-degradation note.)

## Erik — Epic Owner

- **RBAC role:** `epic_owner`
- **Context:** Drives a specific Epic end-to-end on the content side —
  formulates the business case and benefit hypothesis, shepherds it through QS.
- **Goals:** A well-formed Epic that clears QS; clear hand-off into delivery.
- **How they use Pulse:** `/portfolio/epics/[id]` (overview, Business Case,
  Benefit Hypothesis); submits the Epic for review.
- **Permissions & scope:** `epic.create`, `epic.update`, `epic.review.submit`.
  Submits to QS but does **not** decide it (separation of duties).
  **Scope: portfolio-wide** read; Epic-level ownership.

## Vera — Value Management Office

- **RBAC role:** `vmo`
- **Context:** The Value Management Office — governs the Epic investment funnel
  and runs Epic quality assurance.
- **Goals:** Only well-formed, evidenced Epics pass QS; the stage-gate funnel
  reflects real investment decisions.
- **How they use Pulse:** `/quality/epics` (VMO dashboard — review Epics
  `in_review`, approve or return); reviews Business Case and Benefit Hypothesis
  read-only on the Epic detail page.
- **Permissions & scope:** `epic.review.decide` (QS gate) and `epic.approve`
  (stage gates L0–L5, together with `portfolio_manager`). **Scope:
  portfolio-wide.**

## Anna — Release Train Engineer

- **RBAC role:** `rte`
- **Context:** The RTE — orchestrates one Agile Release Train, facilitates PI
  Planning and dependency management, and runs Feature QS.
- **Goals:** Smooth PI Planning; visible, unblocked cross-team dependencies;
  fast impediment escalation; a clean PI close.
- **How they use Pulse:** `/art/[id]`, the PI workspace (board, objectives,
  dependencies), `/quality/features` (Feature QS).
- **Permissions & scope:** Full `pi.*`, `pi_objective.create/update`,
  `team.update`, full `feature.*` (incl. `delete` and `review.decide`),
  `story`/`task` (ART-scoped), `dependency.link/unlink`, all `impediment.*`.
  **Scope: ARTs** assigned to her. ART lifecycle (`art.*`) stays with
  `tenant_admin`.

## Sven — Product Manager

- **RBAC role:** `feature_owner`
- **Context:** Owns the Feature backlog for an ART — turns Epics into Features,
  scores them, defines acceptance criteria.
- **Goals:** A WSJF-ranked Feature backlog that reflects real value; Features
  ready before PI Planning.
- **How they use Pulse:** `/feature/[id]`, `/art/[id]/features` (WSJF scoring,
  create Features, submit Features to QS).
- **Permissions & scope:** `feature.create/update/wsjf.set`,
  `feature.review.submit`, `story`/`task` (ART-scoped), `dependency.link/unlink`,
  `impediment.create`. **Not** `feature.delete` or `feature.review.decide` (the
  RTE decides). **Scope: ARTs** assigned to him.

## Tom — Scrum Master

- **RBAC role:** `team_editor`
- **Context:** Coaches one Agile team, runs its events, clears its path. The
  Product Owner holds the **same** `team_editor` role.
- **Goals:** A healthy team backlog and sprint flow; impediments raised and
  resolved fast; honest PI Objectives.
- **How they use Pulse:** `/team/[id]` backlog, `/sprint/[id]` board, PI
  Objectives, impediments.
- **Permissions & scope:** `story.create/update/delete`, `task.create/edit`,
  `pi_objective.create/update`, `dependency.link/unlink` (team-scoped), all
  `impediment.*`. **Scope: teams** assigned to him.

## Jonas — Tech Lead

- **RBAC role:** `story_owner`
- **Context:** A senior developer who owns specific Stories end-to-end — breaks
  them into Tasks, drives them to done.
- **Goals:** Own delivery of his Stories without friction; split work cleanly;
  flag blockers early.
- **How they use Pulse:** `/team/[id]` backlog and `/sprint/[id]` board for the
  Stories he owns.
- **Permissions & scope:** `story.create/update/delete`, `task.create/edit`,
  `impediment.create` (but **not** escalate/resolve, and no `pi_objective` or
  `dependency` rights). **Scope: team-level** read, Story-level ownership.

## Daniel — Developer

- **RBAC role:** `task_owner`
- **Context:** An Agile Team Member. Lives in the daily standup view — picks up
  Tasks and reports progress. The highest-frequency user.
- **Goals:** See his Tasks at a glance; update status in seconds; raise a
  blocker without ceremony.
- **How they use Pulse:** `/sprint/[id]` board for his own team.
- **Permissions & scope:** `task.edit` **on his own Tasks only** (`scope: "own"`)
  and `impediment.create`. **Scope: own** assigned items.

## Mara — Stakeholder

- **RBAC role:** `viewer`
- **Context:** A business or architecture stakeholder accountable for outcomes —
  joins PI Planning and portfolio reviews, but does not operate the tooling.
- **Goals:** A trustworthy view of portfolio health and PI progress; a single
  source of truth instead of hand-assembled status reports.
- **How they use Pulse:** Read-only across `/portfolio`, the reporting
  dashboards and PI Objectives.
- **Permissions & scope:** **Read-only** — appears in no policy grant.
  **Scope: tenant-wide read**, enforced by RLS.
