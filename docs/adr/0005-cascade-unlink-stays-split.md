# ADR-0005: Cascade-unlink stays split — `deletePi` and `detachArtFromTimeline` are not merged

- Status: accepted
- Date: 2026-06-03

## Context

An architecture review surfaced that
[`detachArtFromTimeline`](../../src/server/services/timeline.ts) and
[`deletePi`](../../src/server/services/pi.ts) walk similar paths when a
container holding Initiatives goes away — both delete Sprints, clear
`Story.sprintId`, and clear `Feature.piId`. The review asked whether they
should consolidate behind one
`cascadeUnlinkInitiatives({ piIds, teamIds?, … })` module.

Tracing the two operations shows the surface similarity hides
**different lifecycle semantics**:

| Concern           | `deletePi`                              | `detachArtFromTimeline`                             |
| ----------------- | --------------------------------------- | --------------------------------------------------- |
| Target container  | one PI row, **deleted**                 | one ART's footprint inside a Timeline; **PI stays** |
| Sprint scope      | every Sprint in the PI                  | only Sprints whose `teamId` ∈ the ART's teams       |
| Feature scope     | every Feature with `piId === pi.id`     | only Features of this ART, on this Timeline's PIs   |
| Objectives        | **deleted** (`piObjective.deleteMany`)  | left untouched (PI-Objectives survive the ART move) |
| Impediments       | detached (`piId=null`, `sprintId=null`) | left untouched (Impediments are ART-scoped)         |
| The PI row itself | deleted                                 | kept                                                |

The shared mechanics (delete Sprints, clear Story `sprintId`, clear
Feature `piId`) are about **3–5 SQL statements per function**. The
**differences** are policy decisions that a unifying module would have to
expose as 4–5 Boolean parameters, then route through call sites that each
pick a different sub-set.

## Decision

Keep `deletePi` and `detachArtFromTimeline` as separate modules. Do not
introduce a shared `cascadeUnlinkInitiatives` helper.

Cross-reference the two functions in each other's doc-comment so the
next engineer touching either one sees its sibling and the policy
contrast at a glance.

## Consequences

**Pros:**

- The function name is the policy: "delete this PI" vs. "detach this
  ART from this Timeline" map cleanly onto user-facing operations.
- A bug fix in one function explicitly does **not** automatically apply
  to the other — which is the right default when the semantics differ.
- No shared module surface to evolve as the cleanup rules accrete edge
  cases (the existing rules around objectives and impediments are the
  product of UX decisions, not derivable mechanically).

**Cons:**

- The shared mechanics (Sprint delete + Story `sprintId` null) are
  written twice. **Mitigated** by the small footprint (~3 lines each)
  and the named asymmetries surfacing the diffs clearly.
- If a third "container goes away" operation ever appears (e.g. a
  whole Timeline being deleted), this ADR should be revisited; the
  shared core may finally earn its keep across three callers.

## Resolved questions

- **PiObjective cleanup on detach** _(resolved 2026-06-03)_ — the second
  architecture review revisited this and decided the answer is **yes,
  delete them**. `PiObjective` rows are bound to a (PI, Team) pair; once
  the Team leaves the Timeline its objective on a Timeline-PI has no
  carrier, and leaving the row behind produces ghost objectives that the
  next ART joining the same Timeline-PI would render. `detachArtFromTimeline`
  now runs a `tx.piObjective.deleteMany({ piId in pis, teamId in teams })`
  alongside the Sprint and Feature cleanups, and the count flows into the
  `timeline.art.left` / `timeline.art.joined` audit changesets as
  `objectivesRemoved` / `objectivesRemovedFromPrevious`. Tested at the
  module interface in
  [`detach-art-from-timeline.test.ts`](../../src/server/services/__tests__/detach-art-from-timeline.test.ts).
  This adjustment does **not** weaken the "keep the two functions
  separate" decision — it sharpens the Timeline-detach policy, which
  remains its own policy distinct from PI-delete.

## Related

- CONTEXT.md "Initiative — the shared substrate for Epic and Feature"
- ADR-0003 — "The three Initiative state axes stay orthogonal" (similar
  shape: the architecture review proposed a unifier, we kept the parts
  separate because the policies differ).
