# ADR-0006: Round 4 deepening closeout

Status: Accepted
Date: 2026-06-05

## Context

Round 4 of the architecture-deepening review swept the layers beyond the
action factory (services, domain modules, page-models, client components,
hooks, audit). The action layer itself was settled in Rounds 1–3. Round 4
surfaced three candidates; only one survived grilling. This note records
**what was investigated and rejected**, so future rounds don't re-suggest
the same things, and what was extracted.

## Decision

### Extracted — `<ConfirmMutateForm>`

The dominant client pattern across 10+ destructive-action buttons
(`delete-X-button`, `remove-role-button`, `leave-timeline-button`) was
`useActionState` + `<form action>` + hidden inputs + native `confirm()` on
submit + inline error span + submit button. The shape was already minimal
(~25 lines per site) but repeated verbatim. Extracted to
`src/components/actions/confirm-mutate-form.tsx` with a small interface
(action, fields, label, confirmPrompt, optional `onSuccess` for sites that
own the page being deleted).

Sites migrated: `delete-pi-button`, `delete-team-button`,
`delete-story-button`, `delete-feature-button`, `delete-art-button`,
`delete-epic-button`, `delete-value-stream-button`, `delete-timeline-button`,
`remove-role-button`, `leave-timeline-button`.

### Skipped — `disconnect-ado-button`, `disconnect-jira-button`, `erase-user-button`

These call their actions positionally (e.g. `disconnectAdoAction()`) rather
than through `useActionState` + FormData. Migrating them requires first
converting the action to a FormData action (the Round 3 audit explicitly
left GDPR-erase and integration-disconnect actions as justified escape
hatches). Out of scope for Round 4.

### Skipped — approval-controls, approval-actions, impediment-row, capture-revision

- `<ApprovalActions>` (my-approvals) and `<ResetApprovalButton>` (portfolio
  approval-controls) use a **custom inline-comment banner**, not native
  `confirm()`. They already share extracted `makeForm` + `dispatch` helpers
  inside their own modules — those helpers concentrate what's repeatable
  inside this shape. A unified component would double the props surface for
  no leverage.
- `<ImpedimentRow>` resolve uses **reveal-form-then-submit** (textarea
  appears, then submit) — a third distinct shape.
- `<CaptureRevisionButton>` is a one-click idempotent trigger with no
  confirm at all — already minimal.

### Rejected — Financial-period extraction

Initial hypothesis: `epic-economics`, `portfolio-economics`, and
`pi-capacity` each prorate a temporal quantity across an axis and would
benefit from a shared primitive.

Investigation:

- [src/domain/portfolio-economics.ts](../../src/domain/portfolio-economics.ts)
  already concentrates prorating across a `MonthAxis` in
  `epicMonthlyFlows`, `costSlicesByMonth`, `recurringFactorByMonth`,
  `kpiFulfillmentByMonth`. One module, all the relevant routines.
- [src/domain/epic-economics.ts](../../src/domain/epic-economics.ts) does
  not prorate at all — it computes totals and resolves benefit weights.
- [src/domain/pi-capacity.ts](../../src/domain/pi-capacity.ts) uses a
  `HalfYearAxis` against ART budget cells — a different operation on a
  different axis.

There is no shared seam to extract. The "common prorate" is already
concentrated where it belongs (one consumer of `MonthAxis`-based
prorating, one consumer of `HalfYearAxis`-based prorating). Re-suggesting
a `financial-period` module in a future round would not find new evidence.

### Rejected — Cockpit page-model / `pi-overview` aggregator merge

Initial hypothesis: the seam between
[src/server/views/transformation-cockpit.ts](../../src/server/views/transformation-cockpit.ts)
(page-model) and [src/domain/pi-overview.ts](../../src/domain/pi-overview.ts)
(aggregator) was fuzzy, with domain rules hidden in presentation glue.

Investigation:

- `transformation-cockpit.ts` is a textbook page-model per CONTEXT.md —
  filters archived goals (presentation policy, not domain rule), serialises
  `Date → ISO`, derives sparkline geometry. It earns its file.
- `pi-overview.ts` is a pure rollup with one consumer today (the PI detail
  page-model). One consumer is the **expected** shape for a page-model +
  aggregator pair — the aggregator is the testable seam, the page-model is
  the presentation seam. Merging them would lose that seam discipline.

No friction beyond taxonomy. Future rounds: do not re-suggest unless a
second consumer of `pi-overview` appears.

## Consequences

- The deepening cycle has clearly entered diminishing returns. Round 4
  closes one real candidate (a client-component extraction, not an
  architecture move) and rejects two with concrete reasoning.
- Future rounds (if any) should look for genuinely new friction
  (e.g. integration adapters, realtime patterns, audit-event registry)
  rather than re-examining the action/service/domain layers, which are
  settled.
- If Round 5 finds no concrete candidate, the deepening cycle ends and
  this ADR is the record of where the work stopped and why.
