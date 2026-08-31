# Budget-Modul — UI-Refactor: Spec & Konzept

> **Abgelöst durch [budgeting-refactor.md](budgeting-refactor.md) (2026-08-31).**
> Das Zielbild dieses Dokuments — `/budgeting/round` als die eine Arbeitsfläche
> mit drei Ebenen — wurde vom Kachel-Modell (`/budgeting/periods`) überholt,
> bevor es fertig umgesetzt war. Übrig blieben Redirects auf die alten Routen
> und ihre Lese-Flächen; genau diese Halb-Ablösung ist ein Teil der heute
> beklagten Fragmentierung. Als Zustandsbeschreibung von 2026-08-19 und als
> Herkunft der Prozessleiste bleibt der Text hier stehen.

> Status: **abgelöst** · Erstellt 2026-08-19 · Backend unverändert (read-only ggü. Work,
> ADR-0013/0019). Dies ist ein reiner IA-/UX-/Visual-Refactor auf den vorhandenen Services & Domain.

## 1. Ziel & Treiber

Die Budget-UI wird refactored mit vier gleichrangigen Zielen:

1. **Fragmentierten Fluss vereinen** — der 7-Schritt-Prozess liegt heute über vier Stellen verstreut
   (inkl. ART-Verteilung außerhalb der Budget-Nav); ein kohärenter, geführter Ablauf mit Orientierung
   („wo stehe ich, was blockiert").
2. **Board-Editing verbessern** — weg von einem Speichern-Button je Zeile, hin zu Batch-Speichern mit
   „ungespeicherte Änderungen" und klarer Über-/Unterallokation.
3. **ART-Verteilung integrieren** — Schritt 6 (Finance verteilt Wertstrom-Budget auf ARTs) als Ebene
   ins Budget-Modul holen.
4. **Visueller Feinschliff** — Konsistenz mit dem Design-System, bessere Visualisierung von
   Topf/Zuteilung/Last.

**Nicht-Ziele:** Änderungen am Datenmodell, an der Halbjahres-Rechenlogik, an den Rollen/Capabilities
oder an der Snapshot-Semantik. Budgeting bleibt gegenüber Work vollständig read-only.

## 2. Ist-Analyse

### 2.1 Drei-Ebenen-Modell (Halbjahres-Achse `YYYY-H1`/`-H2`)

| Ebene         | Frage                                                     | Entscheider                                              | Persistenz                                      |
| ------------- | --------------------------------------------------------- | -------------------------------------------------------- | ----------------------------------------------- |
| **Portfolio** | Wie viel Geld je Halbjahr? Welches Epic bekommt wie viel? | Portfolio-Manager / Tenant-Admin                         | `Tenant.budgetPoolByPeriod`, `BudgetAllocation` |
| **Wertstrom** | Wie viel Budget hat ein Wertstrom?                        | _niemand_ — **abgeleitet** aus Epic-Zuteilungen          | keine (Read-Model)                              |
| **ART**       | Wie verteilt der Wertstrom auf seine ARTs?                | Finance-Approver des Wertstroms (o. `art_budget.manage`) | `ArtBudget`                                     |

Ein Snapshot friert einen Halbjahres-Zyklus als `BudgetPlanRevision` ein (idempotent je `(tenant,
cycleKey)`).

### 2.2 Der 7-Schritt-Prozess

| #   | Schritt                                                               | Ort heute                      | Code                                              |
| --- | --------------------------------------------------------------------- | ------------------------------ | ------------------------------------------------- |
| 0   | Ökonomie-Settings (cost/Job-Size, kostenneutral, Guardrails)          | Portfolio-Dashboard (Work)     | `dashboard-settings.ts`                           |
| 1   | **Topf** je Halbjahr setzen                                           | `/budgeting/board` (`PoolRow`) | `saveBudgetPool`                                  |
| 2   | Epics **vormerken** (`stagedForBudgeting` + Hypothese/BC freigegeben) | Epic-Overview                  | `setEpicFlagAction`; Gate in `loadBudgetingModel` |
| 3   | **Zuteilen** je Epic je Halbjahr                                      | `/budgeting/board` (`EpicRow`) | `saveBudgetAllocation`                            |
| 4   | L3-Readiness „Budget alloziert" (abgeleitet)                          | Epic-Detail                    | `getEpicBudgetAllocation`                         |
| 5   | **Wertstrom-Rollup** (read-model)                                     | VS-Detail / Struktur           | `getValueStreamBudgets`                           |
| 6   | Finance **verteilt auf ARTs**                                         | `/value-streams/[id]`          | `saveArtBudget`                                   |
| 7   | **Snapshot** je Zyklus                                                | `/budgeting/budget-plan`       | `captureBudgetPlanRevision`                       |

### 2.3 Heutige UI-Flächen

- **`/budgeting`** — „Controlling-Übersicht": `StatStrip`, aktuelle Revision, Guardrails, Historie.
- **`/budgeting/board`** — „Participatory Budgeting": `PoolRow` + `EpicRow`-Tabelle + `ValueStreamChart`
  (Recharts, lazy).
- **`/budgeting/budget-plan[/id]`** — eingefrorene Revision (Epics/Wertströme/ARTs/Features-Sektionen).
- **`/value-streams/[id]`** — ART-Budget-Editor (`ArtBudgetBreakdown`) + Wertstrom-Budgetplan.

Rollen: `budget.manage` (Topf + Epic + Snapshot; TENANT_ADMIN/PORTFOLIO_MANAGER), `art_budget.manage`
(+ VS-Owner scoped, + Finance-Approver am Service-Seam).

### 2.4 Schmerzpunkte

- **P1 — Fragmentierung.** Prozess über vier Orte; ART-Schritt liegt außerhalb der Budget-Nav; keine
  „wo stehe ich"-Orientierung.
- **P2 — Zeilen-Speichern.** Jede Zeile (Pool/Epic/ART) hat einen eigenen Speichern-Button; kein
  Batch, kein „ungespeicherte Änderungen"-Bewusstsein.
- **P3 — Staging disconnected.** Vormerken passiert nur im Epic-Overview; das Board zeigt nicht, welche
  Kandidaten noch nicht gestaged sind.
- **P4 — Über-/Unterallokation** wird nur als rote „Verbleibend"-Zahl gezeigt — schwach visualisiert.
- **P5 — Guardrails** auf der Controlling-Seite, obwohl fachlich Work (Finding F15) — verwischt die
  Modulzuordnung.
- **P6 — Wertstrom-Ebene** hat keine eigene Sicht; der Chart hängt unten am Board.

## 3. Ziel-Konzept

### 3.1 Informationsarchitektur (Nav neu)

Top-Gruppe **„Budgeting"** mit drei Items, am Mentalmodell (Zyklus → Runde → Snapshot) ausgerichtet:

```
Budgeting
├── Übersicht        /budgeting            (Orientierungs-Hub)
├── Budget-Runde     /budgeting/round      (die EINE Arbeitsfläche)   ← ersetzt /board
└── Budget-Plan      /budgeting/budget-plan (eingefrorene Snapshots)
```

`/budgeting/board` → 301 auf `/budgeting/round` (bestehende Deep-Links bleiben gültig).

### 3.2 Screen-Spec

#### Screen 1 — Übersicht (`/budgeting`)

Orientierungs-Hub für den aktiven Zyklus. Aufbau (top→down):

1. **`PageHeader`** — Titel „Budget · {Zyklus-Label}", Subtitle „Budget-Disziplin und Wertbeitrag in
   einer Sicht", Primär-Action **„Zur Budget-Runde"**.
2. **Prozess-Leiste** (siehe 3.4) — 5 Schritte mit Zustand + Deep-Link.
3. **KPI-`StatStrip`** — Aktiver Zyklus · Σ Zyklus-Budget · Σ Folgebudgets · Verbleibend im Topf.
4. **Zwei-Spalten:** links „Wertstrom-Budget" (kompakter `ValueStreamChart` oder Balkenliste), rechts
   „Aktuelle Revision" (Kennzahlen + `CaptureRevisionButton`, „aktuell/veraltet"-Badge).
5. **Revisions-Historie** — Tabelle, Zeilen verlinken auf `/budgeting/budget-plan/{id}`.

Guardrails werden hier **nicht mehr** prominent editiert; falls sie bleiben, klar als „Portfolio-
Leitplanken (Work)" mit Link auf die Portfolio-Einstellungen labeln (P5, optional).

#### Screen 2 — Budget-Runde (`/budgeting/round`) — Kern des Refactors

Eine Arbeitsfläche für den ganzen aktiven Zyklus.

- **Persistenter Zyklus-Header:** aktives Halbjahr · Topf gesamt · Σ zugeteilt · Verbleibend ·
  Snapshot-Status. Kompakte Prozess-Leiste als Streifen.
- **Ebenen-Umschalter** (`toggle-group` bzw. `SectionSubNav`, URL `?level=`):
  - **Topf & Epics** (Portfolio) — Standard-Ebene:
    - **Topf** je Halbjahr (`PoolRow`, jetzt ohne eigenen Save-Button).
    - **Allokations-Tabelle:** Spalte je Halbjahr; je Epic Prio, „Bedarf ab"-Deep-Link, je Periode
      eine Zuteilungs-Eingabe mit **Bedarf als Ghost-Placeholder** (P4).
    - **Perioden-Kopf** zeigt je Halbjahr einen **Allokations-Balken** (Σ zugeteilt vs. Topf,
      `progress-bar`, rot bei Überallokation) statt bloßer „Verbleibend"-Zahl (P4).
    - **Inline-Vormerken** (P3): ausklappbarer Abschnitt „Kandidaten" (Hypothese/BC freigegeben, noch
      nicht gestaged) mit Toggle je Epic (`setEpicFlagAction`).
  - **Wertströme** (abgeleitet, read-only) — Rollup-Tabelle je Halbjahr + `ValueStreamChart` als
    eigene Ebene (P6). Nicht editierbar (Hinweis: „ergibt sich aus den Epic-Zuteilungen").
  - **ARTs** (Finance) — `ArtBudgetBreakdown` **mit Wertstrom-Auswahl** (Dropdown/Chips), integriert
    (P1/Schritt 6). Zeigt Wertstrom-Budget-Referenzzeile, editierbare ART-Zeilen, „Verbleibend"-Balken
    und die read-only Feature-Last je ART. Editierbarkeit je nach Capability/Finance-Approver.
- **Sticky Save-Bar** (siehe 3.3) — global über alle Ebenen; sammelt Dirty-State.

#### Screen 3 — Budget-Plan (`/budgeting/budget-plan[/id]`)

Eingefrorene Snapshots, funktional unverändert, visuell an das neue System angeglichen
(`EntityDetailShell`-Muster: Titel + Zyklus-Pillen-Nav + 4 Sektionen Epics/Wertströme/ARTs/Features).
Aktuelle Periode getönt (`isCurrent`).

### 3.3 Interaktions-Spec — Save-Modell (P2)

- **Dirty-Tracking je Entität** im Client (Muster wie `gate-approver-rules-section.tsx`): Topf, jede
  Epic-Zeile, jede ART-Zeile tragen einen „geändert"-Zustand gegen ihren Ausgangswert.
- **Sticky Save-Bar** erscheint, sobald irgendetwas dirty ist: „N Änderungen (Topf · 3 Epics · 1 ART)"
  mit **Speichern** und **Verwerfen**.
- **Speichern** ruft je geänderter Entität die bestehende Action auf (`saveBudgetPoolAction`,
  `saveBudgetAllocationAction`, `saveArtBudgetAction`), sammelt Fehler je Zeile, hält bei Fehlern die
  Save-Bar offen und markiert die betroffene Zeile. Erfolg → `router.refresh()`, Save-Bar verschwindet.
- **Verwerfen** setzt den lokalen Edit-State auf die Server-Werte zurück.
- Optional (Ausbaustufe): Batch-Action `saveBudgetAllocationsAction` (mehrere Epics in einem Call) —
  vorerst reicht die Schleife über die vorhandenen Einzel-Actions.

### 3.4 Interaktions-Spec — Prozess-Leiste (P1)

Fünf verdichtete Schritte mit Zustand `erledigt | offen | blockiert` und Deep-Link:

| Schritt             | erledigt wenn                              | Link                 |
| ------------------- | ------------------------------------------ | -------------------- |
| **Topf**            | `budgetPoolByPeriod` für den Zyklus > 0    | Runde · Topf & Epics |
| **Epics vormerken** | ≥ 1 gestagtes Epic mit Hypothese/BC        | Runde · Kandidaten   |
| **Zuteilen**        | Σ Allokationen > 0                         | Runde · Topf & Epics |
| **ARTs verteilen**  | ≥ 1 `ArtBudget`-Zeile gesetzt              | Runde · ARTs         |
| **Snapshot**        | jüngste Revision gehört zum aktiven Zyklus | Übersicht · Snapshot |

„blockiert" = Vorbedingung fehlt (z. B. Zuteilen ohne Topf). Die Leiste beantwortet „wo stehe ich".

### 3.5 Visueller Feinschliff (P5, Design-System)

- **Reuse:** `Page/PageHeader/PageSection`, `Card(+Header/Content)`, `Stat`/`StatStrip`, `SectionLabel`,
  `progress-bar` (Allokations-/Verbleibend-Balken), `toggle-group`/`SectionSubNav` (Ebenen-Umschalter),
  `EntityDetailShell`-Muster (Budget-Plan).
- **Perioden-Spalten** einheitlich mit `isCurrent`-Tint (`bg-primary/5`), `tabular-nums`.
- **Formatierung:** durchgängig `formatEUR`, `formatCompactEUR` (Chart-Achsen/Kacheln) aus
  `@/lib/formatting` — die im Deepening-Doc erwähnte Zweit-Formatierung (`components/format/eur.tsx`)
  existiert nicht mehr; keine Neueinführung.
- **Charts:** bestehendes `ValueStreamChart` (Recharts) auf der Wertströme-Ebene; Perioden-Balken über
  `progress-bar` statt neuem Chart.
- **Design-Tokens:** keine Inline-`p-6`/`space-y-6` auf Page-Ebene — Layout über `Page`/`PageSection`
  (`docs/design-tokens.md`).

## 4. Reuse-Map (was bleibt, was wird umgebaut)

| Bereich      | Wiederverwendet (Backend/Domain — unverändert)                                          | UI-Änderung                                                                                   |
| ------------ | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Topf & Epics | `loadBudgetingBoardModel`, `buildBudgetingBoardModel`, `saveBudgetPool/Allocation`      | `PoolRow`/`EpicRow` verlieren Zeilen-Save → globale Save-Bar; Perioden-Balken; Inline-Staging |
| Wertströme   | `getValueStreamBudgets`, `rollupByValueStream`, `ValueStreamChart`                      | eigene Ebene statt Board-Fußzeile                                                             |
| ARTs         | `loadArtBudgetModel`, `buildArtBudgetModel`, `saveArtBudget`, `aggregateArtFeatureLoad` | in die Runde geholt + VS-Auswahl; von VS-Detail verlinkt                                      |
| Übersicht    | `loadControllingModel`, `CaptureRevisionButton`                                         | Prozess-Leiste ergänzt; Guardrails umgelabelt                                                 |
| Budget-Plan  | `getBudgetPlanRevision`, `buildBudgetPlanRevisionModel`                                 | visuelles Angleichen                                                                          |
| Staging      | `setEpicFlagAction` (Work)                                                              | zusätzlicher Einstieg im Board (Epic-Overview bleibt)                                         |

## 5. Requirements (testbar)

- **REQ-UI-1** — Es gibt genau eine Arbeitsfläche `/budgeting/round` mit den drei Ebenen Topf&Epics /
  Wertströme / ARTs; `/budgeting/board` leitet dorthin um.
- **REQ-UI-2** — Kein Zeilen-Speichern-Button mehr; eine globale Save-Bar erscheint bei ≥ 1 Änderung,
  zeigt die Anzahl je Typ, und speichert alle Änderungen; Fehler halten die Bar offen.
- **REQ-UI-3** — „Verwerfen" stellt exakt die zuletzt geladenen Server-Werte wieder her.
- **REQ-UI-4** — Je Halbjahr zeigt der Perioden-Kopf einen Balken Σ-zugeteilt/Topf; ≥ 100 % rot.
- **REQ-UI-5** — Auf der Ebene „Topf & Epics" lassen sich Kandidaten (Hypothese/BC freigegeben) inline
  vormerken (`stagedForBudgeting`), ohne den Epic-Overview zu verlassen.
- **REQ-UI-6** — Die ART-Verteilung ist innerhalb `/budgeting/round` (Ebene ARTs) bedienbar, mit
  Wertstrom-Auswahl; die VS-Detailseite verlinkt dorthin (eine Datenquelle).
- **REQ-UI-7** — Die Prozess-Leiste zeigt je Schritt erledigt/offen/blockiert + Deep-Link; abgeleitet
  aus den in 3.4 genannten Bedingungen.
- **REQ-UI-8** — Alle Flächen nutzen die Design-System-Primitives (`Page`, `Card`, `Stat`,
  `progress-bar`, `toggle-group`) und `formatEUR`/`formatCompactEUR`; keine neue EUR-Formatierung.
- **REQ-UI-9** — Capability-Gating unverändert: Editierbarkeit der Ebenen folgt `budget.manage` bzw.
  `art_budget.manage`/Finance-Approver; ohne Recht read-only.
- **REQ-UI-10** — Keine Backend-/Datenmodell-Änderung; Budgeting bleibt read-only ggü. Work.

## 6. Rollout / Nicht im Umfang

- **Rollout in Stufen:** (1) Runde-Shell + Ebenen-Umschalter + Redirect; (2) Save-Bar/Dirty-Tracking;
  (3) ART-Ebene integrieren; (4) Prozess-Leiste; (5) Übersicht-/Budget-Plan-Politur.
- **Nicht im Umfang:** Batch-Server-Action (optionale Ausbaustufe), Guardrails-Umzug (separat, Work),
  Mehrsprachigkeit (Dashboard ist einsprachig Deutsch, Inline-Copy), Änderungen an der Snapshot-Logik.

## 7. Referenzen

- `src/modules/budgeting/README.md`, `docs/concepts/budgeting-module-deepening.md` (Terminologie,
  REQ-_/F-_), ADR-0013 (Layering), ADR-0019 (Epic-Fenster folgt dem Reifegrad-Plan), ADR-0015
  (entfernte Write-Kopplung), `docs/design-tokens.md`.
- Vorbild-Shells: `EntityDetailShell`, `StructurePageShell`, `ZieleShell` (capability-gated Edit +
  Sub-Tabs + Layout-Toggle).
