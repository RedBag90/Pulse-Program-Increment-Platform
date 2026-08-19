# ADR-0019: Das Epic-Soll-Fenster folgt dem Reifegrad-Plan, nicht dem finanzierten Fenster

- Status: accepted
- Date: 2026-08-19

## Context

[ADR-0015](./0015-cross-module-write-through-via-events.md) beschrieb zwei Schreib-Kopplungen von
oberen Modulen in Work hinein und entschied, sie auf Domain-Events umzustellen. Der Nachtrag vom
2026-08-16 hielt fest, dass [ADR-0018](./0018-stage-gate-transitions-are-requested-and-approved.md)
die **Reifegrad-Hälfte** beider Kopplungen ersatzlos gestrichen hat — und benannte als einzigen
Rest:

> offen ist davon noch die `Initiative.timeline` / `plannedStartAt`-Schreibkopplung in
> `saveBudgetAllocation` (`FundedWindowDecided`)

Diese ADR schliesst genau diesen Rest.

Der bisherige Vertrag lautete: `saveBudgetAllocation` leitete aus der Allokationskarte ein
**finanziertes Fenster** ab (erstes bis letztes finanziertes Halbjahr) und schrieb es dem Epic als
`plannedStartAt`/`plannedEndAt` plus als `timeline.estimates.backlog`/`.implementation` zu —
„last writer wins", Owner-Actuals überlebten. Damit besass ein Epic zwei konkurrierende Autoren
seines Soll-Fensters: den Owner (über den Reifegrad-Plan) und Finance (über die Budgetzuteilung).

Fachlich ist das die falsche Richtung. Wann etwas umgesetzt wird, ist eine Aussage des Epic-Owners
über seinen Plan; die Budgetzuteilung sagt, **wie viel Geld** in welchem Halbjahr bereitsteht. Ein
halbjahresgrobes Geldraster als Terminplan zu lesen, machte das Soll-Fenster zudem systematisch
unschärfer als die Timeline-Schätzungen, die daneben gepflegt wurden.

## Decision

**Das geplante Zeitfenster eines Epics wird ausschliesslich aus dem Reifegrad-Plan des Owners
abgeleitet.** `Initiative.plannedStartAt`/`plannedEndAt` folgen den Implementation-Phasen-Schätzungen
der Timeline (L4.1 `implementation_started` → L4.2 `implementation`), berechnet von
`timelinePlannedWindow` und geschrieben von `saveTimeline` — dem **einzigen** Schreiber beider.

Daraus folgt:

1. Budgeting ist gegenüber Work **vollständig read-only**. Es schreibt nur noch
   `BudgetAllocation`, `ArtBudget`, `BudgetPlanRevision` und `Tenant.budgetPoolByPeriod`.
2. Das Event `FundedWindowDecided` wird **nicht gebaut**. Es gibt keinen Seiteneffekt mehr, den es
   transportieren könnte — wie schon bei `FeatureStarted` (ADR-0015-Nachtrag) gilt: ein
   Seiteneffekt, den es nicht gibt, braucht weder einen synchronen Aufruf noch ein Event.
3. Die Budget-Summe eines Epics bleibt ein **Readiness-Kriterium**, das beim Lesen über den Port
   `getEpicBudgetAllocation` abgeleitet wird — konsistent mit ADR-0018 („Readiness wird gelesen,
   nie geschrieben").

## Consequences

- Gelöscht: `budgeting/domain/allocation-schedule.ts` (`computeAllocationScheduleUpdate`) sowie
  `fundedWindow` / `FundedWindow` / `ScheduleEstimates` / `withScheduleEstimates` in
  `work/domain/epic-schedule.ts`. Neu: `timelinePlannedWindow`, das ein invertiertes Paar
  (Start > Ende) bewusst auf **beide** `null` abbildet, damit Konsumenten nie ein korruptes
  Fenster sehen.
- Die Kernel-Primitive `fundedPeriodRange`/`fundedEndDate` verlieren damit ihren letzten
  Produktionsaufrufer und entfallen; `parsePeriodAmountMap` bleibt (Work und Budgeting nutzen es).
- Die `saveBudgetAllocation`-Transaktion berührt nur noch **eine** Tabelle statt zweier. Der
  Vertrag „Budgeting schreibt keine `Initiative`-Spalte" ist als Integrationstest festgehalten
  (`budgeting.integration.test.ts`) — das P6-Gate der Modul-Migrations-Roadmap.
- **Verhaltensänderung für Bestandsdaten**: Epics, deren Soll-Fenster bisher aus der Budgetzuteilung
  stammte, behalten ihre gespeicherten Werte, aktualisieren sie aber erst wieder, wenn der Owner
  seine Timeline pflegt. Das ist gewollt — die Zahl bekommt damit einen benannten Autor.
- Die Board-Spalte „Bedarf ab" ist folgerichtig ein Label statt eines Eingabefelds: der Wert stammt
  aus `deriveEpicEconomics(...).costStart` und gehört dem Owner.
- Die Richtung von ADR-0015 bleibt für **echte** Cross-Modul-Schreibwirkungen gültig. Nach dieser
  ADR existiert keine mehr; das dort skizzierte Event-Inventar ist damit vollständig abgeräumt.
