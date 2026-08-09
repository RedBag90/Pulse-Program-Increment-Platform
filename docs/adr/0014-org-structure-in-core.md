# ADR-0014: Org-Struktur (Value Stream → ART → Team) gehört in Core

- Status: proposed
- Date: 2026-08-09

## Context

Beim Schnitt der Zielmodule ([ADR-0013](./0013-module-layering-and-prerequisites.md)) war offen, wo die
organisatorische Struktur lebt: **Value Stream**, **ART** (Agile Release Train) und **Team**, samt dem
VS→ART→Team-Baum, der heute als eine Einheit geladen wird (`services/structure`, View `structure-page`).

Die Struktur wird von mehreren Layern referenziert:

- **Work** — ein Value Stream finanziert Epics; und Work dokumentiert Features (Breakdown), die eine
  **ART-Zuordnung** brauchen.
- **Drumbeat** — PIs laufen auf ARTs, Kapazität hängt an Teams.
- **Budgeting** — Value-Stream- und ART-Budgets.

Kandidaten waren: Org als Core-Rückgrat; oder VS in Work + ART/Team in Drumbeat; oder alles in Drumbeat.

Der ausschlaggebende Grund kam aus der Fachlogik: **Work soll Features im Sinne des Breakdowns
dokumentieren, und ein Feature braucht zur Zuordnung eine ART.** Also muss die ART (und damit VS/Team)
existieren, **bevor** Work existiert — sie kann nicht in Work oder in einem Work-abhängigen Layer liegen.

## Decision

**Die Org-Struktur-Entitäten (Value Stream, ART, Team) und ihr Hierarchie-Baum gehören in Core.**

- Core besitzt die Tabellen/Services `value-stream`, `art`, `art-setup`, `team`, `structure` (Baum-Load) und
  die zugehörige Org-Setup-Fläche (`transformation/art-starten`, `operating-model`/`target-model`).
- Work referenziert VS (Funding) und ART (Feature-Zuordnung) **abwärts** nach Core — regelkonform.
- Drumbeat referenziert ART/Team (Planung/Kapazität) abwärts nach Core.
- **Org-Verwaltungs-UI bleibt Core-Free/always-on** (VS/ART/Team anlegen, `/structure`, `/setup`,
  `art-starten`): die Entität ist ohnehin Core; fachlich sinnvoll wird sie erst ab Work, aber das Anlegen
  wird nicht hinter Work gated.
- Abgrenzung zu Budgeting: die **VS-/ART-Entität** ist Core, die **VS-/ART-Budget-Vergabe** ist Budgeting.

## Consequences

- Kein Layering-Verstoß: Feature-Breakdown (Work) → ART (Core) ist eine erlaubte Abwärts-Kante; hätte ART in
  Drumbeat gelegen, wäre Work→Drumbeat (Aufwärts) entstanden.
- Das heutige, einheitliche Org-Modell (`registry`/`structure`-Load) bleibt zusammen — kein erzwungener
  Split des VS→ART→Team-Baums entlang der Layer.
- PI-Kadenz/PI-Standard-**Timelines** sind Planungsartefakte und bleiben **Drumbeat**, obwohl die ART-Entität
  Core ist (die Roadmap prüft diesen Schnitt in P5).
- Free-Basis-Tenants können ARTs/Teams anlegen, auch wenn diese ohne Work fachlich ungenutzt bleiben — eine
  bewusste Vereinfachung zugunsten eines konsistenten Org-Fundaments.
