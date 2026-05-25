# ADR-0004: No central "create initiative" input schema — edges validate independently

- Status: accepted
- Date: 2026-05-25

## Context

`src/domain/schemas/initiative.ts` carried a set of create-input schemas —
`createEpicSchema`, `createFeatureSchema`, `createStorySchema`,
`createTaskSchema`, the discriminated union `createInitiativeSchema`, and the
inferred `Create*Input` types — that looked like the canonical input contract
for creating Initiatives.

An architecture review found they were **orphaned and stale**:

- **Orphaned:** nothing imported them. The only consumed exports from the module
  are `fibonacci`, `computeWsjf`/`wsjfInputSchema`, and `businessCaseSchema`.
  (API routes that appeared to use `createEpicSchema` define their own
  same-named local const.)
- **Stale / drifted:** the orphaned `createFeatureSchema` required a nested
  `wsjf` object, a required `ownerId`, and required `piId`; the real edges use
  flat WSJF fields, derive the owner from the actor, and treat `piId` as
  optional. `acceptanceCriteria` was `string[]` there vs. a single form `string`
  in the action.

The drift exists because the two edges genuinely differ:

- The **form edge** (server actions) parses `FormData`: it needs `z.coerce` for
  numbers, derives `ownerId` from the authenticated actor, and accepts
  single-string fields it later splits.
- The **JSON API edge** (`/api/v1/**`) validates native JSON (arrays, numbers).

A single Zod schema can't serve both rawshapes without contortion — which is
why the shared attempt was abandoned. The genuinely shareable primitive,
`fibonacci`, is already imported by both edges.

## Decision

**No central create-initiative input schema.** Each edge validates its own raw
input; only true primitives are shared (`fibonacci`, `wsjfInputSchema` +
`computeWsjf`, `businessCaseSchema`). The orphaned `create*Schema` /
`createInitiativeSchema` / `Create*Input` (and the adjacent unused
`stageGate` / `initiativeStatus` / `benefitHypothesisSchema` exports) have been
deleted so they no longer masquerade as a canonical contract.

The per-level service input types (`CreateFeatureInput` in `feature.ts`, etc.)
remain the contract the services consume.

## Consequences

- Validation lives at the edge that owns the raw shape; there is no misleading
  "single source of truth" that no one uses.
- Future architecture reviews should not re-propose consolidating create-input
  validation into one schema — the edges differ by construction. If a shared
  _normalized_ contract is ever wanted, it would validate the post-parse object
  (not the raw input) and would supersede this ADR.
- Risk: the two edges can still drift from each other and from the service input
  type. They are kept aligned by the service's own typed input + integration
  tests, not by a shared schema.
