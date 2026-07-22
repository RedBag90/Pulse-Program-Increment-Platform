# ADR-0009: Der Mehrwert einer KPI erreicht Ziele über genau einen Pfad — KPI→KR-Bindung ODER Epic→Ziel-Verknüpfung

Status: Accepted
Date: 2026-07-22

## Context

Bislang gelangt Wert nur über einzelne **KPI→KR-Bindungen** (`KrKpiContribution`)
an ein Ziel: pro KPI eine Bindung an genau einen Key Result, mit Gewicht. Das ist
fein steuerbar, aber mühsam im Überblick — pro Epic müssen alle KPIs einzeln
gebunden werden.

Gewünscht ist zusätzlich das **direkte Verknüpfen eines Epics mit einem Ziel**
("Related work", wie Asana): das Epic wird referenziell an ein Objective oder Key
Result gehängt, und der von seinen KPIs bestimmte Mehrwert rollt in den Ziel-Trio —
als eine Aktion statt N Bindungen.

Beide Mechanismen greifen auf **dieselben** Epic-KPIs zu. Ohne Regel würde der Wert
einer KPI doppelt zählen (einmal über die KPI→KR-Bindung, einmal über das
verknüpfte Epic), was die „jeder Euro genau einmal"-Garantie der Pyramide (ADR-Kontext
`kpi-binding-invariant`) bricht.

Zwei Wertquellen für „der im Epic hinterlegte Mehrwert" standen zur Wahl:
(a) der Business-Case-Wert des Epics (`businessCase.recurringBenefit/oneTimeBenefit`),
(b) der aus den KPIs gerechnete realisierte € (wie bei der KPI→KR-Bindung).

## Decision

**Der Mehrwert einer KPI erreicht Ziele über genau einen Pfad — entweder die
direkte KPI→KR-Bindung (`KrKpiContribution`) oder die Epic→Ziel-Verknüpfung
(`GoalEpicLink`), nie über beide.**

- Wertquelle ist **(b)**: das verknüpfte Epic trägt die Summe der `kpiTrio` seiner
  KPIs bei (`epicLinkTrio` in `goals-rollup.ts`) — dieselbe Rechnung wie die
  KPI→KR-Bindung, nur auf Epic-Ebene (ganzes Epic = alle KPIs, kein
  Contribution-Gewicht, kein `valuePerUnitOverride`).
- **Count-once** analog zur KPI-Pyramide, drei Seams:
  1. **Validator** `checkEpicLink` (`src/domain/epic-link-invariant.ts`) — pure;
     `conflict`, wenn KPIs des Epics bereits einzeln via `KrKpiContribution`
     gebunden sind.
  2. **Service** `linkEpicToGoal` — per-Epic `pg_advisory_xact_lock` _vor_ dem Laden;
     symmetrisch lehnt `setKpiBinding` das Binden einer KPI ab, deren Epic bereits
     verknüpft ist.
  3. **DB-Backstop** `UNIQUE(epicId)` auf `goal_epic_links` — jedes Epic feedet
     ≤ 1 Ziel-Knoten.
- Verknüpfung ist **polymorph** (Objective ODER Key Result), wie `GoalCheckin`.
- Der Rollup summiert `epicLinkTrio` je Knoten neben `keyResultTrio` bzw. der
  Kinder-Summe (Konzept-Header „Σ Ziel-direkt-Epic") und fließt via `sumTrios`
  bis zum Tenant-Trio.

## Consequences

- Nutzer wählen pro Epic den groben Pfad (Epic-Link) **oder** den feinen
  (KPI→KR-Bindung im Controlling) — die UI weist im KR-Drawer auf die Alternative hin.
- Ein Epic ohne KPIs ist rein referenziell verknüpfbar (€-Beitrag = 0).
- Soft-gelöschte Epics (`Initiative.deletedAt`) werden im Loader/Picker/Service
  ausgeblendet; der `onDelete: Cascade` auf `epicId` greift nur bei Hard-Delete.
- Kein `valuePerUnitOverride` auf Epic-Link-Ebene — Feinjustierung bleibt der
  KPI→KR-Bindung vorbehalten.
- Verworfen: (a) Business-Case-Wert als Quelle — andere Zahl als die KPI-Realisierung,
  hätte eine zweite, konkurrierende Wertdefinition am selben Ziel erzeugt.
- Verworfen: Reaktivierung der dormanten `ThemeEpicLink`-Tabelle — Theme-Ebene und
  wertlos; `GoalEpicLink` zielt auf Objective/KR und trägt Wert.
