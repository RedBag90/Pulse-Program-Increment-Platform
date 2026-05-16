# Pulse — Program Increment Platform

## Technical Concept & Architecture Blueprint

> **Status:** Draft v0.2 — for architecture review
> **Author:** Engineering Lead
> **Last Updated:** 2026-05-16
> **Reviewers:** Architecture Board, Product Management, SAFe SPC
> **Related Documents:** _(to be created)_ `RFC-0001-domain-model.md`, ADRs under `/docs/adr/`

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Goals & Non-Goals](#2-goals--non-goals)
3. [Product Context](#3-product-context)
4. [Tech Stack](#4-tech-stack)
5. [Architecture Overview](#5-architecture-overview)
6. [Domain Model](#6-domain-model)
7. [Authorization Model (RBAC)](#7-authorization-model-rbac)
8. [API Design](#8-api-design)
9. [Data Model](#9-data-model)
10. [Frontend Architecture](#10-frontend-architecture)
11. [Integration Surface](#11-integration-surface)
12. [Security & Compliance](#12-security--compliance)
13. [Observability](#13-observability)
14. [Testing Strategy](#14-testing-strategy)
15. [Project Structure](#15-project-structure)
16. [Delivery Roadmap](#16-delivery-roadmap)
17. [Open Questions](#17-open-questions)
18. [Appendix](#18-appendix)

---

## 1. Executive Summary

**Pulse** is a greenfield enterprise platform for managing large-scale agile transformations under the Scaled Agile Framework (SAFe). It targets organizations running multiple Agile Release Trains (ARTs) that need a single source of truth for Epics, Features, Stories, and Tasks across Portfolio, Program, and Team levels.

This document defines the technical foundation: tech stack, domain model, authorization, API contracts, data model, project structure, and delivery roadmap.

### Core Capabilities

- **Four-tier initiative hierarchy** (Epic → Feature → Story → Task) with strictly enforced invariants
- **SAFe-native role model** with 10 role groups mapped to organizational responsibilities
- **WSJF prioritization** as a first-class scoring construct on Feature-level items
- **Program Increment (PI) timeboxing** as the central planning unit
- **Cross-ART dependency tracking** with typed, traversable relationships
- **Multi-tenant isolation** with PostgreSQL Row-Level Security
- **i18n from day one** — German and English

### Why Greenfield?

Existing transformation tools either lack SAFe-specific semantics (general-purpose PPM) or bolt agile concepts onto pre-agile data models. Pulse is designed SAFe-first: the hierarchy, the events, and the roles are not "optional configurations" — they are the schema.

---

## 2. Goals & Non-Goals

### 2.1 Goals

- **G1** — Deliver a SAFe-native domain model with hierarchy invariants enforced at every layer (TypeScript types, Zod schemas, Prisma constraints, PostgreSQL CHECK)
- **G2** — Provide level-aware RBAC with deterministic visibility scopes, enforced via Supabase RLS + application-layer guards
- **G3** — Support multi-ART, multi-value-stream portfolios in a single tenant
- **G4** — Achieve sub-200ms p95 latency on authorization checks and core reads at 1000 concurrent users per tenant
- **G5** — First-class integration surface for Jira / Azure DevOps / GitLab so Pulse complements rather than replaces team-level tooling
- **G6** — Audit-ready by default — every mutation produces an immutable audit event
- **G7** — i18n-ready out of the box — German and English at launch, additional locales as a config change

### 2.2 Non-Goals

- **NG1** — Replacing team-level issue trackers (Jira/ADO/GitLab). Pulse links to them, does not duplicate them.
- **NG2** — Real-time collaborative whiteboarding for PI Planning. Integrations with Miro/Mural are sufficient.
- **NG3** — Built-in time tracking / timesheet capture. This belongs in HR systems.
- **NG4** — Native mobile apps. Web-first, mobile-responsive only.
- **NG5** — Generic PPM (Project Portfolio Management). SAFe-specific is the wedge.
- **NG6** — Self-hosted deployment in the first 12 months. Vercel-hosted SaaS only.

### 2.3 Success Metrics (Year 1)

| Metric                                                   | Target  |
| -------------------------------------------------------- | ------- |
| Pilot tenants in production                              | ≥ 5     |
| Mean time from PI start → all Features captured in Pulse | < 24h   |
| Authorization check latency (p95)                        | < 50ms  |
| Initiative read latency (p95)                            | < 200ms |
| Customer-reported P1 incidents (per quarter)             | 0       |
| Unit test coverage (domain layer)                        | ≥ 90%   |
| Lighthouse Performance score (Portfolio view)            | ≥ 90    |

---

## 3. Product Context

### 3.1 User Personas

| Persona                       | SAFe Role            | Primary Use of Pulse                                         |
| ----------------------------- | -------------------- | ------------------------------------------------------------ |
| Priya — Portfolio Lead        | LPM / Epic Owner     | Manage portfolio backlog, approve Epics, fund value streams  |
| Marcus — Enterprise Architect | Enterprise Architect | Read across portfolio, drive technical Enabler Epics         |
| Anna — Release Train Engineer | RTE                  | Run PI Planning, track dependencies, escalate impediments    |
| Sven — Product Manager        | Product Manager      | Manage Feature backlog, set WSJF, define acceptance criteria |
| Lea — System Architect        | System Architect     | Define NFRs, technical Features, cross-team interfaces       |
| Tom — Scrum Master            | SM / Team Coach      | Coach team, remove impediments, run sprint events            |
| Julia — Product Owner         | Product Owner        | Own team backlog, write Stories, prioritize sprints          |
| Daniel — Developer            | Agile Team Member    | Pick up Tasks, report progress                               |
| Bea — Business Owner          | Business Owner       | View portfolio health, approve PI Objectives                 |

### 3.2 Key User Journeys

The system optimizes for these flows, in order of frequency:

1. **Daily standup view** (highest frequency) — Developer opens own Tasks, updates status
2. **Sprint planning** (bi-weekly) — PO + SM prepare team backlog
3. **PI Planning** (every 8-12 weeks) — entire ART aligns on next PI's Features
4. **Portfolio review** (monthly) — LPM reviews Epic progress and reprioritizes
5. **Inspect & Adapt** (end of PI) — RTE facilitates retrospective with metrics from Pulse

---

## 4. Tech Stack

The stack below is **ratified**. Each row maps to an Architecture Decision Record (ADR) in `/docs/adr/` capturing context and trade-offs.

| Area          | Technology                                     | ADR      |
| ------------- | ---------------------------------------------- | -------- |
| Framework     | Next.js 15 (App Router)                        | ADR-0001 |
| Language      | TypeScript (strict mode)                       | ADR-0002 |
| Database      | PostgreSQL via Supabase                        | ADR-0003 |
| ORM           | Prisma 6 (custom output path)                  | ADR-0004 |
| Auth          | Supabase Auth (`@supabase/ssr`)                | ADR-0005 |
| Server State  | TanStack React Query v5                        | ADR-0006 |
| Forms         | react-hook-form + Zod                          | ADR-0007 |
| Styling       | Tailwind CSS v4 (PostCSS)                      | ADR-0008 |
| i18n          | next-intl v4 (DE + EN)                         | ADR-0009 |
| Email         | Nodemailer (SMTP / Resend)                     | ADR-0010 |
| Observability | Sentry + Vercel Analytics + Speed Insights     | ADR-0011 |
| Testing       | Vitest (unit) + Playwright (e2e) + MSW (mocks) | ADR-0012 |
| Deployment    | Vercel (Hobby tier, 1 cron/day max)            | ADR-0013 |
| CI            | GitHub Actions                                 | ADR-0014 |

### 4.1 Stack Implications

The chosen stack drives several architectural choices in this document:

- **No separate API gateway.** Next.js Route Handlers and Server Actions are the API layer. Authorization runs as middleware + per-handler guards.
- **No dedicated message bus initially.** Domain events are persisted to PostgreSQL via Supabase Realtime channels for in-app push. Heavier event-driven workflows (webhooks, integrations) use a database-backed outbox pattern processed by a Vercel Cron job (1 invocation per day; batched).
- **RLS is the primary tenant-isolation guarantee.** Supabase's PostgreSQL RLS enforces tenant boundaries at the row level. Application code provides defense in depth, not the primary guarantee.
- **Zod is the schema source of truth.** Zod schemas validate inputs at API boundaries, generate TypeScript types, and drive react-hook-form validation on the client. One schema, three uses.
- **Prisma + RLS requires care.** Prisma must run as a per-request connection that has the authenticated user's JWT applied, so RLS policies fire correctly. This is implemented via Supabase's PostgREST or via a per-request Prisma client extension setting `app.current_user_id` and `app.current_tenant_id`.
- **Vercel Hobby cron limit (1/day).** All scheduled work batches into a single nightly job. No sub-hourly cron needs in v1; if required later, upgrade tier or migrate to an external scheduler.

---

## 5. Architecture Overview

### 5.1 High-Level Component Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                  Browser (Web Client)                            │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │  Next.js App Router (RSC + Client Components)            │    │
│  │  - Portfolio / ART / Team / Admin route segments         │    │
│  │  - TanStack Query (server state)                         │    │
│  │  - react-hook-form + Zod (forms)                         │    │
│  │  - next-intl (DE / EN)                                   │    │
│  └──────────────────────────────────────────────────────────┘    │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼  HTTP (Vercel Edge → Node runtime)
┌──────────────────────────────────────────────────────────────────┐
│                  Next.js Server (Vercel)                         │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Middleware                                                │  │
│  │    - Supabase Auth (@supabase/ssr) cookie refresh          │  │
│  │    - i18n locale detection                                 │  │
│  │    - Trace ID propagation                                  │  │
│  └────────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Route Handlers + Server Actions (/app/api/**)             │  │
│  │    - Zod input validation                                  │  │
│  │    - Authorization guards                                  │  │
│  │    - Domain service calls                                  │  │
│  │    - Audit emission                                        │  │
│  └────────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Domain Services (pure TypeScript)                         │  │
│  │    - Initiative, PI, ValueStream, Authorization, Reporting │  │
│  └────────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Prisma Client (per-request, RLS-aware)                    │  │
│  └────────────────────────────────────────────────────────────┘  │
└────────────────────────────┬─────────────────────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        ▼                    ▼                    ▼
┌──────────────┐    ┌──────────────┐     ┌──────────────┐
│   Supabase   │    │   Sentry     │     │   Vercel     │
│  PostgreSQL  │    │ (errors)     │     │  Analytics   │
│  + Auth      │    │              │     │   + Speed    │
│  + Realtime  │    │              │     │   Insights   │
│  + Storage   │    │              │     │              │
│  + RLS       │    │              │     │              │
└──────────────┘    └──────────────┘     └──────────────┘
        │
        ▼
┌──────────────┐
│  Resend /    │   (outbound email via Nodemailer)
│  SMTP        │
└──────────────┘
```

### 5.2 Runtime Topology

- **Edge runtime** for middleware (auth cookie refresh, locale detection, trace IDs)
- **Node.js runtime** for Route Handlers and Server Actions (Prisma requires Node)
- **Server Components** for read-heavy pages (Portfolio Kanban, Reports). Use Prisma directly with RLS-aware client.
- **Client Components** for interactive surfaces (Sprint Board, Form editors). Use TanStack Query against Route Handlers.

### 5.3 Architectural Principles

1. **Type safety end-to-end.** Domain invariants encoded in TypeScript discriminated unions + Zod schemas. Runtime checks are the safety net, not the primary guarantee.
2. **One schema, one source of truth.** Zod schemas live in `/src/domain/schemas/` and are imported by both server (validation) and client (forms). Never duplicate.
3. **Authorization at every boundary.** RLS at DB, guard functions at handlers, `PermissionGate` at UI. Three layers, each independently sufficient.
4. **Idempotent mutations.** Every write endpoint accepts `Idempotency-Key`. Server Actions use form action keys; Route Handlers require explicit headers.
5. **Audit by default.** Audit emission is part of the transaction. No code path bypasses the audit log.
6. **Multi-tenant from day one.** `tenantId` in every Prisma query path. RLS as the final guardrail. Tenant context set on every request.
7. **Domain logic is pure.** No I/O in domain services. I/O sits in repositories. This keeps unit tests fast and deterministic.

---

## 6. Domain Model

### 6.1 Ubiquitous Language

The domain language matches SAFe terminology exactly.

| Term             | Definition                                                                          |
| ---------------- | ----------------------------------------------------------------------------------- |
| **Tenant**       | An organizational customer of Pulse. Top-level isolation boundary.                  |
| **Value Stream** | A sequence of steps an organization uses to deliver value. Funded by the Portfolio. |
| **Portfolio**    | The collection of value streams owned by a tenant. Strategic level.                 |
| **Epic**         | Largest unit of work. Spans multiple PIs. Lives in the Portfolio Kanban.            |
| **ART**          | Agile Release Train. 5-12 teams working together on a common mission.               |
| **Feature**      | ART-level work item. Fits within a single PI. Sized by WSJF.                        |
| **PI**           | Program Increment. 8-12 week timebox aligning all teams in an ART.                  |
| **Sprint**       | Team-level iteration. Typically 2 weeks. Multiple sprints per PI.                   |
| **Story**        | Team-level work item. Fits within a single sprint.                                  |
| **Task**         | Smallest unit of work. Assigned to an individual contributor.                       |
| **WSJF**         | Weighted Shortest Job First. SAFe's prioritization formula.                         |
| **Stage Gate**   | Approval checkpoint in the initiative lifecycle (L0-L5).                            |

### 6.2 Core Types

```typescript
// src/domain/types.ts

/**
 * Discriminator for the four-tier hierarchy.
 * Numeric ordering is load-bearing: parent.level + 1 === child.level.
 */
export enum InitiativeLevel {
  EPIC = 0,
  FEATURE = 1,
  STORY = 2,
  TASK = 3,
}

/**
 * Branded primitive types prevent ID confusion across entity boundaries.
 */
export type TenantId = string & { readonly __brand: "TenantId" };
export type EpicId = string & { readonly __brand: "EpicId" };
export type FeatureId = string & { readonly __brand: "FeatureId" };
export type StoryId = string & { readonly __brand: "StoryId" };
export type TaskId = string & { readonly __brand: "TaskId" };
export type InitiativeId = EpicId | FeatureId | StoryId | TaskId;
export type UserId = string & { readonly __brand: "UserId" };
export type ArtId = string & { readonly __brand: "ArtId" };
export type ValueStreamId = string & { readonly __brand: "ValueStreamId" };
export type PiId = string & { readonly __brand: "PiId" };
export type SprintId = string & { readonly __brand: "SprintId" };

/**
 * Discriminated union: the level field narrows allowed fields.
 */
export type Initiative = Epic | Feature | Story | Task;

interface InitiativeBase {
  readonly id: InitiativeId;
  readonly tenantId: TenantId;
  readonly path: string;
  title: string;
  description: string;
  ownerId: UserId;
  assigneeIds: ReadonlyArray<UserId>;
  stageGate: StageGate;
  status: InitiativeStatus;
  readonly createdAt: Date;
  readonly createdBy: UserId;
  updatedAt: Date;
  updatedBy: UserId;
}

export interface Epic extends InitiativeBase {
  readonly level: InitiativeLevel.EPIC;
  readonly id: EpicId;
  readonly parentId: null;
  readonly valueStreamId: ValueStreamId;
  leanBusinessCase: LeanBusinessCase;
}

export interface Feature extends InitiativeBase {
  readonly level: InitiativeLevel.FEATURE;
  readonly id: FeatureId;
  readonly parentId: EpicId;
  readonly artId: ArtId;
  readonly piId: PiId;
  wsjf: WsjfScore;
  acceptanceCriteria: ReadonlyArray<string>;
}

export interface Story extends InitiativeBase {
  readonly level: InitiativeLevel.STORY;
  readonly id: StoryId;
  readonly parentId: FeatureId;
  readonly piId: PiId;
  readonly sprintId: SprintId;
  storyPoints: FibonacciValue;
  acceptanceCriteria: ReadonlyArray<string>;
}

export interface Task extends InitiativeBase {
  readonly level: InitiativeLevel.TASK;
  readonly id: TaskId;
  readonly parentId: StoryId;
  estimateHours: number;
}

export interface WsjfScore {
  readonly businessValue: FibonacciValue;
  readonly timeCriticality: FibonacciValue;
  readonly riskReduction: FibonacciValue;
  readonly jobSize: FibonacciValue;
  readonly computed: number; // server-computed; clients never set
}

export type FibonacciValue = 1 | 2 | 3 | 5 | 8 | 13 | 20;
export type StageGate = "L0" | "L1" | "L2" | "L3" | "L4" | "L5";
export type InitiativeStatus =
  | "draft"
  | "in_review"
  | "approved"
  | "in_progress"
  | "blocked"
  | "completed"
  | "cancelled";
```

### 6.3 Zod Schemas

Zod is the single source of truth for runtime validation. TypeScript types are inferred from Zod schemas where possible to avoid drift.

```typescript
// src/domain/schemas/initiative.ts
import { z } from "zod";

const fibonacci = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(5),
  z.literal(8),
  z.literal(13),
  z.literal(20),
]);

const wsjfInputSchema = z.object({
  businessValue: fibonacci,
  timeCriticality: fibonacci,
  riskReduction: fibonacci,
  jobSize: fibonacci,
});

const baseSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(10_000).default(""),
  ownerId: z.string().uuid(),
});

export const createEpicSchema = baseSchema.extend({
  level: z.literal("EPIC"),
  parentId: z.null(),
  valueStreamId: z.string().uuid(),
  leanBusinessCase: z.object({
    /* ... */
  }),
});

export const createFeatureSchema = baseSchema.extend({
  level: z.literal("FEATURE"),
  parentId: z.string().uuid(),
  artId: z.string().uuid(),
  piId: z.string().uuid(),
  wsjf: wsjfInputSchema,
  acceptanceCriteria: z.array(z.string().min(1)).default([]),
});

export const createStorySchema = baseSchema.extend({
  level: z.literal("STORY"),
  parentId: z.string().uuid(),
  piId: z.string().uuid(),
  sprintId: z.string().uuid(),
  storyPoints: fibonacci,
  acceptanceCriteria: z.array(z.string().min(1)).default([]),
});

export const createTaskSchema = baseSchema.extend({
  level: z.literal("TASK"),
  parentId: z.string().uuid(),
  estimateHours: z.number().positive().max(160),
});

export const createInitiativeSchema = z.discriminatedUnion("level", [
  createEpicSchema,
  createFeatureSchema,
  createStorySchema,
  createTaskSchema,
]);

export type CreateInitiativeInput = z.infer<typeof createInitiativeSchema>;
```

### 6.4 Hierarchy Invariants

The following invariants MUST hold at all times.

| #   | Invariant                            | TypeScript            | Zod                          | Prisma          | PostgreSQL         |
| --- | ------------------------------------ | --------------------- | ---------------------------- | --------------- | ------------------ |
| I1  | `child.level === parent.level + 1`   | ✓ discriminated union | ✓ literal `level` per schema | ✓ via service   | ✓ CHECK constraint |
| I2  | Epic ⟺ `parentId === null`           | ✓                     | ✓ `z.null()` on Epic         | ✓ optional FK   | ✓                  |
| I3  | WSJF only on Feature                 | ✓ field-level         | ✓ schema-level               | ✓               | ✓                  |
| I4  | PI required for Feature & Story      | ✓                     | ✓ non-optional               | ✓               | ✓                  |
| I5  | Sprint required for Story            | ✓                     | ✓                            | ✓               | ✓                  |
| I6  | `child.tenantId === parent.tenantId` | —                     | —                            | ✓ service check | ✓ trigger          |
| I7  | Cyclic dependencies forbidden        | —                     | —                            | ✓ service check | ✓ trigger          |

### 6.5 Domain Events

```typescript
export type DomainEvent =
  | { type: "initiative.created"; payload: InitiativeCreated }
  | { type: "initiative.updated"; payload: InitiativeUpdated }
  | { type: "initiative.stage_gate.advanced"; payload: StageGateAdvanced }
  | { type: "initiative.dependency.linked"; payload: DependencyLinked }
  | { type: "wsjf.scored"; payload: WsjfScored }
  | { type: "pi.started"; payload: PiStarted }
  | { type: "pi.completed"; payload: PiCompleted }
  | { type: "impediment.raised"; payload: ImpedimentRaised }
  | { type: "impediment.resolved"; payload: ImpedimentResolved };
```

Events are persisted to PostgreSQL via an outbox table and processed by the nightly cron job. In-app real-time updates use Supabase Realtime on the `initiatives` table.

---

## 7. Authorization Model (RBAC)

### 7.1 Role Definitions

```typescript
// src/domain/roles.ts
export const ROLES = {
  PLATFORM_ADMIN: "platform_admin",
  TENANT_ADMIN: "tenant_admin",
  PORTFOLIO_EDITOR: "portfolio_editor",
  ARCHITECT_VIEWER: "architect_viewer",
  ART_FULL_EDITOR: "art_full_editor",
  FEATURE_EDITOR: "feature_editor",
  ART_ARCH_VIEWER: "art_arch_viewer",
  TEAM_EDITOR: "team_editor",
  STORY_OWNER: "story_owner",
  TASK_OWNER: "task_owner",
  PORTFOLIO_VIEWER: "portfolio_viewer",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];
```

### 7.2 Permission Matrix

| Action                | Tenant Admin | Portfolio Editor | ART Full Editor | Feature Editor | Team Editor | Story Owner | Task Owner | Portfolio Viewer |
| --------------------- | ------------ | ---------------- | --------------- | -------------- | ----------- | ----------- | ---------- | ---------------- |
| `tenant.users.manage` | ✓            | —                | —               | —              | —           | —           | —          | —                |
| `epic.create`         | —            | ✓                | —               | —              | —           | —           | —          | —                |
| `epic.approve`        | —            | ✓                | —               | —              | —           | —           | —          | —                |
| `feature.create`      | —            | ✓                | ✓               | ✓              | —           | —           | —          | —                |
| `feature.approve`     | —            | ✓                | ✓               | scoped         | —           | —           | —          | —                |
| `feature.wsjf.set`    | —            | ✓                | ✓               | ✓              | —           | —           | —          | —                |
| `story.create`        | —            | scoped           | scoped          | scoped         | ✓           | ✓           | —          | —                |
| `task.edit`           | —            | scoped           | scoped          | scoped         | ✓           | ✓           | own        | —                |
| `dependency.link`     | —            | ✓                | ✓               | ✓              | scoped      | —           | —          | —                |
| `impediment.escalate` | —            | ✓                | ✓               | —              | ✓           | —           | —          | —                |
| `*.read`              | all          | all              | art             | art            | team        | team        | own        | aggregated       |

### 7.3 Two-Layer Enforcement

Authorization runs in two layers:

#### Layer 1: PostgreSQL Row-Level Security (RLS) — Final Guardrail

Every table with tenant data has RLS enabled. Policies use the JWT claims set by Supabase Auth:

```sql
-- Example: only see initiatives in your tenant
CREATE POLICY tenant_isolation ON initiatives
  FOR ALL
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- Example: Task Owners can only update tasks where they are an assignee
CREATE POLICY task_owner_update ON initiatives
  FOR UPDATE
  USING (
    level = 3
    AND auth.uid()::text = ANY(assignee_ids)
    AND tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  );
```

If application code is buggy and tries to read another tenant's data, RLS returns zero rows. Fail-safe by design.

#### Layer 2: Application-Layer Authorization Guards

Domain services and route handlers run authorization checks before issuing the query. This produces explicit `403 Forbidden` responses with structured error details (RLS alone returns empty results, which is poor UX).

```typescript
// src/server/auth/authorize.ts
export async function authorize(
  action: Action,
  resource: Resource,
  principal: Principal,
): Promise<AuthorizationDecision> {
  const rules = policies[action] ?? [];
  for (const rule of rules) {
    if (rule.matches(resource, principal)) return { allow: true };
  }
  return {
    allow: false,
    reason: `Principal ${principal.id} lacks permission for ${action} on ${resource.id}`,
  };
}

// Used in a Route Handler:
export async function POST(req: NextRequest) {
  const principal = await getPrincipal(req);
  const input = createFeatureSchema.parse(await req.json());
  const decision = await authorize("feature.create", input, principal);
  if (!decision.allow) return forbidden(decision.reason);
  // ... proceed with creation
}
```

### 7.4 Visibility Scopes

Stored per-user in a `user_role_assignments` table:

```typescript
export interface RoleAssignment {
  userId: UserId;
  tenantId: TenantId;
  role: Role;
  scope: {
    valueStreamIds: ValueStreamId[]; // empty = all in tenant
    artIds: ArtId[]; // empty = all in scope
    teamIds: TeamId[]; // empty = all in scope
  };
}
```

Scopes are loaded into the JWT custom claims on login and included in every Supabase RLS policy.

---

## 8. API Design

### 8.1 API Surface

Pulse exposes its API via two complementary mechanisms in Next.js 15:

1. **Server Actions** for form submissions and progressive enhancement (preferred default)
2. **Route Handlers** (`app/api/**/route.ts`) for external integrations and TanStack Query consumers

Both share the same domain services. The choice is about transport, not domain logic.

### 8.2 Conventions

- Errors: [RFC 7807 Problem Details](https://datatracker.ietf.org/doc/html/rfc7807) (`application/problem+json`)
- Pagination: cursor-based, `?cursor=...&limit=50` (max 200)
- Mutations: `Idempotency-Key` header required (Server Actions: form-action key)
- Authentication: Supabase session cookie (set by middleware) or `Authorization: Bearer <jwt>` for service tokens
- Versioning: `/api/v1/`. No breaking changes within a version.

### 8.3 Endpoint Catalog

```
# Initiatives
GET    /api/v1/initiatives                    List with filters
POST   /api/v1/initiatives                    Create (level-discriminated)
GET    /api/v1/initiatives/:id                Retrieve single
PATCH  /api/v1/initiatives/:id                Partial update
DELETE /api/v1/initiatives/:id                Soft delete
POST   /api/v1/initiatives/:id/transitions    Stage-gate transition
GET    /api/v1/initiatives/:id/children       Direct children
GET    /api/v1/initiatives/:id/descendants    Full subtree (paginated)
POST   /api/v1/initiatives/:id/dependencies   Link dependency
DELETE /api/v1/initiatives/:id/dependencies/:linkId

# Program Increments
GET    /api/v1/pis
POST   /api/v1/pis                            Portfolio Editor only
GET    /api/v1/pis/:id
GET    /api/v1/pis/:id/board                  Program board view
POST   /api/v1/pis/:id/start
POST   /api/v1/pis/:id/complete

# WSJF
PUT    /api/v1/initiatives/:id/wsjf
GET    /api/v1/wsjf/leaderboard

# Reporting
GET    /api/v1/reports/portfolio-health
GET    /api/v1/reports/pi-velocity
GET    /api/v1/reports/dependencies/graph

# Administration
GET    /api/v1/admin/users                    Tenant Admin only
POST   /api/v1/admin/users
PATCH  /api/v1/admin/users/:id/roles
GET    /api/v1/admin/audit-log

# Integrations
POST   /api/v1/integrations/jira/webhook      Inbound from Jira
POST   /api/v1/integrations/ado/webhook       Inbound from Azure DevOps
```

### 8.4 Example Route Handler

```typescript
// src/app/api/v1/initiatives/route.ts
import { NextRequest } from "next/server";
import { createInitiativeSchema } from "@/domain/schemas/initiative";
import { getPrincipal } from "@/server/auth/principal";
import { authorize } from "@/server/auth/authorize";
import { initiativeService } from "@/server/services/initiative";
import { problemJson } from "@/server/http/problem";

export async function POST(req: NextRequest) {
  const principal = await getPrincipal(req);
  if (!principal) return problemJson(401, "unauthenticated");

  // Idempotency
  const idemKey = req.headers.get("Idempotency-Key");
  if (!idemKey) return problemJson(400, "idempotency-key-required");

  // Validate
  const body = await req.json();
  const parsed = createInitiativeSchema.safeParse(body);
  if (!parsed.success) {
    return problemJson(422, "validation-failed", {
      errors: parsed.error.issues,
    });
  }

  // Authorize
  const action = `${parsed.data.level.toLowerCase()}.create` as const;
  const decision = await authorize(action, parsed.data, principal);
  if (!decision.allow) return problemJson(403, "forbidden", { reason: decision.reason });

  // Execute
  const result = await initiativeService.create(parsed.data, {
    principal,
    idempotencyKey: idemKey,
  });

  return Response.json(result, {
    status: 201,
    headers: { Location: `/api/v1/initiatives/${result.id}` },
  });
}
```

### 8.5 Example Server Action

```typescript
// src/app/(dashboard)/features/_actions/create-feature.ts
"use server";

import { revalidatePath } from "next/cache";
import { createFeatureSchema } from "@/domain/schemas/initiative";
import { getPrincipal } from "@/server/auth/principal";
import { authorize } from "@/server/auth/authorize";
import { initiativeService } from "@/server/services/initiative";

export async function createFeature(formData: FormData) {
  const principal = await getPrincipal();
  const parsed = createFeatureSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.flatten() };
  }

  const decision = await authorize("feature.create", parsed.data, principal);
  if (!decision.allow) return { ok: false, reason: decision.reason };

  await initiativeService.create(parsed.data, { principal });
  revalidatePath("/art/[artId]/pi/[piId]/features", "page");
  return { ok: true };
}
```

### 8.6 Error Response Example

```http
HTTP/1.1 422 Unprocessable Entity
Content-Type: application/problem+json

{
  "type": "https://pulse.example.com/errors/hierarchy-violation",
  "title": "Invalid parent-child level relationship",
  "status": 422,
  "detail": "A FEATURE (level=1) must have a parent of level EPIC (level=0). Got parent of level FEATURE.",
  "instance": "/api/v1/initiatives",
  "violatedConstraint": "I1_level_strictness",
  "expectedParentLevel": "EPIC",
  "actualParentLevel": "FEATURE",
  "traceId": "0af7651916cd43dd8448eb211c80319c"
}
```

---

## 9. Data Model

### 9.1 Prisma Schema

The schema lives at `/prisma/schema.prisma`. Custom output path keeps generated client out of `node_modules`.

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Tenant {
  id          String   @id @default(uuid()) @db.Uuid
  name        String
  region      String   @db.VarChar(10)
  createdAt   DateTime @default(now()) @map("created_at")

  valueStreams ValueStream[]
  arts         Art[]
  initiatives  Initiative[]
  users        UserRoleAssignment[]

  @@map("tenants")
}

model ValueStream {
  id          String   @id @default(uuid()) @db.Uuid
  tenantId    String   @map("tenant_id") @db.Uuid
  name        String
  description String?
  budgetAmount    Decimal? @map("budget_amount") @db.Decimal(14, 2)
  budgetCurrency  String?  @map("budget_currency") @db.Char(3)
  createdAt   DateTime @default(now()) @map("created_at")

  tenant      Tenant   @relation(fields: [tenantId], references: [id])
  arts        Art[]
  epics       Initiative[] @relation("EpicValueStream")

  @@unique([tenantId, name])
  @@map("value_streams")
}

model Art {
  id              String   @id @default(uuid()) @db.Uuid
  tenantId        String   @map("tenant_id") @db.Uuid
  valueStreamId   String   @map("value_stream_id") @db.Uuid
  name            String
  piCadenceWeeks  Int      @default(10) @map("pi_cadence_weeks")
  createdAt       DateTime @default(now()) @map("created_at")

  tenant       Tenant       @relation(fields: [tenantId], references: [id])
  valueStream  ValueStream  @relation(fields: [valueStreamId], references: [id])
  pis          ProgramIncrement[]
  features     Initiative[] @relation("FeatureArt")

  @@unique([tenantId, name])
  @@map("arts")
}

model ProgramIncrement {
  id        String   @id @default(uuid()) @db.Uuid
  tenantId  String   @map("tenant_id") @db.Uuid
  artId     String   @map("art_id") @db.Uuid
  name      String
  startDate DateTime @map("start_date") @db.Date
  endDate   DateTime @map("end_date") @db.Date
  status    String   @default("planned")

  art          Art         @relation(fields: [artId], references: [id])
  sprints      Sprint[]
  initiatives  Initiative[]

  @@map("program_increments")
}

model Sprint {
  id         String   @id @default(uuid()) @db.Uuid
  tenantId   String   @map("tenant_id") @db.Uuid
  piId       String   @map("pi_id") @db.Uuid
  teamId     String   @map("team_id") @db.Uuid
  indexInPi  Int      @map("index_in_pi")
  startDate  DateTime @map("start_date") @db.Date
  endDate    DateTime @map("end_date") @db.Date

  pi          ProgramIncrement @relation(fields: [piId], references: [id])
  initiatives Initiative[]

  @@map("sprints")
}

model Initiative {
  id          String   @id @default(uuid()) @db.Uuid
  tenantId    String   @map("tenant_id") @db.Uuid
  level       Int      // 0=EPIC, 1=FEATURE, 2=STORY, 3=TASK
  parentId    String?  @map("parent_id") @db.Uuid
  path        String   // materialized path

  title       String
  description String?  @db.Text
  ownerId     String   @map("owner_id") @db.Uuid
  assigneeIds String[] @map("assignee_ids") @db.Uuid

  // Level-specific FKs
  valueStreamId String?  @map("value_stream_id") @db.Uuid  // EPIC
  artId         String?  @map("art_id") @db.Uuid           // FEATURE
  piId          String?  @map("pi_id") @db.Uuid            // FEATURE, STORY
  sprintId      String?  @map("sprint_id") @db.Uuid        // STORY

  // WSJF (FEATURE only)
  wsjfBusinessValue   Int?     @map("wsjf_business_value")
  wsjfTimeCriticality Int?     @map("wsjf_time_criticality")
  wsjfRiskReduction   Int?     @map("wsjf_risk_reduction")
  wsjfJobSize         Int?     @map("wsjf_job_size")
  wsjfComputed        Decimal? @map("wsjf_computed") @db.Decimal(5, 2)

  // Story points (STORY only)
  storyPoints   Int?     @map("story_points")

  // Task estimate (TASK only)
  estimateHours Decimal? @map("estimate_hours") @db.Decimal(5, 1)

  stageGate   String   @default("L0") @map("stage_gate")
  status      String   @default("draft")

  createdAt   DateTime @default(now()) @map("created_at")
  createdBy   String   @map("created_by") @db.Uuid
  updatedAt   DateTime @updatedAt @map("updated_at")
  updatedBy   String   @map("updated_by") @db.Uuid
  deletedAt   DateTime? @map("deleted_at")

  tenant      Tenant            @relation(fields: [tenantId], references: [id])
  parent      Initiative?       @relation("Hierarchy", fields: [parentId], references: [id])
  children    Initiative[]      @relation("Hierarchy")
  valueStream ValueStream?      @relation("EpicValueStream", fields: [valueStreamId], references: [id])
  art         Art?              @relation("FeatureArt", fields: [artId], references: [id])
  pi          ProgramIncrement? @relation(fields: [piId], references: [id])
  sprint      Sprint?           @relation(fields: [sprintId], references: [id])

  dependenciesOut Dependency[] @relation("From")
  dependenciesIn  Dependency[] @relation("To")

  @@index([tenantId])
  @@index([parentId])
  @@index([piId])
  @@index([ownerId, status])
  @@index([path])
  @@map("initiatives")
}

model Dependency {
  id        String   @id @default(uuid()) @db.Uuid
  tenantId  String   @map("tenant_id") @db.Uuid
  fromId    String   @map("from_id") @db.Uuid
  toId      String   @map("to_id") @db.Uuid
  type      String   // 'blocks' | 'depends_on' | 'relates_to'
  createdAt DateTime @default(now()) @map("created_at")
  createdBy String   @map("created_by") @db.Uuid

  from Initiative @relation("From", fields: [fromId], references: [id])
  to   Initiative @relation("To",   fields: [toId],   references: [id])

  @@unique([fromId, toId, type])
  @@map("dependencies")
}

model AuditEvent {
  id           String   @id @default(uuid()) @db.Uuid
  tenantId     String   @map("tenant_id") @db.Uuid
  occurredAt   DateTime @default(now()) @map("occurred_at")
  actorId      String   @map("actor_id") @db.Uuid
  action       String
  resourceType String   @map("resource_type")
  resourceId   String   @map("resource_id") @db.Uuid
  changes      Json?
  ipAddress    String?  @map("ip_address") @db.Inet
  userAgent    String?  @map("user_agent")
  traceId      String?  @map("trace_id")

  @@index([tenantId, occurredAt(sort: Desc)])
  @@index([resourceType, resourceId, occurredAt(sort: Desc)])
  @@map("audit_events")
}

model UserRoleAssignment {
  id              String   @id @default(uuid()) @db.Uuid
  userId          String   @map("user_id") @db.Uuid
  tenantId        String   @map("tenant_id") @db.Uuid
  role            String
  valueStreamIds  String[] @map("value_stream_ids") @db.Uuid
  artIds          String[] @map("art_ids") @db.Uuid
  teamIds         String[] @map("team_ids") @db.Uuid
  createdAt       DateTime @default(now()) @map("created_at")

  tenant Tenant @relation(fields: [tenantId], references: [id])

  @@unique([userId, tenantId, role])
  @@map("user_role_assignments")
}

model OutboxEvent {
  id          String   @id @default(uuid()) @db.Uuid
  tenantId    String   @map("tenant_id") @db.Uuid
  type        String
  payload     Json
  status      String   @default("pending") // pending | processed | failed
  attempts    Int      @default(0)
  lastError   String?  @map("last_error")
  createdAt   DateTime @default(now()) @map("created_at")
  processedAt DateTime? @map("processed_at")

  @@index([status, createdAt])
  @@map("outbox_events")
}
```

### 9.2 Raw SQL Constraints (Prisma Migration)

Some invariants cannot be expressed in Prisma alone. They live in raw SQL migrations:

```sql
-- migrations/20260520_invariants.sql

ALTER TABLE initiatives
  ADD CONSTRAINT i1_level_range CHECK (level BETWEEN 0 AND 3),
  ADD CONSTRAINT i2_epic_no_parent
    CHECK ((level = 0 AND parent_id IS NULL) OR (level > 0 AND parent_id IS NOT NULL)),
  ADD CONSTRAINT i3_wsjf_only_features
    CHECK ((level = 1) = (wsjf_business_value IS NOT NULL)),
  ADD CONSTRAINT i4_pi_for_feature_story
    CHECK ((level IN (1,2)) = (pi_id IS NOT NULL)),
  ADD CONSTRAINT i5_sprint_for_story
    CHECK ((level = 2) = (sprint_id IS NOT NULL)),
  ADD CONSTRAINT i_story_points_only_for_stories
    CHECK ((level = 2) = (story_points IS NOT NULL)),
  ADD CONSTRAINT i_estimate_only_for_tasks
    CHECK ((level = 3) = (estimate_hours IS NOT NULL));
```

### 9.3 Row-Level Security

RLS policies are managed in raw SQL migrations:

```sql
-- migrations/20260521_rls.sql

ALTER TABLE initiatives          ENABLE ROW LEVEL SECURITY;
ALTER TABLE dependencies         ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events         ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_increments   ENABLE ROW LEVEL SECURITY;
ALTER TABLE arts                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE value_streams        ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_initiatives ON initiatives
  FOR ALL
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY tenant_isolation_dependencies ON dependencies
  FOR ALL
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- Audit log is read-only at the row level (no UPDATE/DELETE policies)
CREATE POLICY tenant_isolation_audit_read ON audit_events
  FOR SELECT
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY audit_insert_any ON audit_events
  FOR INSERT
  WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
```

### 9.4 Prisma + RLS

Prisma must use a per-request connection that inherits the user's auth context. The pattern:

```typescript
// src/server/db/prisma.ts
import { PrismaClient } from "@/generated/prisma";

export function createPrismaClient(userId: string, tenantId: string): PrismaClient {
  const client = new PrismaClient({
    datasourceUrl: process.env.DATABASE_URL,
  });

  return client.$extends({
    query: {
      async $allOperations({ args, query }) {
        await client.$executeRaw`SELECT set_config('request.jwt.claims', ${JSON.stringify({
          sub: userId,
          tenant_id: tenantId,
        })}, true)`;
        return query(args);
      },
    },
  }) as PrismaClient;
}
```

Used in every Route Handler / Server Action via `getPrincipal()`.

---

## 10. Frontend Architecture

### 10.1 App Router Structure

```
src/app/
├── [locale]/                            # next-intl locale segment
│   ├── (marketing)/                     # public marketing pages
│   │   └── page.tsx
│   ├── (auth)/
│   │   ├── sign-in/page.tsx
│   │   └── sign-up/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx                   # auth-guarded shell
│   │   ├── portfolio/
│   │   │   ├── page.tsx                 # Portfolio Kanban (RSC)
│   │   │   ├── epics/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [epicId]/page.tsx
│   │   │   └── value-streams/page.tsx
│   │   ├── art/[artId]/
│   │   │   ├── layout.tsx
│   │   │   ├── pi/[piId]/
│   │   │   │   ├── board/page.tsx       # Program Board
│   │   │   │   ├── dependencies/page.tsx
│   │   │   │   └── risks/page.tsx
│   │   │   └── features/[featureId]/page.tsx
│   │   ├── team/[teamId]/
│   │   │   ├── backlog/page.tsx
│   │   │   ├── sprint/[sprintId]/page.tsx
│   │   │   └── impediments/page.tsx
│   │   └── admin/
│   │       ├── users/page.tsx
│   │       └── audit-log/page.tsx
│   └── layout.tsx                       # root layout with NextIntlClientProvider
├── api/
│   └── v1/
│       ├── initiatives/route.ts
│       ├── pis/route.ts
│       └── integrations/jira/webhook/route.ts
└── (other root files)
```

### 10.2 Server vs Client Components

Default to **Server Components**. Use Client Components only when:

- The component requires `useState`, `useEffect`, event handlers, or browser APIs
- The component uses TanStack Query (must be client)
- The component uses `react-hook-form` (must be client)

Examples:

| View                               | Server / Client                                   |
| ---------------------------------- | ------------------------------------------------- |
| Portfolio Kanban (read-only board) | Server Component                                  |
| Feature edit form                  | Client Component (`react-hook-form`)              |
| Sprint Board (drag-and-drop)       | Client Component                                  |
| Audit log table                    | Server Component with Suspense                    |
| Initiative detail page             | Server Component, with Client islands for actions |

### 10.3 Server State (TanStack Query)

Server state used in Client Components flows through TanStack Query.

```typescript
// src/features/features/hooks/use-feature.ts
import { useQuery } from "@tanstack/react-query";

export function useFeature(featureId: string) {
  return useQuery({
    queryKey: ["feature", featureId],
    queryFn: () => fetch(`/api/v1/initiatives/${featureId}`).then((r) => r.json()),
    staleTime: 30_000,
  });
}
```

Query keys follow a strict hierarchy:

```
['initiative', id]
['initiative', id, 'children']
['initiative', id, 'descendants']
['pi', id]
['pi', id, 'board']
['report', name, params]
```

Invalidation rules live next to mutations in `/src/features/<area>/mutations/`.

### 10.4 Forms

All forms use `react-hook-form` with Zod resolvers. The same Zod schema validates on client and server.

```typescript
'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createFeatureSchema } from '@/domain/schemas/initiative';
import { createFeature } from '../_actions/create-feature';

export function CreateFeatureForm() {
  const form = useForm({
    resolver: zodResolver(createFeatureSchema),
    defaultValues: { /* ... */ },
  });

  const onSubmit = form.handleSubmit(async (data) => {
    const result = await createFeature(data);
    if (!result.ok) form.setError('root', { message: result.reason });
  });

  return <form onSubmit={onSubmit}>{/* ... */}</form>;
}
```

### 10.5 Styling

- Tailwind CSS v4 via PostCSS
- Design tokens defined in `globals.css` using `@theme`
- Component primitives in `src/components/ui/` (custom, not a third-party kit)
- No `:has()` polyfills; target browsers that support it natively
- Dark mode via `class` strategy

### 10.6 i18n

- `next-intl` v4 with App Router integration
- Locale segment `[locale]` at the top of the route tree
- Messages in `/messages/de.json` and `/messages/en.json`
- Server Components: `getTranslations()` from `next-intl/server`
- Client Components: `useTranslations()` from `next-intl`
- All user-facing strings in messages files — no inline literals

### 10.7 Permission-Aware UI

```tsx
// src/components/auth/permission-gate.tsx
import { ReactNode } from "react";
import { hasPermission } from "@/server/auth/check";

interface Props {
  action: string;
  resource?: { tenantId: string; [key: string]: unknown };
  children: ReactNode;
  fallback?: ReactNode;
}

export async function PermissionGate({ action, resource, children, fallback = null }: Props) {
  const allowed = await hasPermission(action, resource);
  return allowed ? <>{children}</> : <>{fallback}</>;
}
```

Used in Server Components. The Client-side equivalent uses a hook fed by a preloaded permissions object passed via props or context.

---

## 11. Integration Surface

### 11.1 Outbound

| Target          | Mechanism                   | Direction                           |
| --------------- | --------------------------- | ----------------------------------- |
| Jira            | REST API + webhooks         | Bidirectional (Story ↔ Issue)       |
| Azure DevOps    | REST API + Service Hooks    | Bidirectional (Story ↔ Work Item)   |
| GitLab          | REST API + webhooks         | Bidirectional (Story ↔ Issue)       |
| Slack           | Incoming webhook            | Outbound notifications              |
| Microsoft Teams | Incoming webhook            | Outbound notifications              |
| Miro / Mural    | Embed + deep-link           | Embed boards, deep-link to Features |
| Email           | Nodemailer (SMTP or Resend) | Outbound notifications, digests     |

### 11.2 Inbound Webhooks

```
POST  /api/v1/integrations/jira/webhook
Headers:
  X-Pulse-Signature: sha256=...
  X-Pulse-Tenant: <tenant_id>

Body: (Jira webhook payload)
```

Webhook signatures use HMAC-SHA256 with per-tenant shared secrets. Replay protection via monotonic timestamps; reject events older than 5 minutes.

### 11.3 Outbox Pattern

External calls are decoupled via an outbox table:

1. Mutation writes to `initiatives` and `outbox_events` in one transaction
2. Nightly Vercel Cron processes pending outbox events (1 invocation/day on Hobby tier)
3. Failed events are retried with exponential backoff (max 5 attempts)
4. Permanent failures alert via Sentry

For real-time UX, Supabase Realtime broadcasts changes to subscribed clients directly — outbox is for downstream system sync only.

### 11.4 Email

`Nodemailer` with two transports configurable via env:

- **Resend** for production (default)
- **SMTP** for self-managed setups or staging

Templates use MJML compiled at build time. All emails:

- Localized via `next-intl` server APIs
- Carry a `List-Unsubscribe` header
- Tracked via Sentry for delivery failures

---

## 12. Security & Compliance

### 12.1 Authentication

Supabase Auth via `@supabase/ssr`. Middleware refreshes the session cookie on every request.

```typescript
// src/middleware.ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name) => req.cookies.get(name)?.value,
        set: (name, value, options) => res.cookies.set({ name, value, ...options }),
        remove: (name, options) => res.cookies.set({ name, value: "", ...options }),
      },
    },
  );
  await supabase.auth.getUser();
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

Supported identity sources via Supabase:

- Email/password
- OIDC (Google, Microsoft, generic OIDC)
- SAML 2.0 (Supabase Pro feature; required for enterprise tenants)

### 12.2 Threat Model Highlights

| Threat                               | Mitigation                                                                 |
| ------------------------------------ | -------------------------------------------------------------------------- |
| Cross-tenant data leakage            | RLS on every tenant-scoped table; tenant_id in every Prisma query          |
| Privilege escalation                 | Role assignments audit-logged; only Tenant Admin can assign                |
| WSJF manipulation for backlog gaming | All WSJF changes audit-logged with before/after                            |
| Hidden work via deletion             | Soft-delete only; 30-day recovery window; immutable audit log              |
| Webhook replay                       | HMAC signatures + monotonic timestamps; reject events older than 5 minutes |
| Token theft                          | Supabase access tokens are short-lived (1h); refresh tokens rotated on use |
| CSRF on Server Actions               | Next.js Server Actions are CSRF-protected by default (origin check)        |
| SQL injection                        | Prisma parameterizes all queries; no raw concatenation                     |

### 12.3 Data Classification

| Class        | Examples                    | At Rest                                | Access            |
| ------------ | --------------------------- | -------------------------------------- | ----------------- |
| Public       | Marketing pages             | None                                   | Anonymous         |
| Internal     | Aggregate metrics           | TLS in transit                         | Authenticated     |
| Confidential | Initiatives, WSJF, comments | Supabase encryption + RLS              | Role + scope      |
| Restricted   | Audit logs, user PII        | Supabase encryption + RLS + admin-only | Tenant Admin only |

### 12.4 Compliance Targets

- **SOC 2 Type II** — pursue certification within 12 months of GA (Supabase is SOC 2 certified; inherits)
- **GDPR** — user data export and erasure endpoints from day one; DPA template available
- **Data residency** — Supabase project per region (EU / US); tenant pinned at provisioning

### 12.5 Audit Logging

Every state-changing action emits an `AuditEvent`. Audit events are:

- Written in the same Prisma transaction as the mutation
- Append-only (RLS blocks UPDATE/DELETE; only Tenant Admin can SELECT)
- Retained for 7 years (lifecycle managed via Supabase Storage cold tier for archives)

---

## 13. Observability

### 13.1 Stack

| Pillar      | Tool                                              |
| ----------- | ------------------------------------------------- |
| Errors      | Sentry (Next.js SDK, server + client + edge)      |
| Performance | Vercel Speed Insights + Sentry Performance        |
| Web vitals  | Vercel Analytics                                  |
| Logs        | `console.*` to Vercel logs + Sentry breadcrumbs   |
| Traces      | Sentry distributed tracing with W3C trace context |

### 13.2 Key Metrics (SLIs)

| Metric                                   | SLO     |
| ---------------------------------------- | ------- |
| API availability (5xx rate)              | < 0.1%  |
| API latency p95 (read endpoints)         | < 200ms |
| API latency p95 (write endpoints)        | < 400ms |
| Authorization decision latency p95       | < 50ms  |
| Web Vitals (LCP, p75)                    | < 2.5s  |
| Web Vitals (CLS, p75)                    | < 0.1   |
| Web Vitals (INP, p75)                    | < 200ms |
| Outbox processing success rate           | > 99.5% |
| Webhook delivery success (first attempt) | > 99%   |

### 13.3 Tracing

Every request carries a `traceId` propagated end-to-end via the Sentry SDK + W3C trace context. The trace ID appears in:

- All Sentry events
- All audit events
- All error responses

### 13.4 Alerting

- Sentry Issues with custom alert rules: P1 errors page on-call immediately
- Vercel deployment failures notify Slack channel
- Outbox processing failures (> 10 in nightly run) alert via Sentry

---

## 14. Testing Strategy

### 14.1 Test Pyramid

```
              ┌─────────────────┐
              │    E2E (5%)     │   Playwright, critical journeys
              ├─────────────────┤
              │  Integ (25%)    │   Vitest + Prisma + MSW
              ├─────────────────┤
              │   Unit (70%)    │   Vitest, pure functions
              └─────────────────┘
```

### 14.2 Test Categories

| Category          | Tool                           | What it covers                                                          |
| ----------------- | ------------------------------ | ----------------------------------------------------------------------- |
| Unit              | Vitest                         | Pure domain logic, Zod schema correctness, WSJF math, path manipulation |
| Property-based    | Vitest + fast-check            | Hierarchy invariants under generated inputs                             |
| Integration       | Vitest + test PostgreSQL + MSW | Service + DB; external HTTP mocked by MSW                               |
| Contract          | Vitest                         | API conforms to OpenAPI spec (generated from Zod)                       |
| Authorization     | Vitest                         | Table-driven `(role × action × resource_state)`                         |
| E2E               | Playwright                     | Critical user journeys in real browsers against preview deployments     |
| Visual regression | Playwright snapshots           | Component-level UI baselines                                            |
| Accessibility     | Playwright + axe-core          | WCAG 2.1 AA on every E2E run                                            |

### 14.3 Test Database

Integration tests use a real PostgreSQL via Docker:

- `docker compose -f docker-compose.test.yml up` spins up a Postgres instance
- Each test file gets a fresh schema via `prisma migrate reset --skip-seed`
- RLS policies are applied; tests run with seeded JWT contexts

### 14.4 MSW for External APIs

Jira / Azure DevOps / Resend integrations are mocked at the network layer using Mock Service Worker:

```typescript
// src/test/msw/handlers.ts
import { http, HttpResponse } from "msw";

export const handlers = [
  http.post("https://*.atlassian.net/rest/api/3/issue", () =>
    HttpResponse.json({ key: "MOCK-1", id: "10001" }, { status: 201 }),
  ),
  http.post("https://api.resend.com/emails", () => HttpResponse.json({ id: "resend-mock-id" })),
];
```

### 14.5 Coverage Targets

| Layer                                              | Coverage                 |
| -------------------------------------------------- | ------------------------ |
| Domain layer (`src/domain/`)                       | ≥ 90% line, ≥ 85% branch |
| Server services (`src/server/`)                    | ≥ 80% line               |
| Route Handlers (`src/app/api/`)                    | ≥ 70% line               |
| UI components (`src/components/`, `src/features/`) | ≥ 70% line               |

Coverage is necessary, not sufficient. PRs require meaningful assertions, not just executed lines.

### 14.6 CI Pipeline (GitHub Actions)

```yaml
# .github/workflows/ci.yml (excerpt)
name: ci
on: [pull_request, push]
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm prisma generate
      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm test:unit -- --coverage
      - run: pnpm test:integration
      - run: pnpm build
  e2e:
    runs-on: ubuntu-latest
    needs: validate
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - run: pnpm install --frozen-lockfile
      - run: pnpm playwright install --with-deps
      - run: pnpm test:e2e
```

---

## 15. Project Structure

```
pulse/
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── deploy.yml
├── docs/
│   ├── adr/                           # Architecture Decision Records
│   │   ├── 0001-next-js-app-router.md
│   │   ├── 0002-typescript-strict.md
│   │   └── ...
│   ├── concepts/
│   │   └── pulse-technical-concept.md  # this document
│   ├── runbooks/
│   └── security/
│       └── threat-model.md
├── messages/
│   ├── de.json
│   └── en.json
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── public/
├── src/
│   ├── app/                            # Next.js App Router
│   │   ├── [locale]/
│   │   │   ├── (marketing)/
│   │   │   ├── (auth)/
│   │   │   └── (dashboard)/
│   │   ├── api/v1/
│   │   └── layout.tsx
│   ├── components/
│   │   ├── ui/                         # primitive components
│   │   └── auth/
│   │       └── permission-gate.tsx
│   ├── features/                       # feature-sliced organization
│   │   ├── portfolio/
│   │   ├── art/
│   │   ├── team/
│   │   └── admin/
│   ├── domain/                         # pure domain logic
│   │   ├── types.ts
│   │   ├── schemas/                    # Zod schemas
│   │   ├── roles.ts
│   │   └── wsjf.ts
│   ├── server/                         # server-only code
│   │   ├── auth/
│   │   │   ├── principal.ts
│   │   │   ├── authorize.ts
│   │   │   └── policies/
│   │   ├── services/
│   │   │   ├── initiative.ts
│   │   │   ├── pi.ts
│   │   │   └── reporting.ts
│   │   ├── repositories/
│   │   ├── db/
│   │   │   └── prisma.ts
│   │   ├── email/
│   │   ├── integrations/
│   │   │   ├── jira/
│   │   │   └── ado/
│   │   ├── outbox/
│   │   └── http/
│   │       └── problem.ts
│   ├── generated/
│   │   └── prisma/                     # Prisma client output (gitignored)
│   ├── i18n/
│   │   └── routing.ts
│   ├── lib/                            # shared utilities (client-safe)
│   ├── test/                           # test fixtures and helpers
│   │   ├── msw/
│   │   ├── fixtures/
│   │   └── setup.ts
│   └── middleware.ts
├── tests/
│   └── e2e/                            # Playwright specs
├── .env.example
├── .eslintrc.json
├── next.config.ts
├── package.json
├── playwright.config.ts
├── postcss.config.mjs
├── tailwind.config.ts
├── tsconfig.json
└── vitest.config.ts
```

---

## 16. Delivery Roadmap

### 16.1 Phases

| Phase                         | Duration | Exit Criteria                                                                         |
| ----------------------------- | -------- | ------------------------------------------------------------------------------------- |
| **P0 — Inception**            | 2 weeks  | Repo scaffolded, ADRs ratified, dev environment running, Supabase project provisioned |
| **P1 — Domain Core**          | 6 weeks  | Prisma schema applied, hierarchy invariants tested, domain services 90% covered       |
| **P2 — Authorization**        | 3 weeks  | RLS policies live, all 10 roles tested, performance targets met                       |
| **P3 — API & Server Actions** | 4 weeks  | All v1 endpoints behind auth, OpenAPI generated from Zod, integration tests green     |
| **P4 — Frontend Core**        | 6 weeks  | Portfolio, ART, Team views shippable; i18n complete (DE + EN); WCAG 2.1 AA verified   |
| **P5 — Integrations**         | 4 weeks  | Jira + ADO bidirectional sync working in pilot; outbox processing stable              |
| **P6 — Pilot**                | 6 weeks  | 3 pilot tenants in production, no P1 incidents for 2 weeks                            |
| **P7 — GA**                   | —        | Self-service onboarding, billing integration, documentation complete                  |

### 16.2 Critical Path

`P1 → P2 → P3 → P4 → P6`. P5 integrations run in parallel with P4 frontend.

### 16.3 Team Shape

- 1 Engineering Lead / Architect
- 4 Full-Stack Engineers (Next.js + Prisma)
- 1 Platform / DevOps Engineer
- 1 Product Manager
- 1 SAFe SPC (fractional, consulting)
- 1 Designer
- 1 QA / Test Automation Engineer

### 16.4 Risk Register

| Risk                                          | Impact | Likelihood | Mitigation                                                             |
| --------------------------------------------- | ------ | ---------- | ---------------------------------------------------------------------- |
| Vercel Hobby tier outgrown before paid commit | Medium | High       | Plan upgrade to Pro at P5; budget allocated                            |
| Supabase RLS performance at scale             | High   | Medium     | Benchmark in P2 with realistic data volumes; consider PgBouncer        |
| Prisma + RLS connection patterns immature     | Medium | Medium     | Spike in P0 week 1 to validate the per-request client pattern          |
| Jira API rate limits during bulk sync         | Medium | High       | Adaptive rate limiting + queue-based retry in outbox processor         |
| 1 cron/day insufficient for outbox            | Medium | Medium     | Batch all integrations into single nightly run; upgrade tier if needed |
| Pilot customer scope creep                    | Medium | High       | Strict pilot charter; non-pilot features deferred to GA backlog        |

---

## 17. Open Questions

The stack is ratified. The questions below are product/scoping decisions, not stack decisions.

| #   | Question                                                                          | Owner                 | Decision Deadline |
| --- | --------------------------------------------------------------------------------- | --------------------- | ----------------- |
| 1   | Support SAFe Large Solution (Capabilities, Solution Trains) in v1 or defer to v2? | Product               | End of P0         |
| 2   | Allow WSJF on Epics (non-standard SAFe) as an opt-in?                             | Product + SPC         | End of P0         |
| 3   | First integration target: Jira, ADO, or both in parallel?                         | Product               | End of P0         |
| 4   | Pricing model: per-seat, per-ART, or value-based?                                 | Product + Commercial  | Before P7         |
| 5   | Self-service tenant provisioning at GA, or sales-led only?                        | Product + Commercial  | Before P7         |
| 6   | Real-time updates for Sprint/Program Board — Supabase Realtime in P4 or defer?    | Engineering           | P3 week 2         |
| 7   | Email digest cadence (daily/weekly) given 1 cron/day limit                        | Product + Engineering | End of P0         |
| 8   | Locale roadmap beyond DE/EN (FR, ES, others)?                                     | Product               | Before P7         |

---

## 18. Appendix

### 18.1 Glossary

| Term      | Definition                                                   |
| --------- | ------------------------------------------------------------ |
| ADR       | Architecture Decision Record                                 |
| ART       | Agile Release Train — 5-12 teams on a common mission         |
| DDD       | Domain-Driven Design                                         |
| Epic      | Largest unit of work; spans multiple PIs                     |
| Feature   | ART-level work item; fits within a single PI                 |
| LPM       | Lean Portfolio Management                                    |
| MSW       | Mock Service Worker                                          |
| NFR       | Non-Functional Requirement                                   |
| OIDC      | OpenID Connect                                               |
| PI        | Program Increment — 8-12 week timebox                        |
| RBAC      | Role-Based Access Control                                    |
| RFC       | Request for Comments                                         |
| RLS       | Row-Level Security                                           |
| RSC       | React Server Components                                      |
| RTE       | Release Train Engineer                                       |
| SAFe      | Scaled Agile Framework                                       |
| SLI / SLO | Service Level Indicator / Objective                          |
| SPC       | SAFe Program Consultant                                      |
| Story     | Team-level work item; fits within a single sprint            |
| Task      | Smallest unit of work; assigned to an individual contributor |
| WSJF      | Weighted Shortest Job First                                  |

### 18.2 References

- [Next.js 15 Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Prisma 6 Documentation](https://www.prisma.io/docs)
- [TanStack Query v5](https://tanstack.com/query/latest)
- [next-intl](https://next-intl-docs.vercel.app/)
- [Scaled Agile Framework — Essential SAFe](https://framework.scaledagile.com/essential-safe)
- [RFC 7807 — Problem Details for HTTP APIs](https://datatracker.ietf.org/doc/html/rfc7807)
- [W3C Trace Context](https://www.w3.org/TR/trace-context/)
- [WCAG 2.1 AA](https://www.w3.org/TR/WCAG21/)

### 18.3 Document Conventions

- "MUST", "SHOULD", "MAY" follow [RFC 2119](https://datatracker.ietf.org/doc/html/rfc2119) semantics
- Code examples are TypeScript with the project's actual import paths
- All paths are relative to the repository root unless otherwise stated

### 18.4 Changelog

| Version | Date       | Author           | Notes                                                             |
| ------- | ---------- | ---------------- | ----------------------------------------------------------------- |
| 0.1     | 2026-05-16 | Engineering Lead | Initial draft (stack-agnostic)                                    |
| 0.2     | 2026-05-16 | Engineering Lead | Stack ratified: Next.js 15, Supabase, Prisma 6, Tailwind v4, etc. |

---

**End of document.**
