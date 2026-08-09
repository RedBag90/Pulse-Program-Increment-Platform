# ADR-0015: Cross-Modul-Write-Throughs laufen über Domain-Events, nicht über synchrone Aufrufe

- Status: proposed
- Date: 2026-08-09

## Context

Zwischen den Zielmodulen ([ADR-0013](./0013-module-layering-and-prerequisites.md)) gibt es zwei
Schreib-Kopplungen, bei denen ein oberer Layer heute in Work-Interna hineinschreibt:

1. **Drumbeat → Work**: Beim ersten Feature-Start hebt `feature.ts` den Parent-Epic-Stage-Gate auf L4.
   Realisiert über einen **dynamischen `await import("@/server/services/epic")`** (`feature.ts:786`) — ein
   bewusster Zyklus-Brecher, weil ein statischer Drumbeat→Work-Service-Import einen Kreis bilden würde.
2. **Budgeting → Work**: `saveBudgetAllocation` schreibt `Initiative.timeline` (Schedule-Estimates) und ruft
   `autoAdvanceStageGate(..., "L3")` — schreibt also zwei Work-eigene Artefakte direkt.

Beide sind **Seiteneffekte nach unten hinein**, die den Import-Boundary verletzen würden. Die Infrastruktur
für Domain-Events (`server/events` + `server/outbox`) ist bereits vorhanden.

## Decision

**Lesen über Ports, Schreiben/Seiteneffekte über Domain-Events.**

- Die oberen Layer **emittieren Events**, statt Work-Services zu importieren:
  - Drumbeat emittiert `FeatureStarted`; ein **Work-Handler** führt `autoAdvance(L4)` aus.
  - Budgeting emittiert `FundedWindowDecided`; ein **Work-Handler** wendet die Schedule-Estimates an.
- Der Schreibvertrag bleibt wie in `CONTEXT.md`: **last-writer-wins**, Budgeting berührt nur die
  Backlog-/Implementation-Estimates, Owner-Actuals überleben.
- **Lesen** bleibt synchron über Work-Read-Ports (`EpicSchedule.plannedWindow`, `EpicEconomics`,
  `FeatureBreakdown`) — dort gibt es keinen Zyklus und der Aufrufer braucht das Ergebnis sofort.

## Consequences

- Der dynamische `await import` entfällt; die Drumbeat→Work-Kopplung wird statisch prüfbar (dep-cruiser darf
  Drumbeat→Work-**Services** verbieten, weil nur noch Events + Read-Ports übrig sind).
- Die Effekte werden asynchron/entkoppelt: Work-Handler sind eigenständig unit-testbar (Event rein →
  Zustandsänderung raus), und die Regressionsverträge („Feature-Start → Epic L4", „Funded-Window schreibt
  nur Backlog/Impl-Estimates") werden an dieser Naht getestet statt quer durch zwei Services.
- Trade-off: Zwei Mechanismen (Read-Ports synchron, Write-Events asynchron) statt einem. Akzeptiert, weil
  jeweils das passende Werkzeug — sofortige Lesekonsistenz vs. entkoppelter Seiteneffekt — und weil die
  Event-Infra ohnehin existiert.
- Reihenfolge-/Idempotenz-Garantien laufen über die bestehende Outbox; Handler müssen idempotent sein (ein
  erneut zugestelltes `FundedWindowDecided` darf den Zustand nicht doppelt verschieben).
