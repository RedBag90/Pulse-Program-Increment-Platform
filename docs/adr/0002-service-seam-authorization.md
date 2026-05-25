# ADR-0002: Scope is enforced at the service seam, not the action factory

- Status: accepted
- Date: 2026-05-24

## Context

Authorization runs in two conceptual places:

1. The **action factory** (`createServerAction`) calls `authorize(action,
resource(input, principal), principal)` _before_ the service runs. Its
   `resource` builder is synchronous and sees only the raw form input.
2. The **service** loads the target row and mutates it.

`scopeSatisfied` treats a **missing** scope field as "no restriction applies"
(`AuthResource` fields are optional). For by-id mutations the action's `resource`
builder cannot supply scope fields — e.g. `updateEpicAction` passes only
`{ tenantId }`. The `value_stream`-scoped grant for a `value_stream_owner` was
therefore satisfied **vacuously**: a value-stream owner could edit an Epic in any
stream of their tenant. Meanwhile `createEpicAction` _does_ pass `valueStreamId`
(it is in the input) and enforces the scope — so create and update were
inconsistent. The create action's own comment states the intent: a value-stream
owner should be confined to their stream.

## Decision

The **service seam is the authoritative, scope-aware check**. After a service
loads the row, it calls `authorizeResource(principal, action, resource)` with the
row's _real_ scope fields and returns a `forbidden` domain error on denial. The
factory's `authorize` stays as a cheap early reject (role + any input-available
scope); it is no longer relied on for scope correctness.

Applied where the loaded row carries its own scope key:

- **`epic.update` family** (`updateEpic`, `saveBenefitHypothesis`,
  `saveBusinessCase`, `saveTimeline`) — `value_stream` scope from the Epic's
  `valueStreamId`.
- **`value_stream.update`** — the row id is the scope key.

`authorize` / `scopeSatisfied` are now covered by unit tests
(`src/server/auth/__tests__/authorize.test.ts`), including a test that pins the
"missing field ⇒ vacuous" behaviour so the reason for the service-seam check is
explicit.

## Deferred (follow-up, not done here)

`story.update`/`story.delete` and `task.edit` carry an `art` scope, and Tasks a
`team`/`own` scope, but the **`artId` is not on the row** — Stories/Tasks are
created via `createChildInitiative`, which never sets `artId`; the owning ART
lives on an ancestor (Story → Feature, Task → Story → Feature). Enforcing those
scopes needs an ancestor walk to resolve the ART, which is a larger change with no
local integration coverage yet. Tracked as follow-up. `dependency.*` (`team`
scope across two endpoints) is likewise deferred. Until then these remain
role-gated with best-effort scope, backstopped by tenant RLS.

## Consequences

- Value-stream owners are now correctly confined to their own streams for Epic
  edits and value-stream edits. No other role's reach changes (unscoped grants
  such as `epic_owner`/`portfolio_manager` are unaffected).
- This is behaviour-changing: a value-stream owner editing a foreign-stream Epic,
  previously allowed, is now denied. Integration/auth tests (which require the
  Postgres test DB) should assert this on CI.
- Resource derivation now exists in two places (factory from input, service from
  row). The service is authoritative; the factory is a pre-filter. A future
  refactor could let the factory defer scope entirely to the service.
