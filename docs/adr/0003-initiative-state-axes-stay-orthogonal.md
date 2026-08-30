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

## Nachtrag (2026-08-30): aus drei Achsen werden zwei

Die Mehrparteien-Achse gibt es nicht mehr. Sie hatte genau zwei Inhalte — die
Freigabe der Benefit-Hypothese und die des Lean Business Case —, und beide sind
in die Reifegrad-Achse gewandert: die Abnahme des Schritts **L0 → L1** _ist_ die
Hypothesen-Freigabe, die Abnahme von **L2 → L3.1** _ist_ die
Business-Case-Freigabe, dort durch die fünf Parteien (MGMT, Business Owner,
Finance, IRT-Owner, LACE/VMO) als benannte Abnehmer. Damit entfallen `EpicApproval`,
`Initiative.approvalPhase` und `Initiative.approvalRevision`; übrig bleiben zwei
Achsen: **Reifegrad** und **QS-Status**.

**Der Grund war Doppelung, nicht Vereinfachung um ihrer selbst willen.** Vor
jeder der beiden Stellen standen zwei Anträge und zwei Abnahmen hintereinander,
die dasselbe aussagten — und die zweite konnte die erste nur bestätigen. Das
Reifegrad-Kriterium fragte den Stempel ab, den der Freigabelauf gesetzt hatte;
eine echte Entscheidung fiel nur einmal.

**Die ursprüngliche Entscheidung bleibt richtig, ihre Voraussetzung ändert sich.**
Dieses ADR wehrt einen Orchestrator über _unabhängige_ Achsen ab. Hier lag keine
Unabhängigkeit vor: die eine Achse existierte nur, um die andere zu füttern. Was
zusammengelegt wurde, war nie orthogonal — der Rest ist es weiterhin. Ein
Orchestrator über Reifegrad und QS-Status wäre nach wie vor falsch.

Zwei Folgen sind bewusst in Kauf genommen:

- **Die Kriterien der tragenden Schritte wechseln die Aussage.** Sie können den
  Stempel nicht verlangen, den sie selbst setzen — das wäre zirkulär. → L1
  verlangt eine _ausgearbeitete_ Hypothese, → L3.1 einen _ausgearbeiteten_
  Business Case; die Stempel prüfen erst die Folgeschritte (→ L2, → L3.2).
- **Revisionen entfallen.** Ein erneuter Lauf ist eine begründete Rückstufung
  (L1 → L0 bzw. L3.1 → L2, die den Stempel abräumt) plus ein neuer Antrag. Die
  Historie steckt ohnehin vollständig in den Antrags-Zeilen. Die Baseline für den
  Review-Diff zieht seither die Abnahme selbst: sie schnappschusst den
  freigegebenen Text, damit der nächste Antrag zeigen kann, was sich seit der
  letzten Freigabe geändert hat.

Die Practice `multiPartyApproval` bleibt und hat eine schärfere Bedeutung: sie
entscheidet nicht mehr, _ob_ es eine zweite Achse gibt, sondern **wer L2 → L3.1
abnimmt** — die fünf Parteien (an) oder der VMO allein (aus).
