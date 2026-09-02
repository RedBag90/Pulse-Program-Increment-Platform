# ART- und Wertstrom-Budget — Analyse und Spec

> Status: **Spec / zur Umsetzung** · Erstellt 2026-09-02
>
> Die Budget-Kette endet heute bei der Finalisierung einer Kachel. Was danach mit
> dem Geld passiert, sieht niemand: die **ART-Detailseite** hat keinerlei
> Budget-Bezug, die **Wertstrom-Detailseite** trägt ihren Budget-Stapel
> unsortiert im Overview-Tab. Ein ART kann seine Last und sein Restbudget
> nirgends ablesen. **Ziel: je einen Budget-Reiter auf ART und Wertstrom, der
> Zuteilung, Verbrauch und Verlauf zeigt — und die Last in Geld daneben, damit
> Nachfrage und Deckung nebeneinander stehen.**
>
> Wireframes:
> <https://claude.ai/code/artifact/02b723c2-441b-46df-977b-da3e2c9c5a56>
>
> Der gelebte Ablauf des Budgetierens:
> [budgeting-walkthrough.md](budgeting-walkthrough.md). Das Modell dahinter:
> [participatory-budgeting.md](participatory-budgeting.md).

---

## 1 Analyse

### 1.1 Die Kette bricht nach der Finalisierung ab

`finalizePeriodRound` schreibt je finanziertem Epic `BudgetAllocation[cycleKey]`
und ist damit fertig. Daraus werden zwar Wertstrom- und ART-Budgets abgeleitet —
aber sie erscheinen ausschließlich auf **einer** Fläche, dem Overview-Tab des
Wertstroms, zwischen Stammdaten und Gate-Regeln.

Die ART-Detailseite (`/art/[artId]`) kennt drei Reiter — Overview, Settings,
Verlauf — und prüft nicht einmal, ob das Budgeting-Modul aktiv ist. Der ART, der
das Geld ausgibt, hat keinen Ort, an dem er es sieht.

### 1.2 Das ART-Budget ist bereits die Summe seiner Epics

`getArtBudgetBreakdown` gruppiert `BudgetCandidate.finalAmount` nach `artId` und
`round.cycleKey`. Das ART-Budget **ist** damit definitorisch die Summe dessen,
was seinen Epics zugeteilt wurde.

Daraus folgt: Zugeteilt und „verbraucht" wären dieselbe Zahl, ein Restbudget gäbe
es strukturell nicht. Ein Verbrauchsbegriff, der nur summiert, ist wertlos — er
muss die Zuteilung **staffeln**.

Ebenso irreführend ist das heutige `artBudgetRemaining`: es rechnet
Wertstrom-Budget − Σ ART-Budgets. Da beide aus derselben Spalte stammen, einmal
nach `valueStreamId` und einmal nach `artId` gruppiert, ist diese Differenz in
Wahrheit „Zuteilungen an Epics ohne ART" — nicht ein Rest im Sinne einer
Deckungsreserve. Die Zahl ist richtig gerechnet und falsch benannt.

### 1.3 Pulse kennt keine Ist-Kosten

Es gibt im Schema kein Modell, keine Spalte und kein JSON-Feld, das je
ausgegebenes Geld hält. Die einzigen echten Actuals sind **Daten**: die
Reifegrad-Stempel (`implementationStartedAt`, `implementationCompletedAt`,
`impactRecognizedAt`) und `Initiative.timeline.actuals`.

Auch die „Kostenkurve" des Portfolio-Dashboards ist kein Ist:
`allocatedCostByMonth` verteilt die Halbjahres-Zuteilung gleichmäßig auf
Kalendermonate. `BcCalcSummary.hasAllocation` unterscheidet lediglich
„Zuteilung vorhanden" von „aus Kostenscheiben veranschlagt" — beide Seiten sind
Plan.

Jeder Verbrauchsbegriff muss deshalb abgeleitet und **ehrlich benannt** sein.

### 1.4 Der €-Satz je Job Size ist verwaist

`Tenant.costPerJobSizePoint` wird gelesen, in die DTO gereicht und im
Portfolio-Dashboard editiert — **aber nirgends multipliziert**. Die
PI-Planning-Kapazitätsauflage, für die er gebaut wurde, existiert nicht mehr. Ein
tenant-weiter, handgeschätzter Wert ohne Verbraucher.

Gleichzeitig liegt die Feature-Last je ART bereits als Σ Job Size je Halbjahr vor
(`aggregateArtFeatureLoad`) — direkt neben dem ART-Budget, in derselben Tabelle,
ohne dass die beiden je gegeneinander gerechnet würden.

### 1.5 Guardrail 2 misst etwas anderes und kennt keinen Wertstrom

Die Capacity-Allocation-Achse rechnet ihr Ist heute als Σ `implementationCost`
aus dem Lean Business Case **aller** Epics des Tenants, klassifiziert nach
`epicType`. Drei Probleme:

- **Kein Wertstrom-Bezug.** `getPortfolioGuardrailsInputs` nimmt nur `tenantId`;
  `GuardrailsEpicInput` trägt keine `valueStreamId`. Ein Wertstrom kann seinen
  Mix weder setzen noch sehen.
- **Kein Abschluss-Bezug.** Ein Epic auf L0 zählt genauso wie ein geliefertes.
  Die Frage „wie viel _wurde_ je Arbeitstyp aufgewendet" ist nicht beantwortbar.
- **Falsche Währung.** Business-Case-Kosten sind eine Schätzung; zugeteiltes
  Budget ist eine Entscheidung. Für die Frage, wohin das Geld ging, zählt die
  Entscheidung.

Die Ziele liegen als ein JSON-Feld `Tenant.guardrailTargets` vor —
tenant-weit, ohne Vererbungsebene.

### 1.6 Zwei ART-Wahrheiten

`BudgetCandidate.artId` ist eine **eingefrorene Kopie** von `Initiative.artId`,
gesetzt beim Kuratieren des Ballots. Wechselt ein Epic danach den ART, zeigen die
Budget-Sichten weiterhin den alten. Das ist richtig so — die Kachel hat es dort
entschieden —, aber es ist unsichtbar und erzeugt Rückfragen.

---

## 2 Zielbild

### 2.1 Der Verbrauchsbegriff: die Zustandsstaffel

Die Zuteilung eines Epics wird dem Zustand zugeordnet, in dem das Epic steht. Das
Vokabular existiert bereits — `aggregateHorizonBudgets` unterscheidet heute schon
`budgetiert / umsetzung / umgesetzt`. Die neue Fläche spricht dieselbe Sprache:

| Zustand            | Bedingung                                                     |
| ------------------ | ------------------------------------------------------------- |
| **Nicht begonnen** | `stageGate < L4`                                              |
| **Gebunden**       | `stageGate === "L4"` und `implementationCompletedAt == null`  |
| **Verbraucht**     | `implementationCompletedAt != null` oder `stageGate === "L5"` |

Kein neues Modell, keine neue Pflege — die Stempel sind gesetzt und auditiert.

**Beschriftungsregel:** „Nicht begonnen" ist das Restbudget, heißt aber
ausdrücklich _nicht_ „frei verfügbar". Das Geld hängt an konkreten Epics und wird
ohne neue Kachel nicht umgewidmet. Die Fläche sagt das im Klartext.

### 2.2 Der Verlauf

Monatsachse über das gewählte Halbjahr, mit Heute-Linie und Soll-Linie.

Jeder Monat trägt den auf ihn entfallenden Zuteilungsanteil
(`distributeAmountAcrossHalfYearMonths`), gestapelt nach dem Zustand des
zugehörigen Epics **in diesem Monat** (`stageAtMonth`).

**Die Säulenhöhe ist innerhalb eines Halbjahres konstant** — eine
Halbjahres-Zuteilung, gleichmäßig auf sechs Monate verteilt, ergibt jeden Monat
denselben Betrag. Was wandert, ist allein die Zusammensetzung: von „nicht
begonnen" über „gebunden" nach „verbraucht". Genau das ist die Aussage.

Die **Soll-Linie** markiert den gleichmäßigen Fortschritt: so viel müsste zu
diesem Zeitpunkt in Arbeit oder geliefert sein. Ohne sie zeigt der Stapel nur,
_dass_ sich etwas bewegt, nicht ob es reicht.

### 2.3 Die Last in Geld — empirischer Satz je ART

```
Satz je Job Size (ART) = Ø Budget der letzten zwei abgeschlossenen Zyklen
                         ───────────────────────────────────────────────
                         Σ Job Size der in diesen Zyklen fertiggestellten
                         Features dieses ARTs
```

Der Zähler existiert (`getArtBudgetBreakdown`). Der Nenner ist **neu**:
`aggregateArtFeatureLoad` bucketet nach _geplanter PI_ und filtert nicht nach
Status; für den Durchsatz braucht es eine zweite Aggregation über
`status === "completed"`, gebucketet nach **Abschluss**-Halbjahr.

Damit steht die Nachfrage des ARTs gegen seine Deckung: Σ Job Size der
eingeplanten Features × Satz gegen das Budget desselben Halbjahrs.

**Datierungsregel** (Actual vor Estimate, wie in `buildEpicStageTimeline`):
`completedAt`, ersatzweise das Ende der zugewiesenen PI; Features ohne beides
fallen aus dem Nenner und werden gezählt.

**Rückfall:** ohne abgeschlossene Features oder ohne zwei geschlossene Zyklen ist
kein Satz ableitbar → `Tenant.costPerJobSizePoint`, sichtbar gekennzeichnet.

Der Satz wird **immer mit seiner Herkunft** gezeigt (Zeitraum, Budget, Punkte,
Anzahl Features) und mit den Vorbehalten aus §9 — er ist eine Beobachtung, keine
Vorgabe.

### 2.4 Die Reallokations-Sicht

Die zentrale Arbeitsfläche des ARTs stellt beide Seiten **nebeneinander**:

| links                              | rechts                                    |
| ---------------------------------- | ----------------------------------------- |
| Zugeteilt, **nicht begonnen**      | Beantragt, **nicht finanziert**           |
| Epics unter L4 mit ihrer Zuteilung | Kandidaten dieses ARTs ohne `finalAmount` |

Darunter die Ergebniszeile: _„Selbst wenn alles Nichtbegonnene umgewidmet würde,
fehlten X €."_

Getrennte Listen beantworten diese Frage nicht — sie zwingen den Leser, zwei
Summen im Kopf zu behalten. Die Fläche **führt keine Umbuchung aus**: Beträge
ändern sich ausschließlich beim Festschreiben einer Kachel. Sie zeigt, womit man
in die nächste Runde geht, und verlinkt dorthin.

### 2.5 Guardrail 2 je Wertstrom

**(a) Ziele je Wertstrom.** Neue Tabelle nach dem Muster von
`StageGateApproverRule`: Tenant-Zeile als Default, Wertstrom-Zeile gewinnt, und
die Auflösung liefert die Herkunft mit — wie `resolveGatePolicy` mit
`source: "value_stream" | "tenant" | "code_default"`. Eigene Tabelle statt
Spalten auf `ValueStream`, weil `ValueStream` Core/org gehört und die Guardrails
Work (dieselbe Begründung wie bei den Gate-Regeln).

**(b) Zweite Messgrundlage.** `computeMixAxis` ist bereits generisch — die neue
Achse ist eine zweite Parametrisierung, keine neue Engine:

| Parameter  | heute                              | neu                                   |
| ---------- | ---------------------------------- | ------------------------------------- |
| `items`    | alle Epics des Tenants             | Epics **eines Wertstroms**, geliefert |
| `classify` | `epicCapacityBucket(epicType)`     | unverändert                           |
| `amountOf` | Σ `costSlices` des Business Case   | **zugeteiltes Budget**                |
| `targets`  | `Tenant.guardrailTargets.capacity` | aufgelöstes Wertstrom-Ziel            |

Die bestehende tenant-weite Achse bleibt bestehen und behält ihre Beschriftung
(„geplante Investition laut Business Case"). Die neue heißt „abgeschlossenes
Budget". Zwei Zahlen, die auseinanderlaufen dürfen, weil sie zwei Fragen
beantworten — beide beschriftet.

**(c) Anzeige.** `statusFor` bleibt die Regel (rot > 15 pp, gelb > 5 pp),
`AmpelPill` bleibt die Darstellung. Zusätzlich die Entwicklung je Halbjahr — ein
einzelner Prozentwert verdeckt den Trend, der die eigentliche Information ist.

### 2.6 Zwei Ampeln, die nicht verwechselt werden dürfen

| Ampel              | Misst                                                         | Wo             |
| ------------------ | ------------------------------------------------------------- | -------------- |
| **Überbuchung**    | Last in Geld über der Zuteilung desselben Halbjahrs           | ART, Wertstrom |
| **Mix-Abweichung** | Anteil je Arbeitstyp am abgeschlossenen Budget gegen das Ziel | Wertstrom, ART |

„Reicht mein Geld" und „investieren wir in der richtigen Mischung" sind
verschiedene Fragen. Im Kopf der Seite steht **eine führende Ampel im Klartext**
(„Überbucht um 695.600 € — die eingeplanten Features übersteigen das Budget um
29 %"); die zweite ist Nebentext. Zwei gleichrangige Chips in verschiedenen
Farben lassen den Leser ratlos.

### 2.7 Die beiden Flächen

**ART · Reiter „Budget"** in dieser Reihenfolge — die Alarmmeldung vor der
Chronik:

1. **Last gegen Deckung** mit der Lücke und dem Satz samt Herkunft
2. **Zuteilung** als vier Kacheln (Zugeteilt · Verbraucht · Gebunden · Nicht
   begonnen), Anteil in der Fußzeile jeder Kachel
3. **Was sich verschieben ließe** — die Reallokations-Sicht aus §2.4
4. **Verlauf** des gewählten Halbjahres
5. **Epics dieses ARTs**, sortiert nach Zustand: was nicht läuft, steht oben
6. **Run the Business** dieses ARTs
7. **Anmerkungen zur Datenlage** — gewechselter ART, Epics ohne ART

**Wertstrom · Reiter „Budget"** — der Stapel zieht aus dem Overview-Tab um:

1. **Der Topf** — Wertstrom-Budget, davon an ARTs, davon an Epics ohne ART,
   Zeile „Nicht verteilt"
2. **Je ART nach Dringlichkeit** — Zugeteilt, In Arbeit, Nicht begonnen,
   **Lücke** mit Summe. „Nichts begonnen" wiegt schwerer als „überbucht":
   brachliegendes Geld ist verlorene Zeit, Überbuchung hat Vorlauf
3. **Verlauf** des Wertstroms
4. **Guardrail 2** — einklappbar, offen wenn abweichend
5. **Run the Business**

---

## 3 Datenmodell

| Änderung                                                                                                                         | Warum                                                   |
| -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Neue Tabelle `ValueStreamGuardrailTargets` (`tenantId`, `valueStreamId?`, `targets Json`, `@@unique([tenantId, valueStreamId])`) | Guardrail 2 je Wertstrom (§2.5a)                        |
| `RunTheBusinessItem.artId String? @db.Uuid` + FK + Index                                                                         | Betriebsanteil je ART                                   |
| — sonst nichts                                                                                                                   | Verbrauch, Verlauf und Satz sind vollständig abgeleitet |

`RunTheBusinessItem` bleibt am Wertstrom verantwortet — die neue Spalte ist eine
**Zurechnung**, keine Verlagerung der Zuständigkeit. `null` heißt weiterhin
„wertstrom-übergreifend".

Keine Berührung von `epic_approvals` / `approval_phase` / `approval_revision`:
`prisma db push` bleibt gesperrt, die DDL wird gezielt von Hand angewandt.

---

## 4 Reuse-Map

| Gebraucht                       | Vorhanden                                                                                                                                                                |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Seitenrahmen, Reiter            | `EntityDetailShell`, `resolveTab` — `src/components/detail/entity-detail-shell.tsx`                                                                                      |
| Bedingte Reiter-Einfügung       | Muster der Epic-Seite (`issues`-Tab vor History)                                                                                                                         |
| ART-Budget je Halbjahr          | `getArtBudgetBreakdown` — `budgeting/server/services/art-budget.ts`                                                                                                      |
| Seitenmodell + reiner Builder   | `loadArtBudgetModel`, `buildArtBudgetModel` — `budgeting/server/views/art-budget-breakdown.ts`                                                                           |
| Feature-Last (Plan)             | `aggregateArtFeatureLoad` — `budgeting/domain/art-budget.ts`                                                                                                             |
| Zustand je Monat                | `buildEpicStageTimeline`, `stageAtMonth` — `work/domain/epic-stage-timeline.ts`                                                                                          |
| Halbjahr → Monate               | `distributeAmountAcrossHalfYearMonths` — `core/kernel/domain/period-axis.ts`                                                                                             |
| Monats- und Halbjahresachse     | `buildMonthAxis`, `halfYearKey`, `halfYearLabel` — `core/kernel/domain/calendar.ts`                                                                                      |
| Perioden-Arithmetik             | `sumPeriods`, `addPeriod`, `remainingByPeriod` — `budgeting/domain/period-map.ts`                                                                                        |
| Chart-Rahmen                    | `StackedChart`, `Panel`, `TodayLine`, `xAxis`/`yAxis`/`tooltip` — heute **modul-privat** in `portfolio-dashboard.tsx`, werden nach `src/components/charts/` herausgelöst |
| Mix-Achse                       | `computeMixAxis` — `work/domain/guardrail-rules.ts`                                                                                                                      |
| Arbeitstyp-Eimer, Ziele, Parser | `epicCapacityBucket`, `DEFAULT_GUARDRAIL_TARGETS`, `parseGuardrailTargets`, `validateGuardrailTargets` — `work/domain/portfolio-guardrails.ts`                           |
| Ampel-Schwellen und Pill        | `statusFor` (`work/server/views/portfolio-guardrails-view.ts`), `AmpelPill`, `ProgressBar`                                                                               |
| Vererbungsmuster je Wertstrom   | `StageGateApproverRule` + `resolveGatePolicy` — `work/domain/gate-policy.ts`                                                                                             |
| Zuteilung je Epic (Port)        | `getEpicBudgetAllocation`, `getEpicCycleAllocations` — `budgeting/server/services/epic-allocation.ts`                                                                    |
| Run-the-Business-Liste          | `listRtbItems`, `RtbSection`, `sumRtbAnnual`, `sumRtbCycle`                                                                                                              |
| Vormerken fürs Budget           | `stagedForBudgeting`, `setEpicFlagAction`, `isPbEligible`                                                                                                                |
| Zahlen, Mikro-Label             | `formatEUR`, `formatCompactEUR`, `SectionLabel`                                                                                                                          |

Neu zu bauen sind genau vier Dinge: die **Zustandsstaffel**, die
**Durchsatz-Aggregation**, die **Wertstrom-Guardrail-Auflösung** und die
**Reallokations-Gegenüberstellung**.

---

## 5 Requirements (testbar)

### Zustand und Verlauf

- **REQ-Z1** Die Zuteilung eines Epics fällt in genau einen der drei Zustände aus
  §2.1; die Summe der drei ist die Gesamtzuteilung des ARTs im Halbjahr.
- **REQ-Z2** `implementationCompletedAt != null` gilt als verbraucht, auch wenn
  `stageGate` noch `"L4"` lautet (L4.2).
- **REQ-Z3** Die Fläche beschriftet „Nicht begonnen" als Restbudget **mit** dem
  Hinweis, dass es nicht frei umwidmbar ist.
- **REQ-V1** Innerhalb eines Halbjahres ist die Säulensumme je Monat konstant.
- **REQ-V2** Der Halbjahres-Umschalter wirkt auf den Verlauf; die Achse zeigt
  ausschließlich die Monate des gewählten Halbjahres.
- **REQ-V3** Die Soll-Linie liegt bei `Zuteilung ÷ Monate im Halbjahr`; die
  Heute-Linie am aktuellen Monat.

### Last und Satz

- **REQ-L1** Der Satz je Job Size wird je ART aus den letzten **zwei
  abgeschlossenen** Zyklen berechnet (§2.3).
- **REQ-L2** Der Nenner zählt nur Features mit `status === "completed"`,
  gebucketet nach `completedAt`, ersatzweise PI-Ende.
- **REQ-L3** Ist der Nenner 0 oder liegt kein abgeschlossener Zyklus vor, greift
  `Tenant.costPerJobSizePoint`; die Fläche kennzeichnet den Rückfall.
- **REQ-L4** Die Fläche nennt bei jedem Satz seine Herkunft und die Zahl der
  Features ohne Abschlussdatum sowie derer mit Job Size 3 aus der Schnellanlage.
- **REQ-L5** Die Lücke ist `Last in Geld − Zuteilung` desselben Halbjahres;
  negativ = überbucht.

### Guardrail

- **REQ-G1** Ein Wertstrom ohne eigene Zeile erbt `Tenant.guardrailTargets`; die
  Fläche zeigt die Herkunft an.
- **REQ-G2** Die Ziele eines Wertstroms summieren auf 100 % (±0,5), sonst wird
  nicht gespeichert — dieselbe Regel wie `validateGuardrailTargets`.
- **REQ-G3** Das Ist der Wertstrom-Achse ist Σ **zugeteiltes Budget** der Epics
  dieses Wertstroms, deren Umsetzung abgeschlossen ist, gruppiert nach
  `epicType`.
- **REQ-G4** Epics ohne `epicType` erscheinen als „ohne Typ" und gehen **nicht**
  in die Anteile ein; ab 20 % unklassifiziert erscheint der Indiz-Hinweis.
- **REQ-G5** Die Entwicklung wird je Halbjahr ausgewiesen, nicht nur als
  Gesamtwert.
- **REQ-G6** Die tenant-weite Guardrails-Seite bleibt unverändert; beide Achsen
  tragen ihre Messgrundlage im Titel.

### Reallokation und Flächen

- **REQ-R1** Die Gegenüberstellung zeigt links die nicht begonnenen Zuteilungen,
  rechts die nicht finanzierten Kandidaten desselben ARTs, darunter die
  Differenz.
- **REQ-R2** Die Fläche schreibt keine Beträge. Die einzige Schreibaktion ist das
  Vormerken fürs nächste Budget (`stagedForBudgeting`).
- **REQ-A1** Der Budget-Reiter erscheint nur bei aktivem Budgeting-Modul; ohne
  Modul ist die ART-Seite unverändert.
- **REQ-A2** Im Kopf steht **eine** führende Ampel im Klartext; die zweite ist
  Nebentext.
- **REQ-A3** Die Epic-Tabelle ist nach Zustand sortiert: nicht begonnen, dann in
  Umsetzung, dann verbraucht.
- **REQ-A4** Weicht `Initiative.artId` vom eingefrorenen `BudgetCandidate.artId`
  ab, wird das am Epic angezeigt — mit dem Ziel-ART und der Begründung, warum das
  Budget hier bleibt.
- **REQ-W1** Die Wertstrom-Fläche weist „Nicht verteilt" aus und trennt
  Zuteilungen an Epics ohne ART sichtbar ab.
- **REQ-W2** Die ART-Tabelle trägt eine Lücken-Spalte mit Summe und ist nach
  Dringlichkeit sortiert (nichts begonnen vor überbucht vor unauffällig).
- **REQ-W3** Der Budget-Stapel verlässt den Overview-Tab vollständig;
  `BudgetPlan` wird aus der Seite in das Budgeting-Modul gehoben.

### Berechtigungen

- **REQ-P1** Die Wertstrom-Guardrail-Ziele pflegt, wer `target.manage` für diesen
  Wertstrom hält — die Policy bekommt dafür eine `scope: "value_stream"`-Zeile,
  wie sie `rtb_item.manage` schon trägt.
- **REQ-P2** Das Vormerken von der ART-Fläche aus darf der RTE (`Art.rteId`) für
  Epics seines ARTs — über einen Service-Seam, wie ihn Finance über
  `ValueStream.financeApproverId` hat. `isPbEligible` bleibt das Gate.

---

## 6 Modul-Schichtung (ADR-0013)

- **Budgeting** besitzt Verbrauchsstaffel, Verlauf, Satz und
  Reallokations-Gegenüberstellung (`budgeting/domain`, `budgeting/server/views`).
- **Work** besitzt die Reifegrad-Fakten und die Guardrails. Budgeting importiert
  Work nicht: die Stempel werden über einen Port gereicht, spiegelbildlich zum
  bestehenden `BudgetingDataPort`.
- Die **Guardrail-Erweiterung** liegt in Work; den Zuteilungsbetrag je Epic
  liefert Budgeting über `getEpicCycleAllocations`.
- Nur die **App-Shell** (`src/app/…/art/[artId]/page.tsx`,
  `…/value-streams/[id]/page.tsx`) führt beide Module zusammen.

---

## 7 Umsetzung in Stufen

1. **Wertstrom-Budget-Reiter** — Umzug des bestehenden Stapels, `BudgetPlan` ins
   Modul gehoben. Reine Umstrukturierung, kein neues Rechnen. (REQ-W3)
2. **Zustandsstaffel + ART-Budget-Reiter** — Kacheln, Epic-Tabelle,
   Reallokations-Sicht, Anmerkungen. Der Kern. (REQ-Z\*, REQ-R\*, REQ-A\*)
3. **Verlauf** — Chart-Bausteine herauslösen, Monatsstapel auf beiden Flächen.
   (REQ-V\*)
4. **Last in Geld** — Durchsatz-Aggregation, empirischer Satz, Lücke, Ampel.
   (REQ-L\*, REQ-W2)
5. **Guardrail 2 je Wertstrom** — Tabelle, Auflösung, zweite Messgrundlage,
   Anzeige. (REQ-G\*, REQ-P1)
6. **Run the Business je ART** und **Vormerken von der ART-Fläche**. (REQ-P2)

Stufen 1–2 liefern für sich genommen Nutzen; 3–6 sind additiv.

---

## 8 Bewusster Verzicht

- **Kein Umbuchen an der Fläche.** Beträge ändern sich ausschließlich beim
  Festschreiben einer Kachel. Ein zweiter Schreibweg wäre eine zweite Wahrheit.
- **Keine Ist-Kosten-Erfassung.** Wäre die ehrlichste Zahl, aber neue
  Pflegearbeit an einem Modell, an dem heute nichts hängt. Wenn sie kommt, ist
  die Zustandsstaffel die Referenz daneben, nicht ihr Ersatz.
- **Keine epic-lose ART-Bedarfsmeldung.** Dafür gibt es keine Struktur, und
  REQ-B2 aus [budgeting-module-deepening.md](budgeting-module-deepening.md) hält
  fest: „Bedarf ist abgeleitet, nie erfasst."
- **Kein Nachziehen der tenant-weiten Guardrail-Achse.** Sie beantwortet eine
  andere Frage und bleibt, wie sie ist — nur beschriftet.
- **Keine Reparatur von `artBudgetRemaining`** in dieser Stufe. Die Zahl wird
  umbenannt, damit sie sagt, was sie ist (§1.2), nicht umgerechnet.

---

## 9 Datenqualität — was die Fläche aushalten muss

| Befund                                                                                                                    | Umgang                                                   |
| ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `Initiative.completedAt` ist ein Klick-Zeitstempel auf einem terminalen Status, ohne Backfill; Alt-Features tragen `null` | Ersatzdatum PI-Ende, Anzahl ausweisen (REQ-L2/L4)        |
| Schnellanlage setzt `wsjfJobSize = 3` als Platzhalter                                                                     | Anzahl ausweisen, Satz als Beobachtung kennzeichnen      |
| `stagedForBudgeting` trägt weder Zyklus noch Datum noch Akteur                                                            | Als reine Vormerkung behandeln, nicht als Antrag         |
| Epics ohne `artId` fallen aus jeder ART-Sicht                                                                             | Auf der Wertstrom-Fläche eigene Zeile + Hinweis (REQ-W1) |
| Epics ohne `epicType` verzerren den Mix                                                                                   | Eigene Zeile, aus den Anteilen ausgenommen (REQ-G4)      |
| `ValueStream.budgetAmount` / `budgetCurrency` sind tote Spalten                                                           | Nicht anfassen, nicht anzeigen                           |

**Vor Stufe 4** wird mit einem Lese-Skript geprüft, wie viele abgeschlossene
Features kein Abschlussdatum und wie viele den Platzhalter-Job-Size tragen.
Fällt das Ergebnis schlecht aus, trägt der Satz nicht — dann bleibt Stufe 4 beim
Tenant-Wert und die Lücke wird ohne empirischen Satz gezeigt.

---

## 10 Referenzen

| Aussage                                  | Fundstelle                                                   |
| ---------------------------------------- | ------------------------------------------------------------ |
| ART-Budget aus `finalAmount` je Zyklus   | `src/modules/budgeting/server/services/art-budget.ts`        |
| Seitenmodell und reiner Builder          | `src/modules/budgeting/server/views/art-budget-breakdown.ts` |
| Feature-Last, `artBudgetRemaining`       | `src/modules/budgeting/domain/art-budget.ts`                 |
| Zuteilung je Epic (Port)                 | `src/modules/budgeting/server/services/epic-allocation.ts`   |
| Zustand je Monat                         | `src/modules/work/domain/epic-stage-timeline.ts`             |
| Vokabular budgetiert/Umsetzung/umgesetzt | `src/modules/work/server/views/portfolio-overview.ts`        |
| Halbjahr → Monate                        | `src/modules/core/kernel/domain/period-axis.ts`              |
| Kalender-Primitiven                      | `src/modules/core/kernel/domain/calendar.ts`                 |
| Mix-Achse                                | `src/modules/work/domain/guardrail-rules.ts`                 |
| Guardrail-Ziele, Eimer, Validierung      | `src/modules/work/domain/portfolio-guardrails.ts`            |
| Ampel-Schwellen                          | `src/modules/work/server/views/portfolio-guardrails-view.ts` |
| Vererbungsmuster je Wertstrom            | `src/modules/work/domain/gate-policy.ts`                     |
| Ballot-Fähigkeit und Richtwert           | `src/modules/work/domain/pb-submission.ts`                   |
| Run-the-Business-Positionen              | `src/modules/budgeting/server/services/rtb-item-service.ts`  |
| Seitenrahmen                             | `src/components/detail/entity-detail-shell.tsx`              |
| Was welche Rolle darf                    | `src/server/auth/policies/index.ts`                          |
