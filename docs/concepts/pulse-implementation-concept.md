# Pulse — Implementation Concept

## Ready-for-Implementation Specification

> **Status:** Ready for Implementation
> **Author:** Engineering Lead
> **Last Updated:** 2026-05-16
> **Prerequisites:** Repository scaffolded, Supabase project provisioned, Vercel project linked, all 14 ADRs ratified
> **Related:** [Technical Concept](./pulse-technical-concept.md), [Architecture Decision Records](./adr/)

---

## Table of Contents

1. [Implementation Strategy](#1-implementation-strategy)
2. [Module Structure](#2-module-structure)
3. [Feature Catalog](#3-feature-catalog)
4. [User Stories per Feature](#4-user-stories-per-feature)
5. [Implementation Roadmap](#5-implementation-roadmap)
6. [Definition of Ready / Done](#6-definition-of-ready--done)
7. [Cross-Cutting Implementation Concerns](#7-cross-cutting-implementation-concerns)
8. [Sprint 0 Checklist](#8-sprint-0-checklist)
9. [Appendix](#9-appendix)

---

## 1. Implementation Strategy

### 1.1 Approach

We implement Pulse using **vertical slices** rather than horizontal layers. Each slice delivers an end-to-end working feature (UI → API → Database) for one user persona. This produces demoable progress every sprint and surfaces integration issues early.

**Order of slices is driven by dependency, not user value:**

1. **Foundation** (tenants, auth, RLS, audit log) — nothing else works without this
2. **Read paths first, write paths second** — users seeing data is the first proof of value
3. **One persona at a time** — Story Owner (PO) is the highest-leverage persona; build their journey first
4. **Defer integrations** — Jira/ADO sync only after the core domain is stable

### 1.2 Slicing Principles

| Principle                                | Application                                                                            |
| ---------------------------------------- | -------------------------------------------------------------------------------------- |
| **Walking skeleton first**               | Sprint 1 delivers tenant creation + login + empty Portfolio view, end-to-end           |
| **Backend leads frontend by one sprint** | API + tests ship one sprint before the UI consumes them                                |
| **One feature, one PR**                  | No multi-feature PRs. Each PR maps to exactly one story.                               |
| **Feature flags from day one**           | All new features gated behind `feature-flag.ts` constants; flags removable after pilot |
| **Migrations are PRs**                   | Every schema change is a Prisma migration PR with rollback documented                  |

### 1.3 Branch & PR Strategy

```
main              ← protected, always deployable, auto-deploys to staging
└── feat/<story-id>-<slug>     ← short-lived feature branches
    └── PR → main (squash merge)
```

- Branch naming: `feat/PULSE-123-create-epic`, `fix/PULSE-456-rls-leak`, `chore/PULSE-789-upgrade-prisma`
- PRs require: 1 reviewer approval, all CI checks green, test coverage not decreased
- Commits follow [Conventional Commits](https://www.conventionalcommits.org/): `feat(portfolio): add epic creation form`

### 1.4 Story Sizing

Stories are sized in **story points** using a modified Fibonacci scale:

| Points | Effort     | Example                                  |
| ------ | ---------- | ---------------------------------------- |
| 1      | < 2 hours  | Add a field to an existing form          |
| 2      | Half a day | Create a new utility function with tests |
| 3      | 1 day      | New API endpoint with tests              |
| 5      | 2-3 days   | New page with multiple components        |
| 8      | 1 week     | New feature module (small)               |
| 13     | 2 weeks    | Cross-cutting work (e.g., RLS setup)     |

> Stories sized 13+ MUST be broken down before sprint planning. No exceptions.

---

## 2. Module Structure

### 2.1 Top-Level Layout

```
pulse/
├── docs/
│   ├── adr/                                  Architecture Decision Records
│   ├── concepts/                             Technical concept, this document
│   ├── runbooks/                             Operational guides
│   └── api/                                  Generated OpenAPI spec
├── messages/
│   ├── de.json
│   └── en.json
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── src/
│   ├── app/                                  Next.js App Router
│   ├── components/                           Shared UI primitives
│   ├── features/                             Feature modules (see 2.3)
│   ├── domain/                               Pure domain logic
│   ├── server/                               Server-only code
│   ├── generated/                            Generated code (Prisma, OpenAPI)
│   ├── i18n/                                 next-intl configuration
│   ├── lib/                                  Client-safe shared utilities
│   ├── test/                                 Test infrastructure
│   └── middleware.ts
├── tests/
│   └── e2e/                                  Playwright specs
├── .github/workflows/
└── (config files)
```

### 2.2 The Four-Layer Pattern

Every feature follows the same four layers:

```
┌──────────────────────────────────────────────────────────┐
│  UI Layer (features/<area>/components/, app/[locale]/)   │
│  - React components (Server + Client)                    │
│  - Forms, tables, dashboards                             │
│  - Permission gates                                      │
└────────────────────────┬─────────────────────────────────┘
                         │
┌────────────────────────▼─────────────────────────────────┐
│  Hooks Layer (features/<area>/hooks/)                    │
│  - TanStack Query hooks (useEpics, useFeature)           │
│  - Mutation hooks (useCreateFeature)                     │
│  - UI state hooks (useFilterState)                       │
└────────────────────────┬─────────────────────────────────┘
                         │
┌────────────────────────▼─────────────────────────────────┐
│  Service Layer (server/services/)                        │
│  - Business logic (initiativeService.create)             │
│  - Cross-aggregate orchestration                         │
│  - Domain event emission                                 │
│  - PURE TYPESCRIPT, NO HTTP                              │
└────────────────────────┬─────────────────────────────────┘
                         │
┌────────────────────────▼─────────────────────────────────┐
│  Repository Layer (server/repositories/)                 │
│  - Prisma queries                                        │
│  - Database transactions                                 │
│  - NO BUSINESS LOGIC                                     │
└──────────────────────────────────────────────────────────┘
```

**Hard rules:**

- UI layer NEVER imports from `server/`
- Server services NEVER import from `app/` or `features/`
- Domain layer (`src/domain/`) NEVER imports from anywhere except itself
- Repository layer only contains Prisma operations; business logic is rejected in code review

### 2.3 Feature Module Anatomy

Each feature in `src/features/<area>/` follows a canonical structure:

```
features/portfolio/
├── components/
│   ├── epic-kanban.tsx              Server Component
│   ├── epic-card.tsx                Server Component
│   ├── create-epic-form.tsx         Client Component
│   ├── create-epic-dialog.tsx       Client Component
│   └── __tests__/
│       └── create-epic-form.test.tsx
├── hooks/
│   ├── use-epics.ts                 TanStack Query
│   ├── use-create-epic.ts           Mutation
│   └── use-epic-filters.ts          UI state
├── actions/                          Server Actions
│   ├── create-epic.ts
│   ├── update-epic.ts
│   └── advance-stage-gate.ts
├── lib/                              Feature-local utilities
│   └── format-epic-id.ts
├── types.ts                          Feature-local types
└── index.ts                          PUBLIC API (only export what's needed)
```

**Conventions:**

- `index.ts` is the feature's public API. Components and hooks not exported from `index.ts` are private to the feature.
- Tests live next to the file they test in `__tests__/` directories.
- Server Actions live in `actions/`, NOT in `components/`.
- Cross-feature dependencies route through `index.ts`. Direct imports from internal files of another feature are forbidden (enforced via ESLint).

### 2.4 Module Boundaries

ESLint enforces these boundaries via `eslint-plugin-boundaries`:

```javascript
// .eslintrc.js (excerpt)
{
  'boundaries/elements': [
    { type: 'app',        pattern: 'src/app/**' },
    { type: 'features',   pattern: 'src/features/*' },
    { type: 'server',     pattern: 'src/server/**' },
    { type: 'domain',     pattern: 'src/domain/**' },
    { type: 'components', pattern: 'src/components/**' },
    { type: 'lib',        pattern: 'src/lib/**' },
  ],
  'boundaries/rules': [
    { from: 'features',   allow: ['features', 'components', 'lib', 'domain'] },
    { from: 'server',     allow: ['server', 'domain', 'lib'] },
    { from: 'domain',     allow: ['domain'] },
    { from: 'components', allow: ['components', 'lib'] },
    { from: 'app',        allow: ['app', 'features', 'components', 'server', 'lib'] },
  ],
}
```

---

## 3. Feature Catalog

Pulse consists of **9 feature modules**. Each is sized for delivery within 1-3 sprints.

| #   | Feature                        | Module                           | Sprint Allocation | Dependencies |
| --- | ------------------------------ | -------------------------------- | ----------------- | ------------ |
| F1  | **Foundation**                 | `features/auth/`, `server/auth/` | Sprint 1-2        | —            |
| F2  | **Tenant & User Management**   | `features/admin/`                | Sprint 2-3        | F1           |
| F3  | **Portfolio Management**       | `features/portfolio/`            | Sprint 3-5        | F1, F2       |
| F4  | **ART & Feature Management**   | `features/art/`                  | Sprint 5-7        | F3           |
| F5  | **Program Increment Planning** | `features/pi/`                   | Sprint 7-9        | F4           |
| F6  | **Team & Sprint Backlog**      | `features/team/`                 | Sprint 9-11       | F4, F5       |
| F7  | **Dependencies & Impediments** | `features/dependencies/`         | Sprint 11-12      | F4, F6       |
| F8  | **Reporting & Dashboards**     | `features/reporting/`            | Sprint 12-13      | F3-F6        |
| F9  | **Integrations**               | `features/integrations/`         | Sprint 13-15      | F4, F6       |

### 3.1 F1 — Foundation

**Goal:** Walking skeleton. A user can sign up, log in, see an empty dashboard, and log out. All cross-cutting infrastructure (auth, RLS, audit, i18n) works.

**Scope:**

- Supabase Auth integration via `@supabase/ssr`
- Middleware for session refresh + locale detection
- RLS policies on all tenant-scoped tables
- Audit event infrastructure
- i18n setup (DE + EN) with locale switcher
- Error boundary infrastructure
- Sentry integration

**Out of scope:**

- Role assignments (in F2)
- Any business features (in F3+)

### 3.2 F2 — Tenant & User Management

**Goal:** A Tenant Admin can invite users, assign roles, and view the audit log.

**Scope:**

- Tenant Admin dashboard
- User invitation flow (email via Resend)
- Role assignment UI (per-user, per-tenant)
- Visibility scope editor (value streams, ARTs, teams)
- Audit log viewer

**Out of scope:**

- Self-service tenant signup (post-pilot)
- Billing (post-GA)

### 3.3 F3 — Portfolio Management

**Goal:** Portfolio Editor can manage Value Streams, create and approve Epics, view the Portfolio Kanban.

**Scope:**

- Value Stream CRUD
- Epic CRUD with Lean Business Case
- Portfolio Kanban board (drag-drop between stage gates)
- Epic detail page
- Epic approval workflow (L0 → L5)

**Out of scope:**

- WSJF on Epics (open question)
- Capabilities / Solution Trains (deferred to v2)

### 3.4 F4 — ART & Feature Management

**Goal:** Product Manager and RTE can manage ARTs, create Features, score WSJF, link to Epics.

**Scope:**

- ART CRUD
- Feature CRUD (always child of an Epic)
- WSJF scoring UI (4-input form, server-computed result)
- Feature backlog sorted by WSJF
- Feature acceptance criteria editor

**Out of scope:**

- PI assignment (in F5)
- Sprint scheduling (in F6)

### 3.5 F5 — Program Increment Planning

**Goal:** RTE can create PIs, assign Features to PIs, run PI Planning.

**Scope:**

- Program Increment CRUD
- Sprint scheduling within PIs (auto-generated by cadence)
- PI Planning view (Features × Teams matrix)
- PI start/complete workflow
- PI Objectives capture

**Out of scope:**

- Real-time collaborative editing (deferred)
- Miro/Mural embed (deferred to F9)

### 3.6 F6 — Team & Sprint Backlog

**Goal:** Product Owner manages Stories. Developer picks up Tasks. Scrum Master coaches.

**Scope:**

- Story CRUD (always child of a Feature, in a PI, in a Sprint)
- Story point estimation
- Task CRUD (always child of a Story)
- Sprint board (Kanban view per team)
- Story acceptance criteria editor

**Out of scope:**

- Burn-down charts (in F8)

### 3.7 F7 — Dependencies & Impediments

**Goal:** Cross-team coordination via typed relationships.

**Scope:**

- Link initiatives via dependency types (`blocks`, `depends_on`, `relates_to`)
- Dependency graph visualization
- Cycle detection
- Impediment creation and escalation
- Impediment resolution workflow

**Out of scope:**

- Auto-suggestion of dependencies (post-pilot)

### 3.8 F8 — Reporting & Dashboards

**Goal:** All personas see relevant metrics at a glance.

**Scope:**

- Portfolio health dashboard (Epic progress, value stream funding)
- PI velocity dashboard
- WSJF leaderboard
- Burn-down / burn-up per Sprint
- Dependency graph (read-only)
- Audit log query interface

**Out of scope:**

- Custom dashboards (post-GA)
- Export to PDF/CSV (post-pilot)

### 3.9 F9 — Integrations

**Goal:** Bidirectional sync with Jira/ADO so engineers stay in their tools.

**Scope:**

- Jira Cloud integration (OAuth, webhook, REST sync)
- Azure DevOps integration (OAuth, Service Hooks, REST sync)
- Outbox processor (Vercel Cron, nightly)
- Webhook signature verification (HMAC)
- Per-tenant integration config UI

**Out of scope:**

- GitLab (post-GA)
- Slack/Teams notifications (post-pilot enhancement)
- Miro embed (post-pilot)

---

## 4. User Stories per Feature

Each story follows the format:

```
PULSE-<NN> — <verb> <subject>
As a <persona>, I want to <action>, so that <outcome>.

Acceptance Criteria:
- Given/When/Then statements
- Edge cases
- Non-functional requirements

Estimate: <points>
Dependencies: <story IDs or "none">
Module: <feature module>
```

### 4.1 F1 — Foundation

#### PULSE-01 — Set up project scaffolding

**As an** Engineering Lead,
**I want** the Next.js 15 project initialized with the agreed stack,
**so that** the team can start delivering features.

**Acceptance Criteria:**

- `pnpm create next-app@latest` with App Router, TypeScript, Tailwind
- All ratified dependencies installed (see ADR-0001 through ADR-0014)
- `pnpm typecheck`, `pnpm lint`, `pnpm test` all run successfully on empty scaffold
- `.env.example` documents all required environment variables
- README documents local development setup
- Pre-commit hooks via Husky (typecheck, lint, format)

**Estimate:** 3
**Dependencies:** none
**Module:** root

#### PULSE-02 — Configure Supabase project

**As an** Engineering Lead,
**I want** a Supabase project provisioned with Prisma connection,
**so that** the team can start defining the data model.

**Acceptance Criteria:**

- Supabase project created in EU region
- `DATABASE_URL` and `DIRECT_URL` set in `.env.local` and Vercel
- Prisma schema initial migration applied
- Connection pooling configured (`?pgbouncer=true&connection_limit=1` for serverless)
- Local development uses Supabase CLI (`supabase start`)

**Estimate:** 3
**Dependencies:** PULSE-01
**Module:** root

#### PULSE-03 — Implement Supabase Auth middleware

**As a** User,
**I want** my session to be refreshed automatically,
**so that** I don't get logged out unexpectedly.

**Acceptance Criteria:**

- `src/middleware.ts` refreshes Supabase session cookie on every request
- Edge runtime configured
- Matcher excludes static assets
- Authenticated users redirect from `/sign-in` to `/portfolio`
- Unauthenticated users redirect from `/portfolio` to `/sign-in`
- Trace ID set on every request via Sentry

**Estimate:** 5
**Dependencies:** PULSE-02
**Module:** `src/middleware.ts`, `src/server/auth/`

#### PULSE-04 — Build sign-in and sign-up pages

**As a** new user,
**I want** to sign up and log in,
**so that** I can access the platform.

**Acceptance Criteria:**

- `/sign-in` page with email + password form (`react-hook-form` + Zod)
- `/sign-up` page with same fields plus tenant code
- "Forgot password" flow with email link via Supabase
- OIDC providers (Google, Microsoft) as optional buttons
- Form validation errors localized (DE + EN)
- Successful login redirects to `/portfolio`
- E2E test covers happy path

**Estimate:** 5
**Dependencies:** PULSE-03
**Module:** `features/auth/`

#### PULSE-05 — Set up i18n with next-intl

**As a** User,
**I want** the UI in my language,
**so that** I can use Pulse comfortably.

**Acceptance Criteria:**

- `[locale]` route segment configured
- DE and EN messages files seeded with auth strings
- Locale detection from cookie / Accept-Language header
- Locale switcher in app shell
- All user-facing strings in messages files (no inline literals)
- ESLint rule blocks raw strings in JSX

**Estimate:** 5
**Dependencies:** PULSE-01
**Module:** `src/i18n/`, `messages/`

#### PULSE-06 — Implement RLS policies for tenant isolation

**As a** Platform operator,
**I want** strict tenant isolation at the database layer,
**so that** no application bug can leak data across tenants.

**Acceptance Criteria:**

- RLS enabled on all tenant-scoped tables (`initiatives`, `dependencies`, `audit_events`, `program_increments`, `arts`, `value_streams`, `user_role_assignments`)
- Policies use `auth.jwt() ->> 'tenant_id'` for tenant scoping
- Integration tests verify cross-tenant queries return zero rows
- Prisma client uses per-request connection with JWT claim injection
- Documentation in `docs/runbooks/rls.md`

**Estimate:** 13 → break into:

- PULSE-06a: Implement Prisma RLS-aware client (5)
- PULSE-06b: Write RLS policies for core tables (5)
- PULSE-06c: Integration tests for cross-tenant isolation (3)

**Dependencies:** PULSE-02
**Module:** `src/server/db/`, `prisma/migrations/`

#### PULSE-07 — Implement audit event infrastructure

**As a** Compliance officer,
**I want** every mutation logged in an immutable audit trail,
**so that** we can satisfy SOC 2 requirements.

**Acceptance Criteria:**

- `audit_events` table created with RLS (INSERT + SELECT only, no UPDATE/DELETE)
- `emitAuditEvent()` helper writes within the same transaction as the mutation
- Every Server Action and Route Handler emits audit events
- Audit events include actor, action, resource, JSON Patch of changes, IP, user agent, trace ID
- Audit log viewer page for Tenant Admins
- ESLint rule warns on mutations without `emitAuditEvent` call (best-effort)

**Estimate:** 8
**Dependencies:** PULSE-06
**Module:** `src/server/audit/`

#### PULSE-08 — Set up Sentry error tracking

**As a** Developer,
**I want** production errors to surface immediately with context,
**so that** I can fix issues before customers report them.

**Acceptance Criteria:**

- Sentry SDK installed for Next.js (server + client + edge)
- Source maps uploaded on build
- W3C trace context propagated end-to-end
- Sentry DSN configured per environment
- Test event fires from staging on first deploy
- PII scrubbing configured (no emails, no tokens in event payloads)

**Estimate:** 3
**Dependencies:** PULSE-01
**Module:** root, `sentry.*.config.ts`

#### PULSE-09 — Configure error boundaries

**As a** User,
**I want** a clean error page when something breaks,
**so that** I don't see a blank white screen.

**Acceptance Criteria:**

- Root `error.tsx` in `app/[locale]/` for top-level errors
- Feature-level error boundaries in each `(dashboard)` route group
- React 19 `onUncaughtError` and `onCaughtError` hooks wired to Sentry
- 404 `not-found.tsx` page with localized strings
- Errors include trace ID for support

**Estimate:** 3
**Dependencies:** PULSE-08
**Module:** `src/app/[locale]/`

#### PULSE-10 — Set up CI pipeline

**As an** Engineering Lead,
**I want** every PR gated by automated checks,
**so that** main is always deployable.

**Acceptance Criteria:**

- GitHub Actions workflow `ci.yml` runs on every PR
- Steps: install (pnpm with cache), typecheck, lint, unit tests, integration tests, build
- `npm audit --audit-level=high` blocks PRs with vulnerabilities
- E2E tests run against Vercel preview deployment
- Coverage report posted to PR as comment
- All checks required for merge

**Estimate:** 5
**Dependencies:** PULSE-01
**Module:** `.github/workflows/`

### 4.2 F2 — Tenant & User Management

#### PULSE-11 — Implement tenant model and provisioning

**As a** Platform operator,
**I want** to provision new tenants,
**so that** customers can be onboarded.

**Acceptance Criteria:**

- `Tenant` model in Prisma with region selection (EU/US/APAC)
- Admin-only API endpoint `POST /api/v1/admin/tenants` (initially Platform Admin only)
- Tenant creation seeds default roles for the inviting user
- E2E test covers tenant creation flow

**Estimate:** 5
**Dependencies:** PULSE-06
**Module:** `features/admin/`, `server/services/tenant.ts`

#### PULSE-12 — Build user invitation flow

**As a** Tenant Admin,
**I want** to invite new users to my tenant,
**so that** my team can use Pulse.

**Acceptance Criteria:**

- `/admin/users` page lists tenant users
- "Invite user" form captures email, role, visibility scope
- Invitation email sent via Resend (localized DE/EN)
- Invitation link contains signed JWT, expires after 7 days
- Accepting the invitation creates user + role assignment
- E2E test covers invite → accept → first login

**Estimate:** 8
**Dependencies:** PULSE-11
**Module:** `features/admin/`, `server/email/`

#### PULSE-13 — Build role assignment UI

**As a** Tenant Admin,
**I want** to assign roles to users,
**so that** they have the right permissions.

**Acceptance Criteria:**

- User detail page shows current role assignments
- Add role: choose from 10 SAFe roles
- Each role has its own visibility scope editor
- Removing a role requires confirmation
- All changes emit audit events
- Role changes invalidate the user's JWT claims (forced re-login or claim refresh)

**Estimate:** 5
**Dependencies:** PULSE-12
**Module:** `features/admin/`

#### PULSE-14 — Build visibility scope editor

**As a** Tenant Admin,
**I want** to scope a user's role to specific value streams / ARTs / teams,
**so that** they only see what's relevant.

**Acceptance Criteria:**

- Tree-style picker for value streams → ARTs → teams
- "All" toggle at each level
- Validation: cannot pick ARTs outside selected value streams
- Preview shows what the user will see after the change

**Estimate:** 5
**Dependencies:** PULSE-13
**Module:** `features/admin/`

#### PULSE-15 — Build audit log viewer

**As a** Tenant Admin,
**I want** to search the audit log,
**so that** I can investigate security questions.

**Acceptance Criteria:**

- `/admin/audit-log` page with filters: actor, action, resource type, date range
- Cursor-based pagination (50 rows per page)
- Each row expandable to show JSON Patch of changes
- Trace ID copyable for cross-reference with Sentry
- Permission gate: Tenant Admin only

**Estimate:** 5
**Dependencies:** PULSE-07, PULSE-13
**Module:** `features/admin/`

### 4.3 F3 — Portfolio Management

#### PULSE-16 — Implement Value Stream CRUD

**As a** Portfolio Editor,
**I want** to manage Value Streams,
**so that** my portfolio is organized.

**Acceptance Criteria:**

- `ValueStream` Prisma model with budget fields
- API endpoints: list, create, get, update, soft-delete
- UI: `/portfolio/value-streams` list page + create dialog
- Form validation via Zod (name unique per tenant)
- Soft-delete with 30-day recovery window
- Audit events emitted

**Estimate:** 8
**Dependencies:** PULSE-13
**Module:** `features/portfolio/`

#### PULSE-17 — Implement Epic CRUD

**As a** Portfolio Editor,
**I want** to create and edit Epics,
**so that** I can capture portfolio-level work.

**Acceptance Criteria:**

- `Initiative` with `level = 0` and `parentId = null`
- Required fields: title, description, owner, value stream, Lean Business Case
- API endpoints: list, create, get, update
- UI: Epic detail page with edit-in-place
- Hierarchy invariants enforced (no parent, value stream required)
- All 7 invariants from the Tech Concept verified in tests

**Estimate:** 8
**Dependencies:** PULSE-16
**Module:** `features/portfolio/`, `server/services/initiative.ts`

#### PULSE-18 — Build Portfolio Kanban board

**As a** Portfolio Editor,
**I want** to see Epics on a Kanban board grouped by stage gate,
**so that** I can see the portfolio at a glance.

**Acceptance Criteria:**

- Server Component renders Kanban for `/portfolio`
- Columns: Funnel, Reviewing, Analyzing, Portfolio Backlog, Implementing, Done
- Drag-and-drop in Client Component island advances stage gate
- WIP limits per column (configurable per tenant)
- Real-time updates via Supabase Realtime when others move cards
- Permission-gated: only Portfolio Editor can drag

**Estimate:** 13 → break into:

- PULSE-18a: Static Kanban Server Component (5)
- PULSE-18b: Drag-drop interactions (5)
- PULSE-18c: Realtime sync (3)

**Dependencies:** PULSE-17
**Module:** `features/portfolio/`

#### PULSE-19 — Build Lean Business Case editor

**As a** Portfolio Editor,
**I want** to capture a Lean Business Case on each Epic,
**so that** funding decisions are documented.

**Acceptance Criteria:**

- LBC fields: problem statement, customer value, cost estimate, ROI estimate, success criteria, risks
- Rich-text editor for problem statement and customer value
- LBC required before Epic can move past L1
- LBC versioned (each save creates a new version)

**Estimate:** 8
**Dependencies:** PULSE-17
**Module:** `features/portfolio/`

#### PULSE-20 — Implement Epic approval workflow

**As a** Portfolio Editor,
**I want** to approve Epics through stage gates,
**so that** governance is enforced.

**Acceptance Criteria:**

- Stage gates L0 → L5 with defined transitions
- Approval API: `POST /api/v1/initiatives/:id/transitions`
- Each transition records the approver, comment, timestamp
- Transitions emit audit events
- Email notification to owner on each transition

**Estimate:** 5
**Dependencies:** PULSE-17, PULSE-19
**Module:** `features/portfolio/`

### 4.4 F4 — ART & Feature Management

#### PULSE-21 — Implement ART CRUD

**As a** Tenant Admin,
**I want** to create and configure ARTs,
**so that** Features can be assigned to them.

**Acceptance Criteria:**

- `Art` Prisma model linked to Value Stream
- PI cadence configurable (8-12 weeks)
- API + UI for CRUD
- Audit events emitted

**Estimate:** 5
**Dependencies:** PULSE-16
**Module:** `features/art/`

#### PULSE-22 — Implement Feature CRUD with WSJF

**As a** Product Manager,
**I want** to create Features with WSJF scores,
**so that** my backlog is prioritized.

**Acceptance Criteria:**

- `Initiative` with `level = 1`, parent must be an Epic, requires ART + PI
- WSJF input form: 4 Fibonacci values
- Server computes WSJF score; client never sets `computed`
- Feature backlog sorted by WSJF descending
- Acceptance criteria as array of strings
- All level-1 invariants verified

**Estimate:** 8
**Dependencies:** PULSE-17, PULSE-21
**Module:** `features/art/`

#### PULSE-23 — Build WSJF leaderboard

**As a** Product Manager,
**I want** to see all Features ranked by WSJF,
**so that** I can prioritize the PI backlog.

**Acceptance Criteria:**

- `/art/:artId/features` page lists Features sorted by WSJF
- Filters: status, PI, owner
- Inline WSJF editing for Feature Editors
- Re-sort happens after WSJF change

**Estimate:** 5
**Dependencies:** PULSE-22
**Module:** `features/art/`

#### PULSE-24 — Build Feature detail page

**As a** Product Manager,
**I want** a detail page showing Feature context and children,
**so that** I have a full picture.

**Acceptance Criteria:**

- `/art/:artId/features/:featureId` page
- Shows parent Epic breadcrumb
- Lists child Stories with status
- WSJF breakdown shown
- Acceptance criteria editor
- Dependency section (read-only for now, edit in F7)
- Audit trail tab

**Estimate:** 8
**Dependencies:** PULSE-22
**Module:** `features/art/`

### 4.5 F5 — Program Increment Planning

#### PULSE-25 — Implement Program Increment CRUD

**As a** RTE,
**I want** to create PIs for my ART,
**so that** we have planning timeboxes.

**Acceptance Criteria:**

- `ProgramIncrement` Prisma model linked to ART
- Start/end dates validated (no overlap within ART)
- Status: planned → active → completed
- Only one PI per ART can be `active`
- API + UI for CRUD

**Estimate:** 5
**Dependencies:** PULSE-21
**Module:** `features/pi/`

#### PULSE-26 — Auto-generate Sprints from PI cadence

**As a** RTE,
**I want** Sprints created automatically when a PI is created,
**so that** I don't have to define them manually.

**Acceptance Criteria:**

- When a PI is created, Sprints are generated for each team in the ART
- Sprint count = PI duration / 2 weeks (rounded)
- Sprint dates calculated from PI start
- IP Sprint added as the last sprint
- Sprints visible in team views

**Estimate:** 5
**Dependencies:** PULSE-25
**Module:** `features/pi/`

#### PULSE-27 — Build Program Board

**As a** RTE,
**I want** a Program Board showing Features × Teams across Sprints,
**so that** I can visualize the PI Plan.

**Acceptance Criteria:**

- Matrix view: rows = teams, columns = sprints in the PI
- Features placed by team and target sprint
- Drag-drop to reassign team or sprint
- Color-coded by status
- Permission-gated: only ART Full Editor (RTE) can move

**Estimate:** 13 → break into:

- PULSE-27a: Static matrix view (5)
- PULSE-27b: Drag-drop interactions (5)
- PULSE-27c: Filters and color coding (3)

**Dependencies:** PULSE-26
**Module:** `features/pi/`

#### PULSE-28 — Implement PI Objectives

**As a** RTE,
**I want** to capture PI Objectives,
**so that** the ART commits to outcomes.

**Acceptance Criteria:**

- PI Objectives are team-level (each team has 5-10)
- Business value scored 1-10
- Committed vs uncommitted distinction
- Confidence vote captured at start of PI (1-5 fist of five)
- Objectives reviewed at PI end

**Estimate:** 5
**Dependencies:** PULSE-25
**Module:** `features/pi/`

#### PULSE-29 — Implement PI start/complete workflow

**As a** RTE,
**I want** to start and complete PIs,
**so that** transitions are explicit.

**Acceptance Criteria:**

- Start PI: validates all teams have committed objectives, no overlapping active PIs
- Complete PI: prompts for objective achievement scores, generates summary
- Both transitions emit audit events
- Email notifications to all ART members

**Estimate:** 5
**Dependencies:** PULSE-28
**Module:** `features/pi/`

### 4.6 F6 — Team & Sprint Backlog

#### PULSE-30 — Implement Story CRUD

**As a** Product Owner,
**I want** to break Features into Stories,
**so that** my team can deliver incrementally.

**Acceptance Criteria:**

- `Initiative` with `level = 2`, parent must be a Feature
- Required: PI, Sprint, story points (Fibonacci)
- Acceptance criteria as array
- API + UI
- All level-2 invariants verified

**Estimate:** 5
**Dependencies:** PULSE-22, PULSE-26
**Module:** `features/team/`

#### PULSE-31 — Implement Task CRUD

**As a** Developer,
**I want** to break Stories into Tasks,
**so that** I can track my work.

**Acceptance Criteria:**

- `Initiative` with `level = 3`, parent must be a Story
- Required: estimate hours
- Task Owner permission: edit only own tasks
- API + UI

**Estimate:** 3
**Dependencies:** PULSE-30
**Module:** `features/team/`

#### PULSE-32 — Build Sprint Board

**As a** Developer,
**I want** a Kanban board of my Sprint's Stories and Tasks,
**so that** I can track daily progress.

**Acceptance Criteria:**

- `/team/:teamId/sprint/:sprintId` page
- Columns: To Do, In Progress, In Review, Done
- Drag-drop updates status
- Realtime updates via Supabase Realtime
- Permission gates respect ownership

**Estimate:** 8
**Dependencies:** PULSE-30, PULSE-31
**Module:** `features/team/`

#### PULSE-33 — Build Team Backlog

**As a** Product Owner,
**I want** a prioritized list of Stories for my team,
**so that** I can plan Sprints.

**Acceptance Criteria:**

- `/team/:teamId/backlog` page
- Lists Stories not yet assigned to a Sprint
- Drag-drop to assign to a Sprint
- Sortable by priority
- Filter by Feature, PI

**Estimate:** 5
**Dependencies:** PULSE-30
**Module:** `features/team/`

### 4.7 F7 — Dependencies & Impediments

#### PULSE-34 — Implement dependency linking

**As a** RTE,
**I want** to link initiatives across teams,
**so that** dependencies are visible.

**Acceptance Criteria:**

- API: `POST /api/v1/initiatives/:id/dependencies`
- Types: `blocks`, `depends_on`, `relates_to`
- Cycle detection rejects circular dependencies
- Cross-tenant linking forbidden
- Audit events emitted

**Estimate:** 5
**Dependencies:** PULSE-22, PULSE-30
**Module:** `features/dependencies/`

#### PULSE-35 — Build dependency graph visualization

**As a** RTE,
**I want** to visualize dependencies for a PI,
**so that** I can identify risks.

**Acceptance Criteria:**

- `/art/:artId/pi/:piId/dependencies` page
- Graph rendered with a library (e.g., `react-flow` or `@xyflow/react`)
- Nodes = initiatives, edges = typed dependencies
- Click node to navigate to detail
- Filter by team, type, status

**Estimate:** 8
**Dependencies:** PULSE-34
**Module:** `features/dependencies/`

#### PULSE-36 — Implement impediment workflow

**As a** Scrum Master,
**I want** to log and escalate impediments,
**so that** blockers get attention.

**Acceptance Criteria:**

- Impediment is a typed Initiative variant (or separate table — TBD in spike)
- Severity levels: low, medium, high, critical
- Escalation routes to RTE for medium+
- Resolution requires comment and timestamp
- Email notification on escalation

**Estimate:** 8
**Dependencies:** PULSE-32
**Module:** `features/dependencies/`

### 4.8 F8 — Reporting & Dashboards

#### PULSE-37 — Build Portfolio Health dashboard

**As a** Portfolio Editor,
**I want** a dashboard of portfolio health,
**so that** I can make funding decisions.

**Acceptance Criteria:**

- Total Epics by status
- Value stream budget utilization
- Epic age distribution
- Stale Epics (no activity > 30 days)
- All cards drill down to filtered lists

**Estimate:** 8
**Dependencies:** PULSE-20
**Module:** `features/reporting/`

#### PULSE-38 — Build PI Velocity dashboard

**As a** RTE,
**I want** PI-over-PI velocity trends,
**so that** I can spot improving/degrading teams.

**Acceptance Criteria:**

- Bar chart: completed story points per team per PI
- Trendline across PIs
- Filter by team, PI range

**Estimate:** 5
**Dependencies:** PULSE-29
**Module:** `features/reporting/`

#### PULSE-39 — Build Sprint Burn-down

**As a** Scrum Master,
**I want** a burn-down chart per Sprint,
**so that** I can spot slipping sprints early.

**Acceptance Criteria:**

- Line chart: remaining story points over sprint days
- Ideal vs actual lines
- Cached for performance (refresh every 5 min)

**Estimate:** 5
**Dependencies:** PULSE-32
**Module:** `features/reporting/`

### 4.9 F9 — Integrations

#### PULSE-40 — Implement outbox processor

**As a** Platform,
**I want** outbound integration events processed reliably,
**so that** external systems stay in sync.

**Acceptance Criteria:**

- `outbox_events` table written transactionally with mutations
- Vercel Cron (1×/day) processes pending events
- Exponential backoff on failure (max 5 attempts)
- Permanent failures alert via Sentry
- Idempotent processing

**Estimate:** 8
**Dependencies:** PULSE-07
**Module:** `server/outbox/`

#### PULSE-41 — Implement Jira OAuth + sync

**As a** Tenant Admin,
**I want** to connect my Jira instance,
**so that** Stories flow to Jira automatically.

**Acceptance Criteria:**

- OAuth 2.0 flow for Jira Cloud
- Tenant-level Jira config stores instance URL, project key mapping
- Story creation pushes to Jira via outbox
- Status updates flow back via webhook
- HMAC signature verification on webhook

**Estimate:** 13 → break into:

- PULSE-41a: Jira OAuth flow (5)
- PULSE-41b: Outbound sync via outbox (5)
- PULSE-41c: Inbound webhook handler (3)

**Dependencies:** PULSE-40
**Module:** `features/integrations/`, `server/integrations/jira/`

#### PULSE-42 — Implement Azure DevOps integration

**As a** Tenant Admin,
**I want** to connect my Azure DevOps,
**so that** Stories flow to ADO.

**Acceptance Criteria:**

- Equivalent of PULSE-41 for ADO
- Service Hooks instead of webhooks
- Work Item types mapped to Pulse levels

**Estimate:** 13 → broken down similarly
**Dependencies:** PULSE-41
**Module:** `features/integrations/`, `server/integrations/ado/`

---

## 5. Implementation Roadmap

### 5.1 Sprint Plan (2-week sprints)

Total: **15 sprints (~30 weeks / 7.5 months) to GA**

| Sprint  | Focus                             | Stories                      | Goal                                         |
| ------- | --------------------------------- | ---------------------------- | -------------------------------------------- |
| **0**   | Project setup                     | PULSE-01, 02                 | Repo + Supabase ready                        |
| **1**   | Auth foundation                   | PULSE-03, 04, 05, 08, 09, 10 | Walking skeleton: login + i18n + Sentry + CI |
| **2**   | Data foundation                   | PULSE-06a, 06b, 06c, 07      | RLS + audit log working                      |
| **3**   | Tenant management                 | PULSE-11, 12                 | Tenants can be created, users invited        |
| **4**   | Roles                             | PULSE-13, 14, 15             | Roles assigned, audit log visible            |
| **5**   | Value Streams + Epics             | PULSE-16, 17                 | Epics can be created                         |
| **6**   | Portfolio Kanban                  | PULSE-18a, 18b, 18c, 19      | Portfolio view live                          |
| **7**   | Epic workflow                     | PULSE-20, 21                 | Approvals work, ARTs exist                   |
| **8**   | Features                          | PULSE-22, 23, 24             | Features with WSJF working                   |
| **9**   | PI Planning core                  | PULSE-25, 26                 | PIs created, sprints auto-generated          |
| **10**  | Program Board                     | PULSE-27a, 27b, 27c, 28      | Visual PI planning                           |
| **11**  | PI workflow                       | PULSE-29, 30                 | PI lifecycle complete; Stories created       |
| **12**  | Team execution                    | PULSE-31, 32, 33             | Tasks, Sprint Board, Backlog live            |
| **13**  | Dependencies                      | PULSE-34, 35, 36             | Cross-team coordination                      |
| **14**  | Reporting                         | PULSE-37, 38, 39             | Dashboards live                              |
| **15**  | Integrations + Pilot prep         | PULSE-40, 41a-c              | Jira sync working                            |
| **16+** | ADO + Pilot                       | PULSE-42, hardening          | Pilot tenants live                           |
| **GA**  | (after 4-6 weeks of stable pilot) | —                            | Self-service onboarding                      |

### 5.2 Milestones

| Milestone                | Sprint | Demoable Outcome                                       |
| ------------------------ | ------ | ------------------------------------------------------ |
| **M1: Walking Skeleton** | 1      | User can log in, see an empty page, log out            |
| **M2: Multi-Tenancy**    | 4      | Multiple tenants run in isolation, admins manage users |
| **M3: Portfolio Live**   | 7      | Portfolio Editor can run their full job in Pulse       |
| **M4: ART Live**         | 11     | RTE + PM can run full PI Planning                      |
| **M5: Team Live**        | 13     | All 4 hierarchy levels usable end-to-end               |
| **M6: Pilot Ready**      | 15     | Reporting + Jira sync ready for 3 pilot tenants        |
| **M7: GA**               | 18-20  | Self-service tenants, SOC 2 audit in progress          |

### 5.3 Parallel Tracks

To compress the timeline, some work runs in parallel:

```
Backend track:   |--Sprint 1--|--2--|--3--|--4--|--5--|...
Frontend track:        |--Sprint 2--|--3--|--4--|--5--|...  (1 sprint behind backend)
Integrations:                                |---14---|--15--|--16--|
QA / E2E:        |---ongoing, with dedicated automation engineer---|
```

- Backend API + tests for a feature ship one sprint before the UI consumes them
- Frontend can stub API calls with MSW until backend is ready
- Integrations track starts in Sprint 14 with a dedicated engineer

### 5.4 Critical Path

The critical path is:

```
PULSE-01 → PULSE-02 → PULSE-06 → PULSE-07 → PULSE-17 → PULSE-22 → PULSE-30 → PULSE-32
   scaffold    DB        RLS      audit      Epic       Feature     Story      Sprint Board
```

Any delay here cascades. Stories not on the critical path can shift sprints without impacting GA.

### 5.5 Capacity Assumptions

| Role                | FTE     | Velocity (points/sprint)              |
| ------------------- | ------- | ------------------------------------- |
| Engineering Lead    | 1.0     | 5 (50% on review, design, unblocking) |
| Full-Stack Engineer | 4.0     | 13 each                               |
| Platform Engineer   | 1.0     | 10 (infra-focused)                    |
| QA Engineer         | 1.0     | 8 (test automation)                   |
| **Total**           | **7.0** | **~75 points per sprint**             |

Story totals per sprint average 30-50 points. Buffer is intentional — first sprints will run slower while team forms.

---

## 6. Definition of Ready / Done

### 6.1 Definition of Ready (DoR)

A story is **ready for sprint planning** when:

- [ ] User story written in Connextra format (As a / I want / so that)
- [ ] Acceptance criteria specified as Given/When/Then or bullet checklist
- [ ] Estimate agreed by team (planning poker)
- [ ] Dependencies identified and resolved or scheduled before this story
- [ ] Designs (if any) attached and approved
- [ ] Non-functional requirements explicit (performance, accessibility, security)
- [ ] No blocking open questions
- [ ] Fits within a single sprint (estimate ≤ 8 points; larger stories are broken down)

### 6.2 Definition of Done (DoD)

A story is **done** when:

- [ ] Code merged to `main` via squash-merged PR
- [ ] All acceptance criteria met
- [ ] Unit + integration tests written, coverage not decreased
- [ ] E2E test added for new user-facing flows
- [ ] TypeScript strict mode passes
- [ ] ESLint passes
- [ ] No new `// TODO`s without an issue link
- [ ] Translations added to both `de.json` and `en.json`
- [ ] Accessibility verified (axe-core in tests, manual check for forms)
- [ ] Permission gates in place where required
- [ ] Audit events emitted where required
- [ ] Documentation updated (README, runbook, or feature doc)
- [ ] Deployed to staging and smoke-tested
- [ ] PR reviewed and approved by at least one team member
- [ ] No regression in performance budgets (Lighthouse CI)

### 6.3 Definition of Implementable

A story is **implementable** (i.e., ready for a developer to pick up) when, in addition to DoR:

- [ ] Affected files / modules identified
- [ ] API contract drafted (request/response shapes, error codes)
- [ ] Database changes drafted (Prisma schema diff)
- [ ] Permissions explicit (which roles, which actions)
- [ ] i18n keys planned
- [ ] Edge cases enumerated (empty states, errors, rate limits)
- [ ] Test scenarios listed

---

## 7. Cross-Cutting Implementation Concerns

### 7.1 Coding Standards

- **TypeScript:** strict mode, no `any`, no `@ts-ignore` (use `@ts-expect-error` with a reason)
- **Naming:** kebab-case for files, PascalCase for components, camelCase for functions, UPPER_SNAKE for constants
- **Imports:** absolute imports via `@/*` alias; relative imports only within the same feature
- **File size:** components target < 200 lines; services target < 300 lines; split if larger
- **Comments:** Only for "why", never for "what". JSDoc on public APIs only.

### 7.2 Error Handling Conventions

```typescript
// Domain errors are typed and discriminated
export type DomainError =
  | { kind: "hierarchy_violation"; violatedConstraint: string }
  | { kind: "not_found"; resourceType: string; id: string }
  | { kind: "forbidden"; reason: string }
  | { kind: "conflict"; reason: string };

// Services return Result types, never throw for expected errors
export type Result<T, E = DomainError> = { ok: true; value: T } | { ok: false; error: E };

// Throw only for unexpected/unrecoverable errors
```

### 7.3 Logging Conventions

```typescript
// Always structured, never console.log raw strings
logger.info("initiative.created", {
  initiativeId: result.id,
  level: result.level,
  tenantId: ctx.tenantId,
  actorId: ctx.principal.id,
  traceId: ctx.traceId,
});
```

### 7.4 Test Conventions

- Test file name matches source file: `epic.service.ts` → `epic.service.test.ts`
- Test descriptions follow "should X when Y" or "given X, when Y, then Z"
- Arrange-Act-Assert structure
- One assertion per test where practical
- No shared mutable state between tests (no `beforeAll` with state)
- Factories for test data in `src/test/fixtures/`

### 7.5 Migration Conventions

- Each migration in its own file with timestamp prefix
- Migration file describes the change in a comment header
- All migrations reversible (write `down` SQL even if rarely run)
- Schema changes require Prisma migration; data changes require seed scripts
- RLS policy changes are migrations, not seeds
- Migrations tested against a fresh database in CI

### 7.6 Security Conventions

- Never log secrets, tokens, or PII
- All user input validated via Zod at the boundary
- All Prisma queries use parameterization (never `$queryRawUnsafe`)
- All Server Actions and Route Handlers run authorization before mutation
- Webhook signatures verified before processing
- Rate limits on auth endpoints (handled by Supabase)

### 7.7 Performance Conventions

- Server Components by default; Client Components only when needed
- TanStack Query `staleTime` always explicit
- Images via Next.js `<Image>` with width/height
- Prisma queries include only fields needed (`select`, not full models)
- N+1 queries forbidden; use `include` or batch loaders
- Heavy reports cached via Next.js `unstable_cache` with explicit invalidation tags

### 7.8 Accessibility Conventions

- Semantic HTML first; ARIA only when no semantic equivalent exists
- All interactive elements keyboard-accessible
- Color contrast WCAG AA minimum
- Form fields associated with labels
- Focus management on route changes and modals
- `axe-core` runs in every component test

---

## 8. Sprint 0 Checklist

Before Sprint 1 starts, the following MUST be true. This is the **handoff gate** to the development team.

### 8.1 Code & Repository

- [ ] GitHub repository created with branch protection on `main`
- [ ] Required CI checks defined (typecheck, lint, test, build)
- [ ] Conventional Commits enforced via Husky + commitlint
- [ ] `.editorconfig`, `.prettierrc`, `.eslintrc.js` committed
- [ ] `tsconfig.json` with strict mode and path aliases
- [ ] `package.json` with all dependencies pinned to exact versions
- [ ] README documents local setup, scripts, conventions

### 8.2 Infrastructure

- [ ] Supabase project provisioned in EU region
- [ ] Vercel project linked to GitHub repo
- [ ] Staging environment auto-deploys from `main`
- [ ] Preview deployments enabled for PRs
- [ ] Sentry projects (frontend + backend) created with DSNs
- [ ] Resend account configured with verified sending domain
- [ ] Environment variables documented in `.env.example`
- [ ] Secrets stored in Vercel + GitHub Actions

### 8.3 Documentation

- [ ] All 14 ADRs ratified and committed under `docs/adr/`
- [ ] Technical Concept committed under `docs/concepts/`
- [ ] This Implementation Concept committed under `docs/concepts/`
- [ ] Onboarding runbook for new developers
- [ ] Local development guide tested by a fresh team member

### 8.4 Team

- [ ] Engineering Lead identified
- [ ] 4 Full-Stack Engineers onboarded
- [ ] Platform Engineer onboarded
- [ ] QA Engineer onboarded
- [ ] Product Manager identified
- [ ] SAFe SPC engaged (fractional)
- [ ] Designer engaged
- [ ] Recurring meetings scheduled: sprint planning, daily standup, sprint review, retro

### 8.5 Process

- [ ] Issue tracker set up (GitHub Issues or Linear) with story templates
- [ ] All Sprint 1 stories meet DoR
- [ ] Sprint 0 review held; team agrees roadmap is realistic
- [ ] Risk register reviewed and populated
- [ ] Communication channels established (Slack/Teams)

---

## 9. Appendix

### 9.1 Quick Reference: Story ID Map

| Story Range          | Feature                       |
| -------------------- | ----------------------------- |
| PULSE-01 to PULSE-10 | F1 Foundation                 |
| PULSE-11 to PULSE-15 | F2 Tenant & User Management   |
| PULSE-16 to PULSE-20 | F3 Portfolio Management       |
| PULSE-21 to PULSE-24 | F4 ART & Feature Management   |
| PULSE-25 to PULSE-29 | F5 Program Increment Planning |
| PULSE-30 to PULSE-33 | F6 Team & Sprint Backlog      |
| PULSE-34 to PULSE-36 | F7 Dependencies & Impediments |
| PULSE-37 to PULSE-39 | F8 Reporting & Dashboards     |
| PULSE-40 to PULSE-42 | F9 Integrations               |

### 9.2 Quick Reference: Module Dependency Graph

```
auth ──┬──> admin ──┬──> portfolio ──┬──> art ──┬──> pi ──┬──> team ──┬──> dependencies
       │            │                │          │         │           │
       │            │                │          │         │           ├──> reporting
       │            │                │          │         │           │
       │            └────────────────┴──────────┴─────────┴───────────┴──> integrations
       │
       └──> (shared by everything)
```

### 9.3 Quick Reference: SAFe Role → Story Allocation

Each persona's "first sprint of value":

| Persona              | First demoable in Sprint | First fully functional in Sprint |
| -------------------- | ------------------------ | -------------------------------- |
| Tenant Admin         | 4                        | 4                                |
| Portfolio Editor     | 7                        | 7                                |
| Enterprise Architect | 7                        | 13 (when reporting added)        |
| RTE                  | 11                       | 13                               |
| Product Manager      | 8                        | 13                               |
| System Architect     | 8                        | 13                               |
| Scrum Master         | 12                       | 13                               |
| Product Owner        | 12                       | 12                               |
| Developer            | 12                       | 12                               |
| Business Owner       | 13                       | 14                               |

### 9.4 Glossary

| Term             | Definition                                                               |
| ---------------- | ------------------------------------------------------------------------ |
| DoR              | Definition of Ready — checklist a story must meet before sprint planning |
| DoD              | Definition of Done — checklist before a story is closed                  |
| Vertical Slice   | An end-to-end feature touching all layers (UI → DB)                      |
| Walking Skeleton | A minimal end-to-end implementation proving infrastructure works         |
| Outbox Pattern   | A reliability pattern: persist events to a table, process asynchronously |
| RLS              | Row-Level Security in PostgreSQL                                         |
| WSJF             | Weighted Shortest Job First, SAFe's prioritization formula               |

### 9.5 References

- [Technical Concept](./pulse-technical-concept.md)
- [ADR Index](./adr/README.md)
- [Scaled Agile Framework — Essential SAFe](https://framework.scaledagile.com/essential-safe)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Connextra Story Format](https://www.agilealliance.org/glossary/user-story-template/)

### 9.6 Changelog

| Version | Date       | Author           | Notes                                            |
| ------- | ---------- | ---------------- | ------------------------------------------------ |
| 0.1     | 2026-05-16 | Engineering Lead | Initial implementation concept ready for handoff |

---

**Status: Ready for Implementation. Sprint 0 may begin.**
