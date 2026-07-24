# ADR-0011: Fortschrittsquelle pro Ziel + ein Erstellungspfad + ein UI-Begriff „Ziel"

Status: Accepted
Date: 2026-07-24

## Context

Nach ADR-0010 ist `Objective` der eine rekursive Goal-Knoten und `nodeKind`
(`"objective" | "key_result"`) „nur ein Label". Trotzdem gab es in der UI **zwei**
Erstellen-Buttons („＋Ziel" / „＋KR") mit zwei getrennten Formularen — der Nutzer musste
O-vs-KR **vorab** entscheiden, obwohl oft unklar ist, ob eine Ebene selbst das messbare
Blatt ist oder noch ein Unterlevel bekommt.

Zweitens konnte der **Fortschritt** eines Ziels nur aus der eigenen `current`-Spalte
(Blatt) oder dem Kinder-Rollup kommen. Verknüpfte Epics/KPIs trieben **nur den €-Trio**
(`nodeTrio`), nicht den normalisierten 0..1-Fortschritt (`nodeProgress`). Der Wunsch:
einen Zielwert setzen, Epics anknüpfen, und der Fortschritt soll steigen, wenn deren KPIs
(gleiche Einheit) besser werden — Asanas „progress source".

## Decision

**Die Fortschrittsquelle ist ein explizites Feld pro Ziel** (`Objective.progressMode`,
`src/domain/goal-progress-mode.ts`):

- `manual` — Ist-Wert von Hand (`keyResultProgress` über `current`); auf **jeder** Ebene,
  auch als Override bei einem Knoten mit Kindern.
- `rollup` — gewichteter Durchschnitt der Kind-Fortschritte.
- `auto_kpi` — Ist-Wert = **Summe** der Ist-Werte aller KPIs mit **passender Einheit** aus
  den verknüpften Epics (`GoalEpicLink`); dann `keyResultProgress` gegen baseline/target.

`progressMode = null` ⇒ **abgeleitet** (`hasChildren ? "rollup" : "manual"`) = exakt das
Verhalten vor diesem ADR (kein Backfill, additive, nullable Spalte).

`nodeProgress` (`goals-rollup.ts`) respektiert den Modus: `rollup` mittelt die Kinder,
`manual`/`auto_kpi` nutzen den eigenen `progressLeaf` — **auch wenn Kinder existieren**.
Die **Geld-Achse** (`formula`, `KrKpiContribution`, €-Trio, Money-Sheet) bleibt
unverändert; Fall 3 liest die Epic-Link-KPIs nur zusätzlich für die Fortschritts-Achse, die
Count-once-Geldzählung (ADR-0009) ändert sich nicht.

**Ein Erstellungs-/Bearbeitungspfad:** ein `createGoalNodeAction`/`updateGoalNodeAction`
(die bisherigen Objective/KR-Actions vereinheitlicht), ein `GoalPane` im Drawer mit
optionalem Metrik-Block + Fortschrittsquelle-Selektor. In der UI heißt jeder Knoten „Ziel"
(Top-Level bleibt „Theme (OKR)"); `nodeKind` wird nur noch best-effort
(`target != null ? "key_result" : "objective"`) geschrieben und behavioral nicht mehr
gelesen. Messbarkeit leitet sich aus `isMeasurableGoal` (Metrik/Modus) ab.

## Consequences

- Kein Vorab-O-vs-KR; ein Knoten wird messbar, sobald er eine Metrik trägt, und wird zum
  Container, sobald er Kinder bekommt (Rollup gewinnt) — es sei denn, der Modus ist explizit
  `manual`/`auto_kpi` (Override).
- Neuer, einheitengleicher „Fortschritt aus KPI"-Pfad; Einheiten-Match über das freie
  Einheit-Label bzw. den Währungscode.
- `nodeKind` ist jetzt vestigial (Legacy-Spalte). Alte Deeplinks `entity=theme|kr` werden
  als Alias auf `entity=goal` weiter akzeptiert.
- Additiv: nur `progressMode String?` neu; keine Migration, keine RLS (Modul-Konvention:
  Tenant-Scoping im Service).
