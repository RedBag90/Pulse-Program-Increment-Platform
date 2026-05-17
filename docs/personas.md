# Pulse — User Personas

One persona per RBAC role. This document complements the technical concept: §3.1 lists
9 SAFe personas, but the role model in §7.1 (`src/domain/roles.ts`) has **11 roles**.
Below, every role gets exactly one persona — the §3.1 names are reused where they map,
and three personas are added for the roles §3.1 never covered (`platform_admin`,
`tenant_admin`, `story_owner`).

Permissions are cross-checked against the live policy registry
(`src/server/auth/policies/index.ts`), not just the §7.2 matrix. Three roles —
`architect_viewer`, `art_arch_viewer`, `portfolio_viewer` — appear in **no grant**:
they are pure read-only roles, scoped by Row-Level Security.

## Summary

| RBAC role          | Persona                         | In one line                                           |
| ------------------ | ------------------------------- | ----------------------------------------------------- |
| `platform_admin`   | Raffi — Platform Operator       | Runs the Pulse platform across all tenants            |
| `tenant_admin`     | Nadia — Workspace Administrator | Owns one tenant: users, roles, ARTs, integrations     |
| `portfolio_editor` | Priya — Portfolio Lead          | Manages the portfolio backlog and funds value streams |
| `architect_viewer` | Marcus — Enterprise Architect   | Reads across the portfolio to steer Enabler strategy  |
| `art_full_editor`  | Anna — Release Train Engineer   | Orchestrates an ART and runs PI Planning              |
| `feature_editor`   | Sven — Product Manager          | Owns the Feature backlog and WSJF scoring             |
| `art_arch_viewer`  | Lea — System Architect          | Reviews an ART's feature and dependency landscape     |
| `team_editor`      | Tom — Scrum Master              | Runs a team's sprints, stories and impediments        |
| `story_owner`      | Jonas — Tech Lead               | Owns specific Stories end-to-end                      |
| `task_owner`       | Daniel — Developer              | Picks up Tasks and reports progress                   |
| `portfolio_viewer` | Bea — Business Owner            | Watches portfolio health and PI outcomes              |

---

## Raffi — Platform Operator

- **RBAC role:** `platform_admin`
- **Context:** Works for the Pulse vendor, not for any customer. Operates the platform
  itself — provisions tenants, watches error and performance telemetry, keeps the
  background jobs healthy. The only role that is not a SAFe role.
- **Goals:** Onboard new customer tenants quickly; keep the platform healthy and
  observable; resolve incidents before customers notice.
- **Pain points:** Tenant data bleeding across boundaries; silent background-job
  failures; no end-to-end trace when something breaks.
- **How they use Pulse:** Tenant provisioning and cross-tenant operations; monitors
  Sentry and the outbox/cron processor. Rarely touches day-to-day SAFe screens.
- **Permissions & scope:** Allowed every action (handled directly in `authorize()`);
  the only role that may `tenant.create`. **Scope: cross-tenant** — not bound to a
  single tenant.

## Nadia — Workspace Administrator

- **RBAC role:** `tenant_admin`
- **Context:** The customer-side owner of one Pulse tenant — typically an
  Agile/Transformation Office lead. Sets up the organisation in Pulse and keeps access
  correct.
- **Goals:** Get the right people the right access; stand up ARTs and teams; connect
  Jira/Azure DevOps; satisfy audit and compliance asks.
- **Pain points:** Manual, error-prone user administration; no audit trail for "who
  changed access"; integration setup that needs an engineer.
- **How they use Pulse:** `/admin/users` (invite users, assign roles and visibility
  scopes), `/admin/integrations`, `/admin/audit-log`; creates ARTs and teams under
  `/art`.
- **Permissions & scope:** `tenant.users.manage`, `integration.manage`, full ART and
  team lifecycle, audit-log and user-list reads. Effectively a tenant-wide super-user —
  `authorize()` allows `tenant_admin` every action **within their tenant**.
  **Scope: the whole tenant.**

## Priya — Portfolio Lead

- **RBAC role:** `portfolio_editor`
- **Context:** Lean Portfolio Management / Epic Owner. Owns the portfolio backlog and
  decides where investment goes.
- **Goals:** Keep a clear, prioritised Epic backlog; fund value streams deliberately;
  move Epics through their stage gates with evidence.
- **Pain points:** Epics with no link to delivery reality; prioritisation by opinion
  rather than data; slow approvals.
- **How they use Pulse:** `/portfolio` overview, `/portfolio/epics` (Portfolio Kanban,
  create/approve Epics), `/portfolio/value-streams`; reviews Features and dependencies
  across ARTs.
- **Permissions & scope:** `value_stream.create/update`, full `epic.*` including
  `approve` and `delete`, full `feature.*`, `story`/`task` actions (ART-scoped),
  `dependency.link/unlink`, all `impediment.*`. **Scope: value streams** (empty = whole
  tenant); reads everything.

## Marcus — Enterprise Architect

- **RBAC role:** `architect_viewer`
- **Context:** Sets technical direction across the portfolio and champions Enabler
  Epics. Influences strategy through the portfolio process — in Pulse he is an
  observer, not an editor.
- **Goals:** See the whole technical landscape; spot architectural risk early; make
  sure Enabler work is visible alongside business Epics.
- **Pain points:** Architecture decisions invisible to delivery teams; no
  cross-portfolio view of technical dependencies.
- **How they use Pulse:** Read-only across `/portfolio`, `/feature`, and PI dependency
  maps. Epic creation itself is done by Priya (`portfolio_editor`).
- **Permissions & scope:** **Read-only** — appears in no policy grant. **Scope:
  portfolio-wide read**, enforced by RLS.

## Anna — Release Train Engineer

- **RBAC role:** `art_full_editor`
- **Context:** The RTE — orchestrates one Agile Release Train and facilitates PI
  Planning, dependency management and Inspect & Adapt.
- **Goals:** Run smooth PI Planning; keep cross-team dependencies visible and
  unblocked; escalate impediments fast; track the PI to a clean close.
- **Pain points:** Dependencies discovered too late; PI scope drifting silently;
  impediments with nowhere to go.
- **How they use Pulse:** `/art/[id]` overview, `/pi` and the PI workspace
  (`/pi/[id]` overview, Program Board, Objectives, Dependencies), `/art/[id]/velocity`
  and `/impediments`. Creates PIs, assigns Features, starts/completes/deletes PIs.
- **Permissions & scope:** Full `pi.*` (create/update/start/complete/delete), full
  `feature.*`, `pi_objective.create/update`, `team.update`, `story`/`task` (ART-scoped),
  `dependency.link/unlink`, all `impediment.*`. **Scope: ARTs** assigned to her.

## Sven — Product Manager

- **RBAC role:** `feature_editor`
- **Context:** Owns the Feature backlog for an ART — turns Epics into Features, scores
  them, defines acceptance criteria.
- **Goals:** A WSJF-ranked Feature backlog that reflects real value; crisp acceptance
  criteria; Features ready before PI Planning.
- **Pain points:** Prioritisation arguments without data; acceptance criteria lost
  between tools.
- **How they use Pulse:** `/feature` and `/feature/[id]`, `/art/[id]/features`
  (WSJF scoring, create Features, assign Features to a PI).
- **Permissions & scope:** `feature.create/update/wsjf.set` (but **not**
  `feature.delete`), `story`/`task` actions (ART-scoped), `dependency.link/unlink`.
  Cannot run PI lifecycle actions or create Epics. **Scope: ARTs** assigned to him.

## Lea — System Architect

- **RBAC role:** `art_arch_viewer`
- **Context:** Owns the technical design for an ART — NFRs, interfaces, technical
  enablers. Authors those in design docs; uses Pulse to keep design aligned with the
  Feature and dependency reality.
- **Goals:** Understand how Features depend on each other; catch cross-team interface
  risk; keep technical enablers on the radar.
- **Pain points:** Dependency knowledge trapped in people's heads; architecture drift
  between design and delivery.
- **How they use Pulse:** Read-only review of `/feature`, `/feature/[id]` and the PI
  Dependencies map.
- **Permissions & scope:** **Read-only** — appears in no policy grant. **Scope:
  ART-level read**, enforced by RLS.

## Tom — Scrum Master

- **RBAC role:** `team_editor`
- **Context:** Coaches one Agile team, runs its events, and clears its path. The
  Product Owner (Julia, §3.1) holds the **same** `team_editor` role and shares this
  persona's capabilities from the backlog-ownership angle.
- **Goals:** A healthy team backlog and sprint flow; impediments raised and resolved
  fast; honest PI Objectives.
- **Pain points:** Stale backlogs; impediments that stall; sprint boards that don't
  reflect reality.
- **How they use Pulse:** `/team/[id]` backlog, `/sprint` and `/sprint/[id]` (board +
  burndown), PI Objectives, `/impediments`.
- **Permissions & scope:** `story.create/update/delete`, `task.create/edit`,
  `pi_objective.create/update`, `dependency.link/unlink` (team-scoped), all
  `impediment.*`. **Scope: teams** assigned to him.

## Jonas — Tech Lead

- **RBAC role:** `story_owner`
- **Context:** A senior developer who owns specific Stories end-to-end — breaks them
  into Tasks, drives them to done, but does not run the whole team.
- **Goals:** Own delivery of his Stories without friction; split work into Tasks
  cleanly; flag blockers early.
- **Pain points:** Unclear ownership of in-flight Stories; blockers with no escalation
  path.
- **How they use Pulse:** `/team/[id]` backlog and `/sprint/[id]` board for the Stories
  he owns; creates and updates Stories and their Tasks.
- **Permissions & scope:** `story.create/update/delete`, `task.create/edit`,
  `impediment.create` (but **not** escalate/resolve, and no `pi_objective` or
  `dependency` rights). **Scope: team-level read**, Story-level ownership.

## Daniel — Developer

- **RBAC role:** `task_owner`
- **Context:** An Agile Team Member. Lives in the daily standup view — picks up Tasks
  and reports progress. The highest-frequency user (§3.2).
- **Goals:** See his Tasks at a glance; update status in seconds; raise a blocker
  without ceremony.
- **Pain points:** Heavyweight tools for a simple status update; no quick way to flag
  a blocker.
- **How they use Pulse:** `/sprint/[id]` board for his own team; updates his Tasks;
  raises impediments.
- **Permissions & scope:** `task.edit` **on his own Tasks only** (`scope: "own"`) and
  `impediment.create`. Cannot create Stories/Tasks or edit others' work. **Scope: own**
  assigned items.

## Bea — Business Owner

- **RBAC role:** `portfolio_viewer`
- **Context:** A business stakeholder accountable for outcomes. Joins PI Planning to
  set business value and review objectives, but does not operate the tooling.
- **Goals:** A trustworthy view of portfolio health; confidence that PI Objectives
  reflect business priorities.
- **Pain points:** Status reports assembled by hand; no single source of truth for
  progress.
- **How they use Pulse:** Read-only `/portfolio` health dashboards and PI Objectives.
  Business-owner approval happens in the PI Planning ceremony and is recorded by the
  RTE and teams.
- **Permissions & scope:** **Read-only** — appears in no policy grant. **Scope:
  aggregated portfolio read**, enforced by RLS.
