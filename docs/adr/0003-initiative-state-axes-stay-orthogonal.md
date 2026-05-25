# ADR-0003: The three Initiative state axes stay orthogonal — no unifying workflow orchestrator

- Status: accepted
- Date: 2026-05-24

## Context

An architecture review proposed consolidating an "Initiative Workflow" service
that owns all of an Epic's state transitions, on the grounds that workflow logic
is "scattered" across `epic.ts` (`advanceStageGate`) and the 634-line
`epic-approval.ts`, with timeline captures "buried" in the stage-gate path.

Tracing the code shows three **deliberately independent** state axes on an
Initiative (CONTEXT.md, "State axes … do not conflate"):

1. **Stage Gate** (`stageGate`, L0–L5) — the investment funnel.
   `advanceStageGate` sets `approvedBy`/`approvedAt` when L3 is reached.
2. **Review / QS status** (`status`: draft → in_review → approved) — the quality
   gate, governed by `initiative-status.ts`.
3. **Multi-party Approval phase** (`approvalPhase`: draft → hypothesis_review →
   business_case → stakeholder_review → approved) — the sign-off workflow in
   `epic-approval.ts`. Its terminal `applyDecisionOutcome` sets
   `approvalPhase="approved"`, the QS `status`, and `businessCaseApprovedAt`.

The separation is intentional and already documented:
`docs/backlog/multi-party-business-case-approval.md` notes the approval workflow
is _"nicht an das L2→L3-Stage-Gate gekoppelt (bewusst eine separate Achse)"_.

## Decision

**Do not build a unifying orchestrator.** The three axes remain separate modules
with separate services. Each "approval-like" concept is a distinct axis:

- L3 `approvedAt` = the funnel decision (Stage Gate),
- `approvalPhase="approved"` = the multi-party sign-off terminal,
- `status="approved"` = the QS gate.

A single orchestrator would conflate axes the ubiquitous language keeps apart and
reduce locality-of-concern rather than improve it.

## Consequences

- The "scatter" across `advanceStageGate` and `epic-approval.ts` is the correct
  per-axis ownership, not friction. Future architecture reviews should not
  re-propose merging them.
- The pure state machines (`stage-gate.ts`, `initiative-status.ts`,
  `epic-approval.ts` domain) pass the deletion test — deleting them would
  re-scatter their transition rules into the services. They stay.
- If a _new_ Initiative kind ever needs the same multi-party sign-off, extract
  that one axis as a reusable module — not a god-orchestrator over all three.
