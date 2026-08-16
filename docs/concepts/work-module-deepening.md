# Work-Modul — Deepening-Designs

Ergebnis eines Architektur-Reviews (`/improve-codebase-architecture`) des Work-Moduls.
Sieben festgelegte **Deepening-Designs**: aus verstreuten/flachen Modulen tiefe machen —
Ableitung raus aus Komponenten/Gott-Buildern in benannte reine Seams, **ein** Besitzer
pro Konzept, impure Ränder dünn.

**Status: Design festgelegt, Umsetzung offen** (Reihenfolge unten ist die empfohlene).
Vokabular: *tief* = viel Verhalten hinter kleinem Interface; *flach* = Interface ≈
Implementierung; *Seam* = Ort des Interfaces; *Lokalität* = Änderung an einer Stelle.

---

## #1 Stage-Gate-Engine (der Funnel L0–L5)

**Problem.** „Epic durch den Funnel bewegen" feuert heute aus **5 Services in 3 Modulen**
(`epic.ts` `advanceStageGate`/`autoAdvanceStageGate`/`confirmEpicImpact`, `feature.ts`
`setFeatureDeliveryStatus`, `epic-approval.ts` `decideHypothesis`/`submitBusinessCase`,
`budgeting.ts` `saveBudgetAllocation`). `feature.ts` importiert `epic.ts` **lazy** (`await
import`) um einen Zirkel zu verstecken. Die „alle Kinder fertig"-Regel existiert **3×**.
Vorbedingungen über 3 Dateien verteilt; die Trigger-Tabelle ist Doku, nicht ausführbar.

**Neues Verhaltensmodell.** Inhaltlicher Trigger **schlägt vor**, Epic-Owner **bestätigt**.
Vorschlag **persistiert** (`proposedStageGate`/`proposedBy`/`proposedAt`). Ausnahme:
L0→L1 wendet direkt an (Hypothese-Freigabe durch Portfolio Manager = Bestätigung).
L4→L5 (Impact) ist bereits Owner-bestätigt.

**Seam.**
- **Rein** (`domain/stage-gate.ts` erweitern): `EpicGateState` (voll materialisiert),
  eine benannte **Prädikat-Sprache** (`hasBusinessCaseContent`, `businessCaseApproved`,
  `budgetAllocated`, `firstFeatureStarted`, `allChildrenCompleted`, `hypothesisReady`) —
  killt die 3× Completion-Kopie —, und die eine Entscheidung
  `decideGate(state, move, now) → GateDecision`. `move = {trigger} | {confirm} | {manual}`.
  `GateDecision = noop | suggest | advance(stamps) | block`. Timestamps injiziert
  (deterministisch); Engine besitzt **alle** gate-nahen Stamps (Eintritts-Milestones,
  L3-Approval-Stamp, Impact-Stamps).
- **Impur** (neu `server/services/stage-gate-engine.ts`, Blatt): `loadEpicGateState`
  (die **eine** Query — Kind-Counts, Budget-Σ, Practices), `runGateEngine(tx, mctx,
  epicId, move)`, + 3 Zucker-Wrapper `signalGateTrigger` / `confirmProposedAdvance` /
  `advanceGateManually`. Practices-off = No-op lebt hier. Alle 5 Schreiber importieren
  **nach unten** → **Import-Zirkel weg**.

**Schema-Delta.** `Initiative.proposedStageGate StageGate?` + `proposedBy String? @db.Uuid`
+ `proposedAt DateTime?`.

**Migration der Schreiber.** `saveBusinessCase`/`saveBudgetAllocation`/`setFeatureDeliveryStatus`
rufen `signalGateTrigger(...)` statt `autoAdvanceStageGate`; `decideHypothesis` (approve)
signalisiert `hypothesis_approved` (Engine wendet L1 direkt an); `confirmEpicImpact`
delegiert an `confirmProposedAdvance`/den Impact-Pfad (die 3×-Completion-Regel kollabiert).
Neue Owner-Aktion `confirmProposedStageGate`. `autoAdvanceStageGate` gelöscht.

**Offen (Folge):** UI-Affordanz für die Owner-Bestätigung des Vorschlags; darf der Owner
einen Vorschlag verwerfen (proposedStageGate leeren)?

**Tests.** Reine Engine-Tabellen-Tests für `decideGate` (jeder Trigger, No-op, Blocks,
Stamps, Completion) — off-DB. Loader-Integrationstest (Projektion, logikfrei).

---

## #2 KPI→€ / Attainment (eine Quelle)

**Problem.** Die Planned-€-Formel (`|Ziel−Baseline|×valuePerUnit`, one-time vs. recurring×12)
steht in `epic-economics.ts` (`epicBenefitFromKpis`) **und** `lpm-review.ts` (`kpiPlanned`).
Der Attainment-Bruch `(current−baseline)/(target−baseline)` clamped steht **3×**
(`epic-detail.ts` `heroKpiRatios`, `portfolio-epics-list.ts` `meanKpiProgress`,
`epic-kpis-tab.tsx` `kpiRatio`) — **divergent im Null-Handling** (epic-detail schließt
null-current aus, portfolio-list zählt als 0 → zwei Zahlen fürs selbe Epic). Der tiefe
Besitzer **existiert** (`core/kpi/domain/kpi-valuation.ts`) und wird nur nicht benutzt.

**Seam (Layering eindeutig: `benefitKind`/`recurringInterval`/`valuePerUnit` sind Core-`Kpi`-
Felder, Helfer schon in Core).** Core `kpi-valuation.ts` bekommt `kpiPlanned(kpi) → number`
(Planned-€ bei 100 %, recurring annualisiert) und `kpiFulfillmentMean(kpis) → number | null`
(Mittel über `fulfillmentFraction`, **null-current ausgeschlossen** — Produkt-Entscheid:
„keine Daten" ≠ „0 %"). `epicBenefitFromKpis` wird Reducer über `kpiPlanned` (bucketet
one-time/recurring); `lpm-review.kpiPlanned` gelöscht → ruft Core. `heroKpiRatios`/
`meanKpiProgress` → `kpiFulfillmentMean`. Die View emittiert Per-KPI-Attainment +
`derivedTotal` **vorberechnet**; `epic-kpis-tab` rendert nur.

**Tests.** Core-Unit-Tests für `kpiPlanned` + `kpiFulfillmentMean` (Null-Politik,
Null-Breite-Band). Drei naive Kopien gelöscht.

---

## #3 Epic-Approval-Read-Model (ein Besitzer)

**Problem.** „Approval-Zustand für Revision N" hat keinen Besitzer:
`epic-approvals-tab.tsx` rekonstruiert im Browser `records` + Owner-Maps + Prefill +
Zähler (`granted`/`blocked`/`configuredParties`) aus rohem `approvals[]` — obwohl die View
`sectionRecords` schon hat. `MyApprovalRow.target` ist ein untypisierter Optional-Bag,
in `approval-actions.tsx` mit `!` re-asserted (`featureId` ist tot). Die „gültiges
Approver-Set"-Regel steht als Write (`configureApprovers`) **und** Read-Back-Guard
(`submitBusinessCase`).

**Seam.**
- Reiner `buildApprovalView(records, defaults) → { records, partyOwners, sectionOwners,
  prefill, counts }` in `domain/epic-approval.ts`. **View** emittiert das volle Model,
  **Komponente rendert** (Picker initialisiert aus aufgelösten Ownern).
- `MyApprovalRow` als **discriminated union** über `kind` (hypothesis→`{epicId}`,
  party→`{approvalId}`, section→`{epicId, section}`); `featureId` weg → `pickAction`/
  `buildEntries` total, `!` verschwinden.
- Reines `isValidApproverSet(records)` von configure **und** submit geteilt.

---

## #4 Revision-Sichtbarkeit & Lifecycle-Status

**Problem.** `epic-detail.ts:446-481` trägt 5+ Booleans (`showHypoReviewDiff`,
`showBcReviewDiff`, `showHypoOwnerEdit`, `showBcOwnerEdit`, …) + zwei Lock-Reason-Maps
(`HYPO_LOCK`/`BC_LOCK`) als lose Locals im 300-Zeilen-Gott-Builder. `epic-timeline-tab.tsx`
rechnet den Lifecycle-Status aus **Timestamps**, während `epicLifecycleSteps` ihn aus dem
**Stage Gate** rechnet — dieselbe Seite, driftende Achsen.

**Seam.**
- Reines `domain/epic-revision-visibility.ts` (Inputs: `approvalPhase`, `hypoBaseline!=null`,
  `bcBaseline!=null`, `canEdit`, `canDecideHypothesis`, `viewerHasOpenApproval` → die
  Booleans + Lock-Gründe). View ruft, Komponente rendert.
- Timeline-Status folgt dem geteilten `epicLifecycleSteps` (**Gate-basiert**, entschieden);
  Estimate/Actual-Datumsfelder bleiben editierbar, nur die Färbung teilt die Achse mit dem
  Stepper → keine Drift.

---

## #5 Autorisiertes-Epic-Laden (uniformer Authz-Seam)

**Problem.** `epic.ts` nutzt `loadAndAuthorize` 6× (identisches Zeremoniell), aber
`advanceStageGate` + `softDeleteEpic` **überspringen** es (nackte Finds). `epic-approval.ts`
nutzt ~6× rohes `EPIC_WHERE` **ohne** `authorizeResource` (die größere stille Lücke);
zwei Approver-Aktionen prüfen `row.approverUserId !== actor` (andere Achse).

**Seam.** Dünner `loadAuthorizedEpic(db, principal, { id, tenantId, action, select })` —
backt Epic-Finder + Standard-`toResource` + `authorizeResource` ein, generisch über
`select`. Über **epic.ts + epic-approval.ts** (schließt die Lücke — **verschärft Authz**,
Verhaltensänderung: der Action-Factory-Vorfilter ist bei by-id-Mutationen vakuum erfüllt,
ADR-0002). Approver-Check → benannter `assertAssignedApprover(row, actorId)`.

---

## #6 Dependency-Edge-Primitiv (Heimat Work)

**Problem.** `feature.ts` (Work) schreibt Dependency-Kanten **inline** (`tx.dependency.
delete/create`) beim Feature-Einfügen/Splitten — weil es Drumbeats Dependency-Service
**nicht importieren darf** (ADR-0013: Work ist unter Drumbeat). Cross-Modul-Write via
Events (ADR-0015) scheidet aus: der Kanten-Split muss **atomar** mit der Feature-Erstellung
sein.

**Seam.** Ein `dependency-edge`-Primitiv mit `createEdge`/`deleteEdge`/`splitEdge(existing,
newNodeId)` — Cycle-Check (Core-Domäne `dependency-graph.ts`) + Audit **innen**. **Heimat
Work** (Dependency = Beziehung zwischen Initiatives, die Work besitzt); Drumbeats
`dependency.ts` importiert **nach unten** in Work. Beide Konsumenten (feature.ts + Drumbeat)
migriert → ein Besitzer der Kanten-Invariante.

---

## #7 Row-Filter + WSJF-on-Write

**Problem.** `epics-list-shell` und `my-tasks-list-shell` haben überlappende, aber divergente
Filter-Prädikate; echt dupliziert ist der **Text-Match** (3×). Die „WSJF neu + Audit-Composite"-
Orchestrierung ist in **5** `feature.ts`-Methoden kopiert.

**Seam.**
- **Komponierbare Filter-Primitive** in `lib/` (`matchesQuery`, Per-Facet-Matcher); jede Shell
  komponiert ihr Prädikat — dedupliziert den Text-Match ohne fettes Facetten-Bag.
- Reiner `wsjfWriteFields(input)` → 4 WSJF-Felder + `wsjfComputed` (+ Update-Composite);
  alle 5 Methoden rufen ihn. `scoreFeature` bleibt (distinkte Audit-Action `wsjf.scored`).

---

## Querschnitts-Notiz (kein eigener Kandidat)

**Kein Loader ist getestet** — nur die reinen Builder sind grün. Die echte Assembly-Logik
(`loadEpicDetailInputs` mit 8 Capability-Auflösungen, `lpm-review-view.ts` PI-Fenster-Dedup,
ein `epicLinkCount = 0`-TODO in `portfolio-overview.ts`) liegt dort, wo Bugs die Builder-Tests
strukturell nicht fangen. Jedes Deepening oben sollte die betroffenen Loader schlank/dumm
lassen (Projektion, keine Entscheidung).
