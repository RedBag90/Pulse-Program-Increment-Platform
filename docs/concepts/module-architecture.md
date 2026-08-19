# Modul-Zielarchitektur: Core+Goals / Work / Drumbeat / Budgeting

- Status: proposed (Ziel-Bild, noch nicht umgesetzt)
- Date: 2026-08-09
- Verwandte ADRs: [ADR-0013](../adr/0013-module-layering-and-prerequisites.md) ·
  [ADR-0014](../adr/0014-org-structure-in-core.md) ·
  [ADR-0015](../adr/0015-cross-module-write-through-via-events.md)
- Umsetzung: [module-migration-roadmap.md](./module-migration-roadmap.md)

Dieses Dokument beschreibt das **Ziel-Bild**, in das die heutigen Funktionen als individuelle
Modul-Container gehoben werden. Es bewegt keinen Code — es legt Grenzen, Schichtung, Nähte und die
Migrationsreihenfolge fest. Vokabular nach `CONTEXT.md` + Architektur-Sprache
(Modul/Interface/**Seam**/Adapter/**Depth**/**Locality**).

## 1. Zweck & Treiber

Primärer Treiber ist **Wartbarkeit / AI-Navigierbarkeit**: tiefe Module hinter schmalen Interfaces, klare
Locality, Ports als Test-Nähte. Das kommerzielle Freemium-Entitlement (Module einzeln lizenzierbar) ist das
**Modell**, aber Mittel, nicht Zweck. Container-Form: **modularer Monolith** mit erzwungenen Import-Grenzen
(dependency-cruiser + ESLint `no-restricted-imports`); Routes bleiben in `src/app` als dünne Shells,
Container = `src/modules/<m>/`.

## 2. Ist-Analyse (Ausgangslage)

- **Entitlement-Registry** `src/domain/modules.ts`: 8 Keys (`ziele, portfolio, program, controlling,
roadmap, reporting, structure, admin`) + `CORE_SEGMENTS` (`start, my-tasks, my-approvals`). Jeder
  `ModuleDef` trägt `segments`/`actions`/`home`. Heute nur **Nav-/Route-/Action-Gate**, kein Import-Boundary.
- **Gate-Punkte**: Route-Guard `src/app/[locale]/(dashboard)/layout.tsx` (redirect auf
  `firstEnabledHome`); Action-Gates `server/http/server-action.ts`, `mutation-handler.ts`,
  `query-handler.ts`; Entitlement-Auflösung `server/auth/principal.ts`.
- **Fail-closed-Tests** `src/domain/__tests__/modules.test.ts`: Vollständigkeit (jedes `(dashboard)`-Segment
  muss auf ein Modul mappen) + No-Dup (kein Segment doppelt). Diese erzwingen bei der Neuzuordnung, dass
  jedes Segment einem der 4 neuen Keys zugewiesen bleibt.
- **Substrat**: `Initiative` ist eine Tabelle für Epic (`level=EPIC`) und Feature (`level=FEATURE`),
  verbunden über `parentId` (`@relation("Hierarchy")`). Work und Drumbeat teilen also Zeilen dieser Tabelle.

## 3. Ziel-Layering

```
Core  (Kernel + Goals + Org-Struktur VS→ART→Team)      ← Fundament, immer vorhanden (Free-Basis)
  └─ Work    (Epic-Def/Doku/Freigabe + Epic-Timeline + Feature-Breakdown + Ökonomie)   benötigt Core
       ├─ Drumbeat   (detailliertes Planen/Ausführen)      benötigt Work
       └─ Budgeting  (Budgetvergabe)                        benötigt Work     (Drumbeat ⊥ Budgeting)
```

- **Lizenz-Regel (Prerequisite)**: Drumbeat und/oder Budgeting nur mit aktivem Work; Work immer auf Core
  (siehe [ADR-0013](../adr/0013-module-layering-and-prerequisites.md)).
- **Code-Regel (Import-Richtung)**: nur abwärts — Budgeting/Drumbeat → Work → Core. Nie aufwärts, und
  **Drumbeat ↮ Budgeting** (kein direkter Import zwischen beiden). Modul-übergreifende Sichten sind
  **Shell-Komposition** in `src/app`, kein Modul-Import.

## 4. Modul-Dekomposition

### Core (Kernel + Goals + Org)

| Bereich             | Inhalt                                                                                                                                                                                              |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Infra               | `server/auth`, `server/db`, `server/audit`, `server/events`+`outbox`, `server/http`, `components/*`, `lib/*`, `i18n`                                                                                |
| Initiative-Substrat | Tabelle `initiative`; `initiative-write`, `mutation`, `recorded-update`, `hierarchy`, `initiative`, `initiative-summary`; Domain `initiative-status`, `types`, `errors`, `change-log`               |
| Primitive           | `calendar`, `period-axis`, `modules`, `roles`, `operating-model`                                                                                                                                    |
| KPI                 | Domain `kpi*`, Tabelle `Kpi`, `services/kpi`                                                                                                                                                        |
| Goals/OKR           | `features/ziele`, Domain `goal-*`, `goals-rollup`, Views `goals-forest`/`ziele-view`, Link-Services (`goal-epic-link`, `goal-related-work`, `goal-scope-link`) + **Contribution-Port**              |
| Org-Struktur        | Entitäten VS/ART/Team (`services/{value-stream,art,art-setup,team,structure}`, View `structure-page`), Org-Setup (`transformation/art-starten`, `operating-model`/`target-model`), `features/setup` |

### Work (Epic-Definition/Doku/Freigabe + Feature-Breakdown + Ökonomie)

| Bereich                      | Inhalt                                                                                                                                                                              |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Epic-Definition/Doku         | `features/portfolio`, Domain `benefit-hypothesis`, `business-case`, `epic-lifecycle-doc`, `epic-next-step`, `versioned-document`                                                    |
| Freigabe/Reifegrad           | `epic-approval`, `stage-gate`, `services/epic-approval`, `services/epic`                                                                                                            |
| Epic-Timeline                | `domain/timeline` (Epic-Reifegrad-Timeline, **nicht** PI/Roadmap), `epic-schedule`                                                                                                  |
| Feature-Breakdown-Facette    | Feature-Doku-Spalten (Titel/Beschr., `acceptanceCriteria`, `wsjf`, `featureType`, **ART-Zuordnung**)                                                                                |
| Ökonomie                     | `epic-economics`, `portfolio-economics`, `portfolio-ampel`, `portfolio-guardrails`, `lpm-review`, `services/portfolio-dashboard`, `services/value-stream`-Funding                   |
| Bereitgestellte Ports/Events | Read-Ports `EpicSchedule`, `EpicEconomics`, `FeatureBreakdown`; **keine** Event-Handler — `FeatureStarted` (ADR-0018) und `FundedWindowDecided` (ADR-0019) sind ersatzlos entfallen |

### Drumbeat (detailliertes Planen/Ausführen)

| Bereich                  | Inhalt                                                                                                                                                             |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Umsetzung/Cockpit        | `features/umsetzung`, `features/implementation`, `features/feature` (Planungs-Facette), Views `umsetzung-cockpit-view`, `feature-detail`, `cockpit-feature-detail` |
| PI/Planung               | `features/pi`, `pi-planning`, PI-Standard-Kadenz, `timelines`, Domain `pi-*`, `services/{pi,pi-objective,pi-standard}`                                             |
| ART/Team-Planung         | `features/art`, `features/team` (Planung; Entitäten sind Core)                                                                                                     |
| Dependencies/Impediments | `features/dependencies`, `features/impediment`, `features/risks`, Domain `dependency-graph`, `services/{dependency,impediment}`                                    |
| Kapazität/Roadmap        | `features/capacity`, `features/roadmap`, Domain `roadmap`                                                                                                          |
| Feature-Planungs-Facette | Feature-Spalten `piId`, Delivery-Status/`completedAt`, Dependencies                                                                                                |

### Budgeting (Budgetvergabe)

| Bereich                 | Inhalt                                                                                                                                           |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Participatory Budgeting | `features/budgeting`, Domain `budgeting`, `services/budgeting`                                                                                   |
| Budget-Pläne            | `features/controlling` (budget-plan, budgeting, kpi-coverage), Domain `budget-plan-snapshot`, `services/budget-plan-revision`                    |
| ART-Budget              | Domain `art-budget`, `services/art-budget`, `capacity/art-budget-breakdown`                                                                      |
| Schreibpfad             | schreibt **nicht** in Work (ADR-0019 — das Epic-Fenster folgt dem Reifegrad-Plan); besitzt `BudgetAllocation`, `ArtBudget`, `BudgetPlanRevision` |

## 5. Feature-Facetten-Modell

Die geteilte **Feature-Zeile** (`initiative`, `level=FEATURE`) lebt im **Core**-Substrat; zwei Module
besitzen disjunkte Facetten:

- **Work** — Breakdown/Doku: Titel/Beschreibung, `acceptanceCriteria`, `wsjf`, `featureType`, **`artId`**
  (ART-Zuordnung). Work „bricht" ein Epic in Features herunter und dokumentiert sie.
- **Drumbeat** — Planung/Ausführung: `piId`, Delivery-Status, `completedAt`, Dependency-Kanten,
  Cockpit-Position. Drumbeat plant und führt aus.

Analogie zum Epic: **Epic-Timeline = Work**, **PI-Planung = Drumbeat**. Kein Modul schreibt die Spalten des
anderen; Zugriff über Ports/Events (siehe §6).

## 6. Seams + Port-/Event-Katalog

Grundregel: **Lesen = Read-Port (Interface)**, **Schreiben/Seiteneffekt = Domain-Event** (Outbox,
[ADR-0015](../adr/0015-cross-module-write-through-via-events.md)).

| Seam                  | Richtung                   | Lesen (Port)                                     | Schreiben (Event)                                                                    | Ersetzt heute                                                                         |
| --------------------- | -------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| Core-Kernel           | —                          | —                                                | —                                                                                    | reine Fan-in-Extraktion                                                               |
| Goals ↔ Work/Drumbeat | Work/Drumbeat → Core-Goals | `Goals.ScopeResolver`                            | `GoalContributionRegistered` (Work/Drumbeat melden Epic-/Feature-Beitrag nach unten) | direkter `initiative`-Zugriff aus `goal-*`-Services                                   |
| Work ↔ Drumbeat       | Drumbeat → Work            | `EpicSchedule.plannedWindow`, `FeatureBreakdown` | `FeatureStarted` → Work-Handler `autoAdvance(L4)`                                    | dynamischer `await import("@/server/services/epic")` in `feature.ts:786`              |
| Work ↔ Budgeting      | Budgeting → Work           | `EpicEconomics`                                  | **keiner** — Budgeting ist gegenüber Work read-only (ADR-0018 + ADR-0019)            | ~~`saveBudgetAllocation` schrieb `Initiative.timeline`+`stageGate` direkt~~ (behoben) |

## 7. Composition-Root

Cross-Modul-Seiten (Epic-Seite, Portfolio-Dashboard, Reporting, `create`-Menü, persönliche Inboxes) leben im
`src/app`-Shell **über** allen Modulen. Der Shell ist der einzige Ort, der mehrere Module importieren darf;
er ist per Entitlement gated und komponiert Modul-Read-Models/Ports. Module selbst cross-importieren nie.
Damit ist „Reporting" kein eigenes Modul, sondern Shell-Komposition.

## 8. Daten-Ownership

Modularer Monolith, ein Postgres. Grenzen werden über **Tabellen-/Spalten-Ownership + Ports** erzwungen:

- **Core** besitzt `initiative` (Kern-Spalten), `Kpi`, Org (VS/ART/Team), Audit.
- **Work** besitzt die Epic-Facetten-Spalten (`businessCase`, `benefitHypothesis`, `timeline`, `stageGate`,
  `approval*`, …) **und** die Feature-Breakdown-Spalten (`wsjf`, `acceptanceCriteria`, `artId`, `featureType`).
- **Drumbeat** besitzt die Feature-Planungs-Spalten (`piId`, Delivery/`completedAt`) + `Dependency`.
- **Budgeting** besitzt `BudgetAllocation`.
- Fremd-Schreibzugriff nur via Port/Event; niemand schreibt fremde Spalten direkt.

## 9. Entitlement-Registry-Neuzuordnung (alt → neu)

| Alt (8 Keys)  | Neu           | Anmerkung                                                                               |
| ------------- | ------------- | --------------------------------------------------------------------------------------- |
| `ziele`       | **core**      | Goals in Core gefaltet; Free-Basis, always-on                                           |
| `structure`   | **core**      | Org-Struktur/Setup/`timelines`-Kadenz → Core (Kadenz-Planung ggf. Drumbeat, s. Roadmap) |
| `admin`       | **core**      | Administration + `goal-fields` (Core/Goals)                                             |
| `portfolio`   | **work**      | Epics/Dashboard/Review                                                                  |
| `program`     | **drumbeat**  | Umsetzung/PI/ART/Team/Feature-Planung/Dependencies                                      |
| `controlling` | **budgeting** | Budget/Budget-Plan/ART-Budget                                                           |
| `roadmap`     | **drumbeat**  | Timeline-Visualisierung                                                                 |
| `reporting`   | — (Shell)     | kein Modul; Composition-Root, je Report beim Dateneigner                                |

- `PERSONAL_DEFAULT_MODULES` → `core` (Goals). `MODULE_KEYS` → `[core, work, drumbeat, budgeting]` mit
  Prerequisite-Validierung (Drumbeat/Budgeting ⇒ Work).
- Der Vollständigkeits-Test (`modules.test.ts`) erzwingt, dass jedes heutige `(dashboard)`-Segment einem der
  4 Keys (oder Core-always-on) zugeordnet bleibt.

## 10. Epic-Seite — Work-Umfang + Degradations-Matrix

Die Epic-Detail-Seite (`portfolio/epics/[id]/page.tsx`) ist heute ein Cross-Modul-Komposit **ohne**
Entitlement-Gating auf den Teilbereichen. Ziel-Verhalten:

| Bereich                                                                                                                                                                                                                      | Modul      | Bei Work allein |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | --------------- |
| Hero (Fakten/Ökonomie/Reifegrad/Next-Step), Overview, Business Case, Benefit-Hypothese, „Reifegrad-Phasen und Timeline", Deliverables (Feature-Liste/Doku + ART-Zuordnung)                                                   | Work       | ✅ funktioniert |
| KPI-Tab, „Realisierter Mehrwert"-Tile, Ziel-Badge/Links + BC-Kaskade, History/Activity                                                                                                                                       | Core/Goals | ✅ immer        |
| Deliverables: PI-Spalten je ART (`pisByArt`), Dependencies (`breakdownDependencies`), Netzplan (`breakdownLayoutPositions`), Feature-Slide-over (`loadCockpitFeatureDetail`), Overview-Ist aus Child-PIs (`deriveIstWindow`) | Drumbeat   | ⚠️ ausblenden   |
| Budget-Allocation (`budgetAllocation` → Funded-Window/Ökonomie), `stagedForBudgeting`                                                                                                                                        | Budgeting  | ⚠️ ausblenden   |

**Work-Fallbacks** (bereits vorhanden): Ökonomie/Schedule fällt ohne Funded-Window auf
Business-Case-Forecast + Timeline-Estimates zurück (`epic-schedule`-Kette); Ist-Fenster bleibt leer. Der
Deliverables-Tab rendert die Work-Facette immer, die Drumbeat-Facette konditional. Diese Matrix ist die
**Vorlage** für jede weitere Cross-Modul-Seite.

## 11. Nicht-Dashboard-Flächen

Auch außerhalb `(dashboard)` zuzuordnen (nicht vom Vollständigkeits-Test erfasst): `src/app/api/v1/*`
(überwiegend Core/Admin), `platform/*` (Core-Platform), `middleware.ts` (`PROTECTED_PATTERNS` — zweite
Segment-Liste, mit den Modul-Segmenten synchron halten), das `create`-Menü (Core-Shell, Entitlement-gated)
sowie `my-tasks`/`my-approvals`/`start` (Core-Aggregation über Modul-Read-Models).
