# ADR-0010: Objective + Key Result sind ein rekursiver Goal-Knoten (beliebig tiefe Kaskaden)

Status: Accepted
Date: 2026-07-23

## Context

Die Ziel-Hierarchie war hart auf **zwei Ebenen** verdrahtet: `Objective → KeyResult`
(zwei getrennte Tabellen, ein `"objective" | "kr"`-Diskriminator quer durch Loader,
Services, Actions und UI). Gebraucht wurde **beliebig tiefe Kaskadierung**: unter ein
Ziel lässt sich ein weiteres Ziel **oder** ein messbares Blatt hängen, inhaltlich
identisch bis auf das Label — wie Asanas verschachtelte Goals.

## Decision

**`Objective` ist der einzige, rekursive Goal-Knotentyp; `KeyResult` wird darin
verschmolzen.** Ein `nodeKind`-Feld (`"objective" | "key_result"`) unterscheidet nur das
Label; jeder Knoten kann Kinder **und/oder** eine eigene Metrik tragen.

- **Self-Relation** `parentObjectiveId` + `level` + materialisierter `path` (Muster wie
  `Initiative`). Top-Level-Knoten (parentObjectiveId = null) sind die „Themes".
  Kind-Knoten erben `themeId` vom Parent.
- Die KeyResult-Metrikfelder (`metricName/Unit/Type`, `precision`, `currencyCode`,
  `rollupWeight`, `baseline/target/current`, `formula`) leben jetzt am Objective.
- **Rollup rekursiv** (`goals-rollup.ts` `nodeProgress`/`nodeTrio`, Post-Order): hat ein
  Knoten Kinder, gewinnt der (gewichtete) Rollup über eine etwaige eigene Metrik; ein
  Blatt nutzt seine eigene Metrik/KPI-Bindung. Epic-Link-Beiträge kommen auf jeder Ebene
  hinzu.
- **Ein rekursiver `GoalNode`-DTO** ersetzt `ZieleTreeTheme` + `ZieleTreeKeyResult`; der
  Loader baut den Baum flach über `parentObjectiveId`. `strategy-table` + `strategy-network`
  rendern rekursiv; OKR-Board/Sankey/Money bleiben vorerst Top-Level.
- **`KrKpiContribution`, `GoalCheckin`, `GoalComment`, `GoalEpicLink`** hängen jetzt
  ausschließlich an `objectiveId`; der `keyResultId`-FK ist entfernt.
- Modellname bleibt `Objective` (kein Rename `→ Goal`), um Churn zu begrenzen.

### ID-erhaltende Datenmigration

Der Merge lief auf Live-Daten (`prisma db push`, kein Migrations-Ordner) in drei Schritten:
additiver Push → **ID-erhaltendes** Script (jede KeyResult-Row wird eine Objective-Row mit
**derselben UUID**, `nodeKind="key_result"`, `parentObjectiveId` = altes objectiveId; alle
FK-Spalten `keyResultId → objectiveId` umgezogen) → destruktiver Push (Drop `key_results`

- `keyResultId`-Spalten). Weil die UUIDs erhalten blieben, blieben alle Referenzen
  (Check-ins, Kommentare, KPI-Bindungen, Epic-Links) ohne Remapping gültig. Vorbedingungen:
  Feature-Branch, JSON-Backup, Konnektivitäts-Check vor dem destruktiven Schritt.

## Consequences

- Der Fortschritts-/€-Rollup wirkt jetzt tief; `portfolio-overview` konsumiert die
  Top-Level-Knoten — Semantik (`goalsOnTrack`/`topGoal` = Top-Level-Ziele) unverändert im Verhalten.
- `loadGoalDetail` kennt keinen `target`-Diskriminator mehr (Feld bleibt in der Signatur
  aus Kompatibilität, unbenutzt); Check-ins/Kommentare/Audit laufen über `objectiveId`,
  Audit-Historie umfasst weiter historische `key_result.*`-Events.
- Delete eines Knotens löscht den Subtree über den `path` (die Self-Relation trägt kein
  DB-Cascade); Dependents fallen per `objectiveId`-Cascade mit.
- **Out of scope (v1):** Re-Parenting/Drag-Move bestehender Knoten; tief-rekursives
  OKR-Board/Sankey; Modell-Rename.
- Verworfen: separater `GoalNode`-Tabellen-Neubau (mehr Migrationsrisiko als der
  ID-erhaltende In-Place-Merge).
