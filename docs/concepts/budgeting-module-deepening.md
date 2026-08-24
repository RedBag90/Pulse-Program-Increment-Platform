# Budgeting-Modul — Spec & Refactoring-Plan

> **Alt-Schicht (Stand 2026-08).** Dieses Dokument beschreibt die **frühere** €/ART-Board-orientierte
> Sicht des Budgeting-Moduls und ihren Deepening-Plan. Seit dem PB-Refactor ist die **Participatory-
> Budgeting-Runde der Prozess** und die €/ART-Verteilung eine **Detailplanungs-Stufe** darin — siehe
> [participatory-budgeting.md](./participatory-budgeting.md) (geführter Fluss, Seam, ein Protokoll) und
> [budgeting-ui-refactor.md](./budgeting-ui-refactor.md). Hier als Referenz/Historie belassen.

Ergebnis einer Modul-Analyse (Stand 2026-08-18). **Teil A** ist die aus dem Code abgeleitete
fachliche Spec (Anforderungen `REQ-*` + Funktionsinventar `F1`–`F15`), **Teil B** die Befundliste
(`F-01`–`F-19`), **Teil C** der daraus abgeleitete Refactoring-Plan in Arbeitspaketen `WP1`–`WP9`.

**Status: umgesetzt (2026-08-19).** Alle neun Arbeitspakete sind gebaut; offene Punkte stehen
unten unter „Nicht umgesetzt". Vokabular wie in
[work-module-deepening.md](./work-module-deepening.md): _tief_ = viel Verhalten hinter kleinem
Interface; _flach_ = Interface ≈ Implementierung; _Seam_ = Ort des Interfaces.

## Context

Das Modul [src/modules/budgeting/](../../src/modules/budgeting/) (25 Dateien, ~3.640 Zeilen — eines der
**kleinsten** Module der Plattform; work hat 32k, drumbeat 16k Zeilen) wirkt fragmentiert und
unübersichtlich. Die Ursache ist also nicht Größe, sondern **Streuung**:

- **Drei parallele `features/`-Silos** (`budgeting/`, `art-budget/`, `controlling/`) zerschneiden
  einen einzigen Fach-Workflow (Topf → Epic → Wertstrom → ART → Snapshot) in drei Ordner mit je
  eigenem `actions/`, plus ein viertes `features/lib/` auf Modul-Ebene.
- **Ein Konzept, n Implementierungen:** die Halbjahres-Perioden-Karte, die Perioden-Achse, die
  „Verbleibend"-Rechnung, die Summe über eine Perioden-Karte und das EUR-Format existieren jeweils
  in 2–5 Varianten — teils mit unterschiedlichen Regeln.
- **Fremde Verantwortung im Modul:** die Portfolio-Guardrail-Targets liegen fachlich vollständig
  in Work, werden aber von Budgeting gehostet.
- **Keine Page-Models für die drei großen Sichten:** Board, ART-Breakdown und Revisions-Detail
  leiten in 349 / 250 / 426 Zeilen Komponente selbst ab, obwohl das Modul mit
  `controlling-overview.ts` die richtige Naht bereits vorbildlich zeigt.
- **Null Service-Tests** — die vier Services sind komplett ungetestet.

Zusätzlich liegt eine **uncommittete Änderung** im Working Tree, die die letzte Schreibkopplung
Budgeting → Work entfernt. Nach Nutzer-Entscheid wird dieser Stand als **Soll** festgeschrieben:
Budgeting ist gegenüber Work vollständig **read-only**. Der Refactor räumt die Reste auf.

Zuschnitt laut Nutzer-Entscheid: **voller Umfang** — Modul-Konsolidierung + Außenkanten
(Ports & Entitlement-Degradation) + Bugfixes + Doku-Abgleich.

---

# TEIL A — Fachliche Spec (aus dem Code abgeleitet)

## A.0 Fachlicher Rahmen

Budgeting ist die **Geldverteilungs-Schicht** über Work. Es beantwortet drei Fragen auf drei
Ebenen, alle auf einer **Halbjahres-Achse** (`"YYYY-H1"` / `"YYYY-H2"`):

| Ebene     | Frage                                                             | Entscheider                             | Persistenz                                      |
| --------- | ----------------------------------------------------------------- | --------------------------------------- | ----------------------------------------------- |
| Portfolio | Wie viel Geld gibt es je Halbjahr, welches Epic bekommt wie viel? | Portfolio-Manager / Tenant-Admin        | `Tenant.budgetPoolByPeriod`, `BudgetAllocation` |
| Wertstrom | Wie viel Budget hat ein Wertstrom?                                | _niemand_ — **abgeleitet**              | keine (Read-Model)                              |
| ART       | Wie verteilt der Wertstrom auf seine ARTs?                        | Finance-Approver des VS (oder PM/Admin) | `ArtBudget`                                     |

Quer dazu: **Budget-Plan-Revisionen** frieren den Gesamtzustand je Halbjahr als denormalisiertes
JSON ein; eine **Controlling-Übersicht** ist die Landing-Page.

Das Halbjahr ist bewusst die Periode: es entspricht einer 6-Monats-Kostenscheibe im Business Case
(`businessCase.costSlices`). Die Perioden-Mathe gehört laut ADR-0012 in `calendar.ts` (Core-Kernel),
**nicht** in `goal-period.ts`.

## A.1 Anforderungen (REQ)

### Participatory Budgeting (Board)

- **REQ-B1 — Kandidatenmenge.** Epics mit `level = EPIC`, `deletedAt = null`,
  `stagedForBudgeting = true` **und** (freigegebener Hypothese **oder** freigegebenem Business
  Case). Initiale Reihenfolge `createdAt asc`.
  → [budgeting.ts:70-92](../../src/modules/budgeting/server/services/budgeting.ts#L70-L92)
- **REQ-B2 — Bedarf ist abgeleitet, nie erfasst.**
  - Business-Case-Epic: Kostenscheibe _i_ fällt in das (Startperiode + _i_)-te Halbjahr.
  - Hypothesen-Epic (kein freigegebener BC): **Festbudget** `hypothesisBudget` in der Startperiode.
  - Startperiode = `halfYearKey(deriveEpicEconomics(...).costStart)` — Quelle ist **Work**.
  - Perioden außerhalb der Achse werden verworfen.
    → [budgeting.ts:55-76](../../src/modules/budgeting/domain/budgeting.ts#L55-L76)
- **REQ-B3 — Zuteilung.** Je Epic: `priority` (Int), `hypothesisBudget` (nur Hypothesen-Epics),
  Allokationskarte `{ Halbjahr → Betrag ≥ 0 }`. Die Zuteilung muss dem Bedarf **nicht** entsprechen.
- **REQ-B4 — Topf & Verbleibend.** Verbleibend = Topf − Σ Epic-Allokationen je Halbjahr.
  **Negativ ist erlaubt** (rot markiert) — Überallokation ist Warnung, kein Fehler.
  → [budgeting.ts:161-172](../../src/modules/budgeting/domain/budgeting.ts#L161-L172)
- **REQ-B5 — Perioden-Achse.** Lückenlos vom frühesten Epic-Start bzw. der frühesten Topf-Periode
  bis zum spätesten Bedarfs-/Topf-Ende. Bewusst **tenant-weit**, nicht pro Wertstrom — sonst
  verschieben sich die Spalten (dokumentiert in `getValueStreamBudget`).
- **REQ-B6 — Wertstrom-Verteilung.** Σ Allokationen je Wertstrom je Periode als gestapelter
  Balken. Epics ohne Wertstrom bilden den Bucket `__none__` / „Ohne Wertstrom".
- **REQ-B7 — Speichern je Zeile.** Epic-Zeile und Topf speichern **einzeln**, nicht board-weit.
  Berechtigung `budget.manage`.

### Wertstrom-Budget (abgeleitet)

- **REQ-V1 — Kein gespeicherter Wert.** Das Wertstrom-Budget ist immer das Roll-up der
  Epic-Allokationen. _(`ValueStream.budgetAmount` existiert im Schema, wird von Budgeting **nicht**
  gelesen → zwei konkurrierende Begriffe, siehe F-12.)_
- **REQ-V2 — `__none__` fällt in der VS-Sicht raus**, bleibt aber im Snapshot erhalten.

### ART-Budget

- **REQ-A1 — Verteilung.** Finance verteilt das abgeleitete VS-Budget je Halbjahr auf die ARTs;
  gespeichert je ART als `{ Halbjahr → Betrag }`.
- **REQ-A2 — Verbleibend.** VS-Budget − Σ ART-Budgets je Periode; negativ = Überverteilung.
- **REQ-A3 — Entscheidungsunterstützung.** Je ART: Feature-Anzahl + Σ WSJF Job Size, gebucketet
  nach dem Halbjahr des zugewiesenen PI. Features ohne PI → Bucket **Backlog**. ARTs ohne Features
  erscheinen mit Null-Last.
- **REQ-A4 — Spalten.** VS-Budget-Perioden **∪** Halbjahre, in die Feature-PIs fallen.
- **REQ-A5 — Autorisierung.** Schreiben darf der **Finance-Approver des Wertstroms**
  (`ValueStream.financeApproverId`) oder Portfolio-Manager / Tenant-Admin / Platform-Admin.
  Die verbindliche Prüfung liegt **im Service** (ADR-0002). _→ heute inkonsistent, siehe F-01._

### Budget-Plan-Revision (Snapshot)

- **REQ-R1 — Manuelles Einfrieren**, vollständig denormalisiert — rendert ohne Live-Tabellen.
- **REQ-R2 — Idempotent je Zyklus.** Upsert auf `(tenantId, cycleKey)`; ein zweiter Capture im
  selben Halbjahr **überschreibt**, das Audit-Log hält beide fest.
- **REQ-R3 — Inhalt.** Epic-Ranking (nach `priority`, stabil bei Gleichstand), Allokationen je Epic
  über alle Perioden, `total`/`cycleBudget` je Epic, Wertstrom-Roll-up, ART-Roll-up (eingefrorenes
  Budget + Feature-Last inkl. Backlog), Tenant-Topf, sowie die Features, die im erfassten Zyklus
  einem PI zugewiesen waren.
- **REQ-R4 — Kennzahlen.** `cycleBudgetSum` (Σ Allokation im Zyklus) und `followBudgetSum`
  (Σ Rest in späteren Halbjahren) — **eine** Quelle für Liste, Detail und Übersicht.
- **REQ-R5 — Sichtbare Spalten.** Vorgänger-Halbjahr (Anker) + Zyklus + alle späteren Perioden mit
  Daten; ältere Historie ausgeblendet.
- **REQ-R6 — Payload-Versionierung.** `{ version, snapshot }`-Envelope; ein altes „bares" Snapshot-
  Objekt wird noch akzeptiert. Ein nicht interpretierbarer Payload muss **werfen**, nicht still
  Nullen rendern.
- **REQ-R7 — Berechtigung** `budget_plan.revision.capture`.

### Controlling-Übersicht

- **REQ-C1 — Landing-Page:** aktiver Zyklus, ob die jüngste Revision zum aktiven Zyklus gehört,
  Kennzahlen, Top-5 Epics / Top-5 Wertströme / Topf, Historie.
- **REQ-C2 — Empty-State** mit Capture-CTA.
- **REQ-C3 — Determinismus:** „heute" wird injiziert, nie im Builder gelesen.

### Kanten nach außen

- **REQ-P1 — Read-Port.** Work fragt über eine strukturell typisierte Naht
  (`getEpicBudgetAllocation → { allocatedSum }`) ab, ob ein Epic Budget hat. Work importiert
  Budgeting **nie** (ESLint-erzwungen, ADR-0013).
- **REQ-P2 — Kein Schreiben nach unten.** Budgeting schreibt ausschließlich `BudgetAllocation`,
  `ArtBudget`, `BudgetPlanRevision` und `Tenant.budgetPoolByPeriod`.
  **Soll-Zustand (Nutzer-Entscheid):** Das Epic-Soll-Fenster folgt dem Reifegrad-Plan des Owners
  (`saveTimeline` → L4.1/L4.2), **nicht** dem finanzierten Fenster. Das in ADR-0015 vorgesehene
  Event `FundedWindowDecided` wird **nicht** gebaut — ein Seiteneffekt, den es nicht gibt, braucht
  kein Event.
- **REQ-P3 — Entitlement-Degradation.** Jede Seite, die Budgeting-Daten zeigt, muss ohne das
  Budgeting-Entitlement funktionieren (ADR-0013). _→ heute nur auf der Epic-Seite erfüllt, F-05._

## A.2 Funktionsinventar (Ist)

| #   | Funktion                                | Route                                                                                          | Domain                                          | Service                                       | Schreibt                    |
| --- | --------------------------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------- | --------------------------------------------- | --------------------------- |
| F1  | Budget-Topf je Halbjahr pflegen         | `/budgeting/board`                                                                             | —                                               | `saveBudgetPool`                              | `Tenant.budgetPoolByPeriod` |
| F2  | Epic priorisieren + allozieren          | `/budgeting/board`                                                                             | `requestedByPeriod`                             | `saveBudgetAllocation`                        | `BudgetAllocation`          |
| F3  | Board lesen (Bedarf/Allokation/Achse)   | `/budgeting/board`                                                                             | `buildHalfYearAxis`                             | `getBudgetingBoard`                           | —                           |
| F4  | Wertstrom-Verteilung (Chart)            | `/budgeting/board`                                                                             | `rollupByValueStream`, `buildValueStreamSeries` | —                                             | —                           |
| F5  | Verbleibend gegen Topf                  | `/budgeting/board`                                                                             | `poolRemaining`                                 | —                                             | —                           |
| F6  | VS-Budgets (alle)                       | `/structure`, `/timelines`, `/portfolio`, `/reporting/portfolio-health`, `/value-streams/[id]` | `rollupByValueStream`                           | `getValueStreamBudgets`                       | —                           |
| F7  | VS-Budget (eines)                       | intern (von F8)                                                                                | `rollupByValueStream`                           | `getValueStreamBudget`                        | —                           |
| F8  | ART-Budget-Breakdown lesen              | `/value-streams/[id]`                                                                          | `aggregateArtFeatureLoad`, `artBudgetRemaining` | `getArtBudgetBreakdown`                       | —                           |
| F9  | ART-Budget schreiben                    | `/value-streams/[id]`                                                                          | —                                               | `saveArtBudget`                               | `ArtBudget`                 |
| F10 | Revision einfrieren                     | `/budgeting`, `/budgeting/budget-plan[/id]`                                                    | `buildBudgetPlanSnapshot`                       | `captureBudgetPlanRevision`                   | `BudgetPlanRevision`        |
| F11 | Revisionen listen / lesen               | `/budgeting/budget-plan`                                                                       | `summarizeSnapshot`                             | `list-/get-/getLatestBudgetPlanRevision`      | —                           |
| F12 | Revision anzeigen                       | `/budgeting/budget-plan/[id]`                                                                  | `computeDisplayPeriods`                         | —                                             | —                           |
| F13 | Controlling-Übersicht                   | `/budgeting`                                                                                   | —                                               | `loadControllingModel` (View-Seam)            | —                           |
| F14 | Epic-Allokations-Port für Work          | `/portfolio/epics/[id]`                                                                        | —                                               | `getEpicBudgetAllocation`                     | —                           |
| F15 | **Portfolio-Guardrail-Targets pflegen** | `/budgeting`                                                                                   | _Work_ `portfolio-guardrails`                   | _Work_ `savePortfolioDashboardSettingsAction` | `Tenant.guardrailTargets`   |

**F15 gehört nicht zu Budgeting** — Domain, Validierung, Action und Persistenz sind Work-eigen;
Budgeting hostet nur zwei UI-Komponenten. Nutzer-Entscheid: **nach Work verschieben.**

---

# TEIL B — Befunde

## B.1 Echte Defekte

| #        | Befund                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Beleg                                                                                                                                                                                                                                                                                                                                                                     |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **F-01** | **Wertstrom-Owner bekommt einen Editor, der beim Speichern scheitert.** Policy gewährt `art_budget.manage` an `VALUE_STREAM_OWNER` (sogar **ohne** `scope: "value_stream"`, also für _jeden_ Wertstrom). Die Seite zeigt daraufhin das editierbare ART-Grid. `saveArtBudget` prüft dann aber `financeApproverId === actor \|\| roles ∈ {portfolio_manager, tenant_admin, platform_admin}` — VS-Owner ist nicht dabei → `forbidden`. Das Onboarding-Playbook verspricht der Rolle diese Aufgabe zusätzlich explizit. | [policies/index.ts:139](../../src/server/auth/policies/index.ts#L139), [art-budget.ts:113-126](../../src/modules/budgeting/server/services/art-budget.ts#L113-L126), [value-streams/[id]/page.tsx:133-138](<../../src/app/[locale]/(dashboard)/value-streams/[id]/page.tsx#L133-L138>), [role-playbook.ts:360](../../src/modules/onboarding/domain/role-playbook.ts#L360) |
| **F-02** | **Totes Control „Bedarf ab".** Das `<select>` für `startKey` ändert lokalen State, wird von `submit()` aber **nie** mitgesendet — `startKey` ist aus `deriveEpicEconomics(...).costStart` abgeleitet. Vor dem in-flight-Diff hatte es indirekt Wirkung; jetzt ist es reine Illusion.                                                                                                                                                                                                                                | [budgeting-board.tsx:294-308 vs. 262-273](../../src/modules/budgeting/features/budgeting/components/budgeting-board.tsx#L294-L308)                                                                                                                                                                                                                                        |
| **F-03** | **Allokations-Speichern lässt vier Seiten veraltet.** `saveBudgetAllocationAction`/`saveBudgetPoolAction` revalidieren `"epic"` → deckt `/budgeting/board` ab, aber **nicht** `/structure`, `/timelines`, `/reporting/portfolio-health`, `/value-streams/[id]` — die alle VS-Budget-Summen aus genau diesen Allokationen zeigen. Es gibt keine Revalidierungs-Ressource `budgetAllocation`.                                                                                                                         | [revalidation.ts:53-60](../../src/server/http/revalidation.ts#L53-L60)                                                                                                                                                                                                                                                                                                    |
| **F-04** | **ADR-0002 verletzt.** `saveBudgetAllocation` upsertet `budgetAllocation` per `epicId` **ohne** Epic zu laden, ohne Tenant-Prüfung und ohne `authorizeResource`. Die Action deklariert `resource: (_input, p) => ({ tenantId: p.tenantId })`, wodurch jeder `value_stream`-Scope vakuant erfüllt ist. `loadAuthorizedEpic` (Work) wäre importierbar.                                                                                                                                                                | [budgeting.ts:204-243](../../src/modules/budgeting/server/services/budgeting.ts#L204-L243)                                                                                                                                                                                                                                                                                |
| **F-05** | **Keine Entitlement-Degradation.** Fünf Seiten rufen `getValueStreamBudgets` / `getBudgetingBoard` / `getArtBudgetBreakdown` direkt auf, **ohne** `principal.enabledModules.includes("budgeting")`. Ein Tenant ohne Budgeting-Entitlement sieht Budget-Spalten und das ART-Budget-Grid. Nur `/portfolio/epics/[id]` macht es richtig (Port + `enabled` + diskriminierte Slice).                                                                                                                                     | `structure`, `timelines`, `portfolio`, `reporting/portfolio-health`, `value-streams/[id]`                                                                                                                                                                                                                                                                                 |
| **F-06** | **`listBudgetPlanRevisions` lädt jeden Payload komplett**, nur um Kopfzeilen zu bilden — und die Detailseite ruft zusätzlich `getBudgetPlanRevision` für dieselbe Revision auf (Payload 2× geparst).                                                                                                                                                                                                                                                                                                                | [budget-plan-revision.ts:126-145](../../src/modules/budgeting/server/services/budget-plan-revision.ts#L126-L145)                                                                                                                                                                                                                                                          |

## B.2 Fragmentierung (die eigentliche Beschwerde)

| #        | Ein Konzept — n Implementierungen                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **F-07** | **Perioden-Achse: 4 verschiedene Regeln.** (a) `loadBudgetingModel` spannt von frühestem Epic-Start/Topf bis spätestem Bedarfsende; (b) `getArtBudgetBreakdown` bildet `VS-Perioden ∪ Feature-PI-Halbjahre`, sortiert; (c) `buildBudgetPlanSnapshot` nimmt alle Keys mit Daten — und baut _zusätzlich_ eine zweite Achse via `buildHalfYearAxis`; (d) `computeDisplayPeriods` nimmt Vorgänger + Zyklus + spätere. Vier Stellen, vier Regeln, keine gemeinsame Naht. |
| **F-08** | **„Verbleibend" 2×, „Summe einer Perioden-Karte" 4×.** `poolRemaining` und `artBudgetRemaining` sind formgleich (`budget[k] − Σ children[k]`). Die Summe über eine Perioden-Karte steht ad-hoc in `epic-allocation.ts`, `budget-plan-snapshot.ts` (2×) und `budget-plan-revision-view.tsx`.                                                                                                                                                                         |
| **F-09** | **Ein Roll-up, drei Ziel-Shapes.** `ValueStreamRollup` wird nach `ValueStreamBudget`, nach `BudgetPlanSnapshotValueStream` und nach `ChartRow` projiziert — jede Projektion an anderer Stelle, mit eigener Label-Politik für den `__none__`-Bucket (einmal verworfen, einmal „Ohne Wertstrom").                                                                                                                                                                     |
| **F-10** | **Formular-Envelope 3× kopiert.** Alle drei Action-Dateien definieren dieselbe lokale `payload(fd)`-Funktion, zwei davon zusätzlich dasselbe `periodMap`-Zod-Schema. Der JSON-in-FormData-Envelope ist außerdem eine **Budgeting-Eigenheit** — der Rest der Codebase nutzt `parseFromSchema`.                                                                                                                                                                       |
| **F-11** | **Zwei EUR-Formatter, beide „single source of truth".** `formatEUR` ([lib/formatting.ts:25](../../src/lib/formatting.ts#L25)) und `fmtEur` ([components/format/eur.tsx](../../src/components/format/eur.tsx)) sind zeichengleich implementiert. Budgeting benutzt **beide**: Board + ART-Breakdown das eine, Revisions-View + Controlling-Seite das andere.                                                                                                         |
| **F-12** | **Zwei Begriffe „Wertstrom-Budget".** `ValueStream.budgetAmount`/`budgetCurrency` liegen im Schema, werden von Budgeting nie gelesen — das wirksame VS-Budget ist ausschließlich das Roll-up. Die gespeicherte Spalte ist stille Fehlinformation.                                                                                                                                                                                                                   |
| **F-13** | **Keine Page-Models für die drei großen Sichten.** `budgeting-board.tsx` (349 Z.) leitet Achse, Pool-Zahlen, Remaining, Rollup und Chart-Rows in fünf `useMemo`s ab; `art-budget-breakdown.tsx` (250 Z.) und `budget-plan-revision-view.tsx` (426 Z.) analog. Das Modul zeigt mit `controlling-overview.ts` selbst das richtige Muster (impurer Loader + **reiner** Builder).                                                                                       |
| **F-14** | **Drei `features/`-Silos + `features/lib/`** für einen Workflow. Zum Vergleich: `work/` bündelt in `features/portfolio/` mit `actions/`, `components/`, `lib/`, `hooks/`.                                                                                                                                                                                                                                                                                           |

## B.3 Verwaiste Reste & stale Doku (Folge des in-flight-Diffs)

| #        | Befund                                                                                                                                                                                                                                                                                                                                                        |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **F-15** | `fundedPeriodRange` / `fundedEndDate` in [core/kernel/domain/budget-period.ts](../../src/modules/core/kernel/domain/budget-period.ts) haben **keinen Produktionsaufrufer mehr** — nur noch der Re-Export in `domain/budgeting.ts` und dessen Test.                                                                                                            |
| **F-16** | [src/modules/budgeting/README.md](../../src/modules/budgeting/README.md): „Status: **Skelett** (Phase P1)" (Modul ist voll besiedelt) und „**Schreibt** Epic-Fenster ausschließlich via Event `FundedWindowDecided`" — das Event existiert in [server/events/types.ts](../../src/server/events/types.ts) **nicht** und wird laut Entscheid auch nicht gebaut. |
| **F-17** | [ADR-0015](../../docs/adr/0015-cross-module-write-through-via-events.md) endet mit „offen ist … die `Initiative.timeline`/`plannedStartAt`-Schreibkopplung in `saveBudgetAllocation`" — genau die ist jetzt weg.                                                                                                                                              |
| **F-18** | `CONTEXT.md:73-78` beschreibt noch den alten Vertrag (`withScheduleEstimates`, „last writer wins", „Budgeting berührt nur Backlog-/Implementation-Estimates").                                                                                                                                                                                                |
| **F-19** | Beide Seeds bauen `BudgetPlanRevision.payload` **von Hand** statt über `buildBudgetPlanSnapshot` — inkl. hartkodierter `loadByPeriod: { featureCount: 3, jobSizeSum: 18 }`. Driftet garantiert von `REQ-R3`/`REQ-R6` weg.                                                                                                                                     |

## B.4 Was gut ist (nicht anfassen)

- `domain/` ist rein, testbar und gut dokumentiert; die Wiederverwendung von `rollupByValueStream`
  und `aggregateArtFeatureLoad` im Snapshot ist genau richtig.
- `controlling-overview.ts` ist das Vorbild-Page-Model (Loader + reiner Builder + injiziertes `now`).
- `epic-allocation.ts` ist ein sauberer 30-Zeilen-Port mit defensiver Tenant-Prüfung.
- `parseSnapshotEnvelope` wirft statt still Nullen zu rendern — richtig.
- `allocation-payload.ts` (typisierte Client-Encoder, die die Zod-Shape spiegeln) ist ein gutes
  Muster und bleibt.
- **Nicht** vorschlagen: ein generisches „financial-period"-Prorate-Modul — [ADR-0006](../../docs/adr/0006-round-4-closeout.md#L54-L75)
  hat das bereits untersucht und explizit verworfen („Re-suggesting … would not find new evidence").
  Die hier vorgeschlagene Konsolidierung ist etwas anderes: sie räumt Budgeting-**interne** Duplikate
  auf, sie extrahiert keine Prorate-Abstraktion über `epic-economics`/`portfolio-economics` hinweg.

---

# TEIL C — Refactoring-Plan

Reihenfolge ist die empfohlene Ausführungsreihenfolge. WP1–WP3 sind reine Konsolidierung ohne
Verhaltensänderung; WP4–WP6 ändern Verhalten (Bugfixes); WP7–WP9 sind Struktur/Doku/Tests.

## WP1 — Ein Perioden-Primitiv (`domain/period-map.ts`)

**Problem:** F-08, teilweise F-07.
**Neu:** `src/modules/budgeting/domain/period-map.ts` — der eine Besitzer der Rechnungen auf
`Record<HalfYearKey, number>`:

```ts
export type PeriodAmounts = Record<string, number>;
export function sumPeriods(m: PeriodAmounts): number;
export function addPeriods(target: PeriodAmounts, key: string, amount: number): void; // aus budget-plan-snapshot.addCell
export function remainingByPeriod(
  budget: PeriodAmounts,
  children: readonly PeriodAmounts[],
  keys: readonly string[],
): PeriodAmounts;
```

- `poolRemaining` und `artBudgetRemaining` werden **dünne benannte Wrapper** über
  `remainingByPeriod` (Namen bleiben — die Fachbegriffe „Topf" und „VS-Budget" sind verschieden,
  nur die Mathe ist gleich). Ihre bestehenden Tests bleiben grün.
- Die vier Ad-hoc-`Object.values(...).reduce(...)` in `epic-allocation.ts`,
  `budget-plan-snapshot.ts` und `budget-plan-revision-view.tsx` rufen `sumPeriods`.
- `parsePeriodAmountMap` bleibt im Core-Kernel (Work konsumiert es auch, ADR-0013) und wird
  weiterhin aus `domain/budgeting.ts` re-exportiert.

## WP2 — Perioden-Fenster als benannte Regeln (`domain/period-window.ts`)

**Problem:** F-07.
Die vier impliziten Achsen-Regeln bekommen Namen und Tests, statt an vier Stellen inline zu leben:

```ts
export function forecastAxis(epicStarts: Date[], poolKeys: string[], epicSpans: …): HalfYearAxis;  // aus loadBudgetingModel
export function budgetPlusLoadPeriods(vsKeys: string[], featurePiStarts: Date[]): Period[];        // aus getArtBudgetBreakdown
export function occupiedPeriods(totals: PeriodAmounts): Period[];                                  // aus buildBudgetPlanSnapshot
// computeDisplayPeriods bleibt, wandert aber hierher (heute in budget-plan-snapshot.ts)
```

`buildBudgetPlanSnapshot` baut damit **eine** Achse statt zweier (heute `occupiedPeriods` + ein
zweites `buildHalfYearAxis` für das VS-Roll-up).

## WP3 — `features/` von drei Silos auf eine Slice

**Problem:** F-10, F-14.

```
features/
  actions/budgeting.ts          ← saveBudgetAllocationAction, saveBudgetPoolAction,
                                   saveArtBudgetAction, captureBudgetPlanRevisionAction
  lib/allocation-payload.ts     ← unverändert (+ die eine geteilte payload()/periodMap-Definition)
  components/
    board/{budgeting-board,budgeting-board-lazy,pool-row,epic-row}.tsx
    art-budget/art-budget-breakdown.tsx
    revision/{budget-plan-revision-view,capture-revision-button}.tsx
```

- Die 3× kopierte `payload(fd)` und das 2× kopierte `periodMap`-Zod-Schema werden **je einmal**
  in `features/lib/allocation-payload.ts` (Client-Seite existiert dort schon) bzw. am Kopf der
  Action-Datei definiert. Kein neuer Envelope — ADR-0004 will Schemas am Rand, das bleibt so.
- `PoolRow` / `EpicRow` (heute Sub-Komponenten in einer 349-Zeilen-Datei) werden eigene Dateien.

## WP4 — Page-Models für Board, ART-Breakdown und Revision

**Problem:** F-13.
Vorbild ist das modul-eigene `server/views/controlling-overview.ts` (Loader + **reiner** Builder,
`now` injiziert). Neu in `server/views/`:

| Datei                     | Reiner Builder                                                                                                         | Ersetzt                                        |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `budgeting-board.ts`      | `buildBudgetingBoardModel({ epics, axis, pool })` → Achse, Pool-Zahlen, Remaining, Rollup, Chart-Rows, Bedarf je Zeile | 5 `useMemo`s in `budgeting-board.tsx`          |
| `art-budget-breakdown.ts` | `buildArtBudgetModel({ vsBudget, arts, features })` → Spalten, Remaining, Last-Zellen                                  | Ableitungen in `art-budget-breakdown.tsx`      |
| `budget-plan-revision.ts` | `buildRevisionViewModel(snapshot)` → Display-Perioden, Summen, Sektions-Daten                                          | Ableitungen in `budget-plan-revision-view.tsx` |

Die Client-Komponenten behalten nur ihren **Edit-State** (`useState` der Eingabe-Strings,
`useActionState`) — alles Abgeleitete kommt vorberechnet über die RSC-Grenze. Die Board-Komponente
muss weiterhin bei jedem Tastendruck neu rechnen; dafür ruft sie **dieselben** reinen Builder-
Funktionen erneut auf, statt eine zweite Ableitungslogik zu halten.

## WP5 — Außenkanten: Port + Entitlement-Degradation

**Problem:** F-05, F-03, plus die 3× kopierte `budgetTotals`-Ableitung.

1. Neuer Service-Export `getValueStreamBudgetTotals(db, tenantId): Promise<Record<string, number>>`
   — genau die Map, die `structure`, `timelines` und `reporting/portfolio-health` heute je selbst
   aus `getValueStreamBudgets(...).valueStreams` bauen.
2. Diese drei Seiten + `/value-streams/[id]` bekommen das ADR-0013-Muster nach Vorbild von
   [portfolio/epics/[id]/page.tsx](<../../src/app/[locale]/(dashboard)/portfolio/epics/[id]/page.tsx>):
   `enabled.budgeting` prüfen, Adapter injizieren, Slice diskriminiert (`{disabled:true}` |
   `{disabled:false, …}`). Der Port-**Typ** wird im konsumierenden Modul deklariert
   (`core/org/server/views/structure-page.ts` bzw. die Seite), nicht in Budgeting.
3. `/value-streams/[id]` nutzt künftig `getValueStreamBudget(db, tenantId, vsId)` statt
   `getValueStreamBudgets(...).find(...)` — der schmale Seam existiert bereits genau dafür.
4. Neue Revalidierungs-Ressource `budgetAllocation` in
   [revalidation.ts](../../src/server/http/revalidation.ts): `["/budgeting/board", "/budgeting", "/structure", "/timelines", "/value-streams/[id]", "/reporting/portfolio-health", "/portfolio"]`.
   `saveBudgetAllocationAction` und `saveBudgetPoolAction` deklarieren sie statt `"epic"`.

## WP6 — Bugfixes

- **F-01 (Produkt-Entscheid nötig, Default unten):** `art_budget.manage` bekommt
  `scope: "value_stream"`, und `saveArtBudget` prüft künftig über `authorizeResource(principal,
"art_budget.manage", { tenantId, valueStreamId, artId })` **plus** den Finance-Approver-Sonderweg
  — statt der handgeschriebenen Rollenliste (CONTEXT.md: „pages should ask for a capability, never
  re-list roles inline"). Damit deckt sich die Berechtigung mit Policy, UI und Onboarding-Playbook.
  _Alternative, falls VS-Owner bewusst ausgeschlossen sein soll: `VALUE_STREAM_OWNER` aus der Policy
  entfernen und den Playbook-Eintrag streichen. Das ist eine Produktfrage — ich frage vor der
  Umsetzung nach._
- **F-02:** Das „Bedarf ab"-`<select>` wird zu einem **Read-only-Label** (der Wert ist abgeleitet)
  mit Verweis auf den Reifegrad-/Timeline-Tab des Epics.
- **F-04:** `saveBudgetAllocation` lädt das Epic zuerst (Tenant + `valueStreamId`) und ruft
  `authorizeResource` — nach dem Muster von `loadAuthorizedEpic` (Work). Damit greift der
  `value_stream`-Scope statt vakuant zu passieren.
- **F-06:** `BudgetPlanRevision` bekommt denormalisierte Kopfspalten (`epicCount`,
  `cycleBudgetSum`, `followBudgetSum`) per additiver Migration, gefüllt beim Capture;
  `listBudgetPlanRevisions` selektiert dann `payload` nicht mehr. `summarizeSnapshot` bleibt als
  Fallback für Altdaten (REQ-R6-Politik). _Falls eine Migration hier zu viel ist: mindestens die
  Doppel-Parse auf der Detailseite entfernen (`history` liefert bereits den Header)._

## WP7 — Guardrail-Targets nach Work verschieben (Nutzer-Entscheid)

`guardrail-targets-form.tsx` und `guardrail-targets-readonly.tsx` wandern nach
`src/modules/work/features/portfolio/components/`. `/budgeting/page.tsx` importiert sie von dort
(Abwärts-Import, ADR-0013-konform). Budgeting verliert damit seinen einzigen Aufruf einer
Work-Server-Action aus einer Client-Komponente. `controlling-overview.ts` darf
`getPortfolioGuardrailsInputs` weiter aufrufen (Read nach unten ist erlaubt).

## WP8 — Tests

Heute: 5 Testdateien, 43 Fälle, **alle** auf `domain/` + `views/` + `features/lib/`; die vier
Services sind ungetestet. Neu, nach der Konvention `server/services/__tests__/*.integration.test.ts`
(Projekt `integration`, Fixtures aus `@/test/fixtures/seed`):

- `budgeting.integration.test.ts` — REQ-B1 Kandidatenfilter (staged + genau eine Freigabe),
  Upsert-Verhalten, Tenant-Isolation, Audit-Zeile, **und der Vertrag „Budgeting schreibt keine
  `Initiative`-Spalte"** (Epic-Zeile vor/nach `saveBudgetAllocation` unverändert) — das ist das
  P6-Gate aus der Migrations-Roadmap.
- `art-budget.integration.test.ts` — REQ-A5 in allen vier Rollen-Konstellationen (Finance-Approver,
  PM, Admin, VS-Owner) → deckt F-01 ab.
- `budget-plan-revision.integration.test.ts` — REQ-R2 (Re-Capture überschreibt, zwei Audit-Zeilen),
  REQ-R6 (Envelope, Legacy-Bare, kaputter Payload wirft).
- Reine Tests für die neuen `period-map` / `period-window` Primitive und die drei Page-Model-Builder.

## WP9 — Doku & Reste

- `src/modules/budgeting/README.md` neu schreiben nach Vorbild `work/README.md` (Tabelle
  Datei → Rolle): Status raus, `FundedWindowDecided`-Zusage raus, Read-only-gegenüber-Work rein.
- **Neue ADR** (nächste freie Nummer, Hausstil wie ADR-0015-Nachtrag): „Das Epic-Soll-Fenster folgt
  dem Reifegrad-Plan, nicht dem finanzierten Fenster" — schließt die offene Zeile in ADR-0015 und
  begründet, warum `FundedWindowDecided` entfällt.
- `CONTEXT.md:73-78` auf den Ist-Stand ziehen.
- **F-15:** `fundedPeriodRange`/`fundedEndDate` aus `core/kernel/domain/budget-period.ts` löschen
  (kein Produktionsaufrufer mehr), samt Re-Export in `domain/budgeting.ts` und den zugehörigen
  Testfällen — **erst prüfen**, ob nach WP5/WP6 wirklich kein Aufrufer entstanden ist.
- **F-19:** Beide Seeds bauen ihren Revisions-Payload über `buildBudgetPlanSnapshot` statt von Hand.
- **F-11 (klein, aber der Beschwerde direkt zuträglich):** auf **einen** EUR-Formatter
  vereinheitlichen. `fmtEur` aus `components/format/eur.tsx` wird Re-Export von
  `formatEUR` aus `lib/formatting.ts` (oder umgekehrt) — die Doppelung ist nicht budgeting-spezifisch,
  aber Budgeting ist der einzige Ort, der beide gleichzeitig benutzt.
- **F-12:** Entscheiden, ob `ValueStream.budgetAmount`/`budgetCurrency` entfallen oder als „geplantes
  Rahmenbudget" fachlich abgegrenzt werden. **Nicht Teil dieses Refactors** — als Backlog-Eintrag
  festhalten, weil es eine Schema-/Produktfrage ist.

---

## Kritische Dateien

**Neu:** `domain/period-map.ts`, `domain/period-window.ts`,
`server/views/{budgeting-board,art-budget-breakdown,budget-plan-revision}.ts`,
`server/services/__tests__/*.integration.test.ts`, eine neue ADR.

**Umgebaut:** [domain/budgeting.ts](../../src/modules/budgeting/domain/budgeting.ts),
[domain/budget-plan-snapshot.ts](../../src/modules/budgeting/domain/budget-plan-snapshot.ts),
alle vier Services, alle `features/`-Dateien (verschoben), [README.md](../../src/modules/budgeting/README.md).

**Außerhalb des Moduls:** [revalidation.ts](../../src/server/http/revalidation.ts),
[policies/index.ts](../../src/server/auth/policies/index.ts), die fünf konsumierenden Seiten unter
`src/app/[locale]/(dashboard)/`, `work/features/portfolio/components/` (2 zugezogene Komponenten),
[core/kernel/domain/budget-period.ts](../../src/modules/core/kernel/domain/budget-period.ts),
`prisma/seed-demo.ts`, `prisma/seed-offsite.ts`, `CONTEXT.md`, `docs/adr/`.

## Verifikation

1. `pnpm typecheck && pnpm lint` — Lint prüft die ADR-0013-Import-Grenzen mechanisch
   (`no-restricted-imports` je Modul in `eslint.config.mjs`).
2. `pnpm test` — Domain- + View-Tests; die bestehenden 43 Fälle müssen **ohne Anpassung** grün
   bleiben, wo WP1–WP4 verhaltensneutral sind (`poolRemaining`, `artBudgetRemaining`,
   `requestedByPeriod`, `buildBudgetPlanSnapshot`, `computeDisplayPeriods`, `buildControllingModel`).
3. `pnpm test:integration` — die neuen Service-Tests (braucht `DATABASE_URL_TEST`).
4. `pnpm db:seed:demo`, dann manuell durch den vollen Fach-Workflow:
   `/budgeting/board` (Topf setzen → Verbleibend rechnet, negativ wird rot; Epic-Zeile speichern)
   → `/value-streams/[id]` (VS-Budget spiegelt die Allokation, ART-Grid + Feature-Last)
   → `/budgeting` (Capture) → `/budgeting/budget-plan/[id]` (Snapshot-Zahlen == Board-Zahlen).
5. **Regressionsprüfung F-03:** nach dem Speichern einer Allokation müssen `/structure`,
   `/timelines` und `/reporting/portfolio-health` die neue VS-Summe **sofort** zeigen.
6. **Regressionsprüfung F-05:** Tenant ohne `budgeting`-Entitlement → die fünf Seiten rendern
   ohne Budget-Spalten und ohne Fehler.
7. **Regressionsprüfung F-01:** als Wertstrom-Owner (nicht Finance-Approver) darf entweder
   gespeichert werden **oder** das Grid ist gar nicht erst editierbar — kein „Editor, der scheitert".

---

# TEIL D — Umsetzungsstand (2026-08-19)

## Umgesetzt

| WP  | Ergebnis                                                                                                                                                                                                                                                                                                                                                     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| WP1 | `domain/period-map.ts` (`sumPeriods`, `addPeriod`, `remainingByPeriod`); `poolRemaining`/`artBudgetRemaining` sind benannte Wrapper, die vier Ad-hoc-Summen sind ersetzt                                                                                                                                                                                     |
| WP2 | `domain/period-window.ts` (`forecastAxis`, `budgetPlusLoadPeriods`, `occupiedWindow`, `computeDisplayPeriods`); der Snapshot baut **eine** Achse statt zweier                                                                                                                                                                                                |
| WP3 | `features/` von drei Silos auf eine Slice; die 3× kopierte `payload()` und das 2× kopierte `periodMap` existieren je einmal                                                                                                                                                                                                                                  |
| WP4 | Page-Models für Board, ART-Breakdown und Revision; die Client-Komponenten rufen **dieselben** reinen Builder wie der Server                                                                                                                                                                                                                                  |
| WP5 | `getValueStreamBudgetTotals`; Entitlement-Degradation auf allen fünf konsumierenden Seiten; neue Revalidierungs-Ressource `budgetAllocation`                                                                                                                                                                                                                 |
| WP6 | F-01 (`art_budget.manage` `value_stream`-scoped + `authorizeResource` im Seam), F-02 (totes Select → Label mit Deep-Link), F-04 (`loadAuthorizedEpic` in `saveBudgetAllocation`), F-06 (`listBudgetPlanRevisionCycles` ohne Payload-Zugriff, `getLatestBudgetPlanRevision` in einer Query)                                                                   |
| WP7 | Guardrail-Targets nach `work/features/portfolio/components/`                                                                                                                                                                                                                                                                                                 |
| WP8 | 3 Integrationstest-Dateien + 3 Page-Model-Tests + 2 Primitiv-Tests → **83 statt 43** Tests im Modul                                                                                                                                                                                                                                                          |
| WP9 | README neu; [ADR-0019](../adr/0019-epic-window-follows-the-maturity-plan.md) + Nachtrag in ADR-0015; `CONTEXT.md`, `module-architecture.md`, `module-migration-roadmap.md`, `work/README.md` auf den Ist-Stand; `fundedPeriodRange`/`fundedEndDate` gelöscht; beide Seeds bauen ihren Payload über `buildBudgetPlanSnapshot`; ein EUR-Formatter statt zweier |

## Nicht umgesetzt (bewusst offen)

- **F-12 — zwei Begriffe „Wertstrom-Budget".** `ValueStream.budgetAmount`/`budgetCurrency` bleiben
  im Schema, werden aber weiterhin von niemandem gelesen. Ob sie entfallen oder als „geplantes
  Rahmenbudget" abgegrenzt werden, ist eine Schema-/Produktfrage — **Backlog**.
- **F-06 tief.** Die Denormalisierung der Revisions-Kopfspalten (`epicCount`, `cycleBudgetSum`,
  `followBudgetSum`) samt Migration wurde bewusst nicht gebaut; `listBudgetPlanRevisions` liest für
  die Übersichts-Tabelle weiterhin jeden Payload. Bei zwei Revisionen pro Jahr unkritisch.
