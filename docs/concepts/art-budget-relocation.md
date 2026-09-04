# ART-Budget im Budgeting-Modul — Analyse und Refactor-Spec

> Status: **Spec / zur Umsetzung** · Erstellt 2026-09-04
>
> Die ART-Budget-Flächen liegen außerhalb des Budgeting-Bereichs, tragen sieben
> Blöcke auf einem Reiter und verteilen einen zusammenhängenden Geldvorgang über
> fünf Seitenwechsel in drei Nav-Bereichen. **Und der Weg, um den es geht, ist im
> Produktbetrieb tot:** ein Veränderungsrahmen lässt sich über keine Oberfläche
> anlegen (§1.1).
>
> **Ziel: ein ART geht jederzeit auf seine eigene Budgetseite im
> Budgeting-Bereich und verteilt dort auf seine Epics — ohne je eine Kachel zu
> öffnen. Die Fläche ist unabhängig, das Geld nicht.**
>
> Wireframes:
> <https://claude.ai/code/artifact/0c4439f4-88c8-4a1e-ae78-47aa8eae0da9>
>
> Der gelebte Ablauf: [art-epic-budget-walkthrough.md](art-epic-budget-walkthrough.md).
> Was die Kachel tut: [budgeting-refactor.md](budgeting-refactor.md).
> Die Fläche, die diese Spec umzieht: [art-budget-transparency.md](art-budget-transparency.md).
> Die Einordnung klein/groß: [art-epics.md](art-epics.md).

---

## 0 Warum eine vierte Spec

Die Forderung ist nicht neu. Sie steht dreimal in den eigenen Dokumenten, und
jedes Mal ist etwas anderes daraus geworden:

| Datum      | Dokument                     | Aussage                                                                                                                                                  |
| ---------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-08-19 | `budgeting-ui-refactor.md`   | „Fragmentierten Fluss vereinen — **inkl. ART-Verteilung außerhalb der Budget-Nav**" · „ART-Verteilung ins Budget-Modul holen"                            |
| 2026-08-31 | `budgeting-refactor.md`      | Löst das ab: „eine Wahrheit, ein Ort". Für die ART-Seite: „weicht der **abgeleiteten Sicht mit Link** auf die Kachel"                                    |
| 2026-09-02 | `art-budget-transparency.md` | Gegenrichtung: „je einen Budget-Reiter auf ART und Wertstrom" · §8: „**Kein Umbuchen an der Fläche. Ein zweiter Schreibweg wäre eine zweite Wahrheit.**" |

Das abgelöste Dokument benennt die Folge selbst:

> „Übrig blieben Redirects auf die alten Routen und ihre Lese-Flächen; **genau
> diese Halb-Ablösung ist ein Teil der heute beklagten Fragmentierung.**"

Und §8 wurde seither zweimal überfahren: `setArtEpicAllocation` (Guardrail 3)
und `saveRtbAwards` sind genau die zweiten und dritten Schreibwege, die dort
ausgeschlossen wurden — beide auf einer Fläche, beide außerhalb der Kachel.

**Diese Spec ist die vierte. Sie ist nur dann keine vierte Schicht, wenn jede
alte Fläche verschwindet, statt als Lese-Rest stehenzubleiben.** Deshalb: alles
wandert, nichts bleibt zurück.

---

## 0.1 Vokabular

Gilt ab dieser Spec für Code, UI und Doku. Durchgesetzt von REQ-16.

| Wort                 | Bedeutung                                                                                                                  |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **PB-Liste**         | was in einer Runde um Geld konkurriert — bisher „Ballot"                                                                   |
| **Verteilbogen**     | der gedruckte Bogen je Gruppe — bisher **ebenfalls** „Ballot"                                                              |
| **ART-Epic-Budget**  | das Geld, mit dem ein ART seine kleinen Epics finanziert. **Ein Wort, drei Zustände: beantragt → zugesprochen → verteilt** |
| **Portfolio-Budget** | die Zuteilung über die PB-Liste (Label existiert bereits)                                                                  |

Ersatzlos gestrichen: „Veränderungsrahmen", „ART-Topf", „ART-Budget". Die drei
Zustände sind die Schritte 1, 3 und 5 des Leitfadens (REQ-20) — die Leiste sagt,
wo man steht, das Wort bleibt konstant.

Die Analyse unten beschreibt den **heutigen** Stand und benutzt deshalb noch die
alten Wörter.

---

## 1 Analyse

### 1.1 Der Veränderungsrahmen ist nicht anlegbar

`createRtbItemAction` (`features/actions/rtb.ts:62-68`) kennt in seinem Schema
weder `kind` noch `artId` und reicht beide nicht durch (`:83-89`);
`updateRtbItemAction` (`:95-101`) ebenso. `rtb-section.tsx` hat kein Feld dafür.
Der Service **kann** es seit jeher (`rtb-item-service.ts:101-103`, `:118-120`).

`art_change`-Positionen entstehen heute ausschließlich in
`prisma/seed-large.ts:1452,1459`, `prisma/seed-demo.ts:1221` und
`prisma/sql/2026-09-02-art-epics.sql:22`. **In einem echten Mandanten ist der
gesamte ART-Epic-Finanzierungsweg tot.**

Zwei Flächen behaupten das Gegenteil: der Leerzustand der Verteilliste
(„Ein Rahmen wird als Run-the-Business-Position im Wertstrom angelegt",
`art-pot-section.tsx:45-47`) und die Warnbox auf dem Epic („Ausweg: einen Rahmen
anlegen") — die auf nichts verlinkt.

### 1.2 „Der Rahmen dieses ARTs" hat acht Definitionen

| #   | Stelle                                  | Definition                                                                                                  |
| --- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| 1   | `art-pot.ts:51-73`                      | Σ `RtbItemAward` der `art_change`-Positionen — **der zugesprochene Rahmen**                                 |
| 2   | `art-pot.ts:182-197`                    | **wortgleiche Kopie von 1**, inline in der Transaktion                                                      |
| 3   | `art-budget-detail.ts:489-504`          | `rtbCycleAmount(plannedAmount)` — der **beantragte** Rahmen; steht auf **derselben Seite** neben 1          |
| 4   | `rtb-award-service.ts:90-99`            | Ask je Position + anteilige Vorbelegung                                                                     |
| 5   | `portfolio/epics/[id]/page.tsx:138-141` | `count()` — zählt Positionen, nicht Awards. Ein ART mit Position und 0 € meldet „kein Finanzierungsproblem" |
| 6   | `services/art-budget.ts:55-66`          | Ein _anderes_ ART-Budget: Σ `BudgetCandidate.finalAmount` der Epic-Kandidaten                               |
| 7   | `period-valuestreams.ts:70-81`          | vierte Zählung                                                                                              |
| 8   | `budget-plan-snapshot.ts:270-284`       | die eingefrorene Fassung                                                                                    |

### 1.3 Zwei Riesen

`server/views/art-budget-detail.ts` — **836 Zeilen, zehn Zuständigkeiten**:

| Zeilen   | Zuständigkeit                                                                                                   |
| -------- | --------------------------------------------------------------------------------------------------------------- |
| :53-77   | Anzeige-Vokabular                                                                                               |
| :79-166  | sieben Page-Model-Typen                                                                                         |
| :168-181 | `coverageVerdict` — Ampelregel, rein                                                                            |
| :183-247 | Monats-Achse mit **hartkodierten Monatsnamen**, obwohl `kernel/domain/calendar.ts:10` `MONTH_LABELS` exportiert |
| :249-387 | `buildArtBudgetDetail` — der Kern                                                                               |
| :389-521 | `loadArtBudgetDetail` — drei Query-Wellen                                                                       |
| :523-573 | `loadEpicRows`                                                                                                  |
| :575-639 | **das Seitenmodell einer fremden Seite**, mit Sentinel-ART `"__value_stream__"` (:624)                          |
| :641-730 | `loadArtCoverage` — Durchsatzrechnung, eigene Queries                                                           |
| :732-836 | `loadArtPotView` — die Verteilliste                                                                             |

`features/components/art-budget/art-budget-tab.tsx` — **505 Zeilen, sieben
Blöcke** übereinander: Deckung · Halbjahr-Umschalter · je Quelle
Zustandsstaffel + Epic-Tabelle · Verlauf · ART-Epics finanzieren · Was sich
verschieben ließe · Run the Business · Anmerkungen zur Datenlage.

### 1.4 Wo es sitzt

**Elf Routen** rendern Budgeting-Komponenten, drei davon unter `/structure`. Von
26 Server-Actions schreiben **fünf Geld außerhalb der Kachel — alle fünf auf
Struktur-Seiten**. Im Budgeting-Bereich kommt der ART-Rahmen **nirgends** vor;
die einzige ART-Zahl dort ist „Abgeleitete Budgets" im Ergebnis-Reiter einer
abgeschlossenen Kachel.

Klickstrecke „ein ART-Epic bekommt Geld": **fünf Seitenwechsel über drei
Nav-Bereiche**, plus ein Schritt ganz ohne UI (§1.1).

### 1.5 Primitive existieren und werden umgangen

- `domain/period-map.ts` sagt im Kopf, hier sei die Mathe „**einmal**
  aufgeschrieben" — im ART-Bereich stehen **≥12 handgeschriebene Äquivalente**
  (`art-pot.ts:73,74,197,219,266`, `art-budget.ts:64`,
  `art-budget-detail.ts:460,470`, …).
- `aggregateArtFeatureLoad` (`domain/art-budget.ts:55`) gegen die
  handgeschriebene Kopie in `art-budget-detail.ts:695-699` — und ausgerechnet
  die Kopie speist den ART-Budget-Reiter.
- Neun Stellen bauen eine Halbjahres-Achse, zwei davon an `period-window.ts`
  vorbei — eine sortiert **absteigend**, alle Builder aufsteigend.
- `assertManage` steht zweimal (`rtb-item-service.ts:70`,
  `rtb-award-service.ts:216`), identisch bis auf die Fehlermeldung.

### 1.6 Getestet sind die Regeln, nicht ihre Verdrahtung

Alle reinen Domain-Module haben sorgfältige Tests. **Ohne jeden Test:**
`art-pot.ts` (Deckel, Fenster, Rechte-Verdrahtung, Löschzweig),
`rtb-award-service.ts`, `rtb-item-service.ts`, `candidate-service.ts`,
`services/art-budget.ts`, `domain/rtb-kind.ts`, jeder Loader in
`art-budget-detail.ts` — und die Action-Ebene vollständig. Genau dort sitzt der
Datenverlust aus §1.1.

---

## 2 Zielbild

### 2.1 Navigation — vier Einträge

```
Budgeting
├── Budgeting-Zeiträume   /budgeting/periods         ← der Ablauf
├── Wertströme            /budgeting/value-streams   ← Betrieb, Budgets, Zuspruch
├── ART-Budgets           /budgeting/arts            ← der ART verteilt
└── Budget-Plan           /budgeting/budget-plan     ← eingefroren
```

Kette und Navigation werden deckungsgleich: Kachel spricht zu → Wertstrom teilt
auf → ART verteilt → Budget-Plan friert ein.

### 2.2 `/budgeting/arts` — der ART geht auf sein Budget

**Liste.** `Page` + `PageHeader eyebrow="Participatory Budgeting"` + `StatStrip`
(Vorbild `budgeting/periods/page.tsx`). Halbjahres-Umschalter im Kopf; je ART
eine Zeile mit ART-Epic-Budget · Verteilt · Rest · Deckungs-Ampel. Gefiltert nach
denselben drei Wegen, die heute `canReadBudget` bilden
(`structure/(organisation)/art/[id]/page.tsx:88-97`): Produkt-Manager-Probe,
Finance-Seam, `budget.read`.

**Detail `/budgeting/arts/[artId]`.** `EntityDetailShell`,
`backHref="/budgeting/arts"`, `subHeader` = Halbjahres-Umschalter (das
`PeriodPhaseRail`-Muster aus `budgeting/periods/[id]/page.tsx:108`). **Sieben
Blöcke werden zwei Reiter** — geschnitten nach **Modus, nicht nach Thema**:

| Reiter        | Inhalt                                                                                                                 |
| ------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Übersicht** | alles zum Lesen: Deckung · je Quelle Zustandsstaffel + Epic-Tabelle · Herkunft (Betrieb und ART-Epic-Budget) · Verlauf |
| **Verteilen** | die Arbeit: ART-Epics finanzieren · Was sich verschieben ließe                                                         |

Ein dritter Reiter „Run the Business" wäre dünn — zwei kleine Tabellen plus
Anmerkungen —, und seine Tabellen beantworten dieselbe Frage wie die
Quellen-Staffel: _woher kommt das Geld_. Ein selten besuchter Reiter kostet mehr,
als er ordnet. Erreichbar
unabhängig von jeder Kachel; der Umschalter deckt die Halbjahre ab, die
`potWindowClosedReason` (`domain/art-pot-window.ts:18`) freigibt.

### 2.3 `/budgeting/value-streams` — wo das Budget entsteht

Liste je Wertstrom; ersetzt `/budgeting/run-the-business`, das als Redirect
bleibt (der Deep-Link aus `period-setup-tab.tsx:273` lebt weiter).

**Detail, zwei Reiter:**

- **Budget** — Budgetplan · Verlauf · ART-Budgets als **Tabelle** (REQ-8) ·
  Feature-Last je ART.
- **Run the Business** — die RtB-Positionen **mit den Feldern „Art" und „ART"**
  (REQ-1) und „Zuspruch aufteilen" **mit Halbjahres-Umschalter** (REQ-11).

Beide Hälften der Kette liegen damit auf einem Reiter — heute erzeugt
`components/rtb/` das Budget und `components/art-budget/` verteilt es.

### 2.4 Was `/structure` verliert

| Seite               | vorher                                                                  | nachher                                      |
| ------------------- | ----------------------------------------------------------------------- | -------------------------------------------- |
| `art/[id]`          | Allgemein · **Budget** · Solutions · Verlauf                            | Allgemein · Solutions · Verlauf              |
| `value-stream/[id]` | Allgemein · **Budget** · Guardrails · **Betrieb** · Solutions · Verlauf | Allgemein · Guardrails · Solutions · Verlauf |
| `solution/[id]`     | Overview mit **RtB-Pflege**                                             | Overview, Grow/Run-Kacheln bleiben           |

Auf „Allgemein" je ein Verweis („Budget dieses ARTs →"). Guardrails bleibt: das
ist `modules/work`, kein Budgeting. Die Grow:Run-Kacheln der Solution bleiben —
sie charakterisieren die Solution, sie pflegen kein Geld.

### 2.5 Was sich am Geld nicht ändert

`BudgetAllocation` bleibt die einzige Wahrheit, `mergeEpicAllocation`
(`services/epic-allocation.ts:113`) die einzige Schreibstelle, das Budget
entsteht ausschließlich aus einer abgeschlossenen Kachel. **§8 von
`art-budget-transparency.md` bleibt in Kraft** — diese Spec verschiebt Flächen
und repariert Rechnungen, sie eröffnet keinen vierten Geldweg.

---

## 3 Requirements (testbar)

**REQ-1 · Der Rahmen ist anlegbar.** `createRtbItemAction` und
`updateRtbItemAction` nehmen `kind` (`RTB_KINDS`) und `artId` entgegen und
reichen sie an den Service durch, der sie längst kennt
(`rtb-item-service.ts:101-120`). Das Formular bekommt ein „Art"-Select
(`RTB_KIND_LABELS`, `domain/rtb-kind.ts:21`) und ein „ART"-Select, das nur bei
`art_change` erscheint und dann Pflicht ist.

**REQ-2 · Ein Rahmen, eine Rechnung.** Die Kopie in `art-pot.ts:182-197` fällt
weg; `loadArtPot` und `setArtEpicAllocation` benutzen dieselbe Funktion.

**REQ-3 · `active` filtert überall.** `art-pot.ts:51-53` bekommt `active: true`
— wie `rtb-award-service.ts:63` und `epics/[id]/page.tsx:139`. Heute verschwindet
eine deaktivierte Rahmen-Position aus der Aufteil-Fläche, zählt aber weiter im
Topf **und im Deckel**.

**REQ-4 · Kein Über-Fetch.** `rtb-award-service.ts:84-87` schränkt auf die
Positionen des Wertstroms ein, statt alle Awards des Mandanten je Zyklus zu lesen.

**REQ-5 · Ein Recht je Vorgang.** `value-stream/[id]/page.tsx:320-326` prüft
`rtb_item.manage` statt `art_budget.manage` (heute sieht man Formulare, die der
Service ablehnt); die Solution-Fläche bekommt den Finance-Bypass, den der Service
kennt (`rtb-item-service.ts:82`). Das gemeinsame `assertManage` zieht nach
`server/services/rtb-authz.ts`.

**REQ-6 · Die Kachel sagt, was sie zeigt.** „Zugeteilt im laufenden Zyklus"
(`value-stream/[id]/page.tsx:253`) summiert über **alle** Halbjahre. Entweder auf
den Zyklus einschränken oder „Zugeteilt insgesamt" heißen.

**REQ-7 · `artBudgetRemaining` heißt, was es ist.** Umbenennen in
`unassignedToArts` (`domain/art-budget.ts:79`); die Fläche rechnet die Zahl nicht
mehr zurück (`art-budget-breakdown.tsx:111`), sondern bekommt die Auslastung
direkt. `art-budget-transparency.md` §8 hatte die Umbenennung angekündigt.

**REQ-8 · Kein deaktiviertes Eingabefeld als Tabelle.**
`art-budget-breakdown.tsx:211-219` rendert echte `<input disabled>`, obwohl
`ArtBudgetView` hart `canEdit={false}` übergibt. Die Zellen werden Text,
`canEdit`/`onChange` entfallen.

**REQ-9 · Die Riesen zerfallen.**

| aus `art-budget-detail.ts`       | wohin                                                                                  |
| -------------------------------- | -------------------------------------------------------------------------------------- |
| `coverageVerdict` :168-181       | `domain/art-throughput.ts`                                                             |
| Monats-Achse :183-247            | `domain/period-window.ts`, Monatsnamen aus `kernel/domain/calendar.ts:10`              |
| `loadArtCoverage` :641-730       | neu `server/services/art-coverage.ts`                                                  |
| `loadValueStreamCourse` :575-639 | neu `server/views/value-stream-course.ts` — **Sentinel `"__value_stream__"` entfällt** |
| `loadArtPotView` :732-836        | neu `server/views/art-pot-view.ts`, neben `services/art-pot.ts`                        |
| Labels :53-77                    | in die Komponenten                                                                     |

Rest ≈ 300 Zeilen: `buildArtBudgetDetail` + `loadArtBudgetDetail`.
`art-budget-tab.tsx` wird ein Bauteil je Block; die drei Reiter komponieren.

**REQ-10 · Die Primitive gewinnen.** `art-budget-detail.ts:695-699` benutzt
`aggregateArtFeatureLoad`; die Reduces über Perioden-Karten benutzen
`domain/period-map.ts`; die absteigende Handachse :271-284 benutzt
`periodsFromKeys`.

**REQ-11 · Aufteilen im selben Fenster wie Verteilen.** `RtbAwardsSection` ist
auf `halfYearKey(new Date())` festgenagelt (`value-stream/[id]/page.tsx:330`),
obwohl `potWindowClosedReason` das nächste Halbjahr freigibt: man kann heute fürs
nächste Halbjahr **verteilen**, aber nicht **aufteilen**.

**REQ-12 · Tote Wege weg.** `/portfolio/budgeting` zeigt auf `/budgeting/rounds`
— **existiert nicht, 404**. `/budgeting/board` → `/budgeting/round` →
`/budgeting/periods` wird ein Sprung. `ArtBudgetRow` heißt dreimal verschieden
Verschiedenes (`services/art-budget.ts:11`, `period-valuestreams.ts:11`, die
Komponente). Tote Exporte: `ArtBudgetEpicRow` :87, `ALLOCATION_SOURCES` :54,
`UNFUNDED_REASONS` :66, `RtbItemRow` (`rtb-item-service.ts:67`).

**REQ-13 · Die Verdrahtung wird getestet.** Fake-Context-Tests im Muster
`round-service.test.ts` für `art-pot.ts` (Deckel, Fenster, Rechte, Löschzweig,
`remaining`), `rtb-award-service.ts`, `rtb-item-service.ts` (inkl. REQ-1) und
`candidate-service.ts` — dessen Je-Wertstrom-Bündelung im Gleichlauf mit
`loadRtbPreview` der Kommentar in `period-detail.ts:229-231` ausdrücklich
verlangt, ohne dass es geprüft würde.

**REQ-14 · Die Dokumentation stimmt.** `src/modules/budgeting/README.md` nennt
die gelöschte Tabelle `ArtBudget` (:12, :28), beschreibt `art-budget.ts` als
schreibend (:40) und „vier Schreib-Aktionen" (:44) bei neun Action-Dateien; zwei
Kommentare verweisen auf das verschwundene `saveArtBudget`
(`features/actions/rtb.ts:21`, `rtb-item-service.ts:6`). Dazu die Walkthroughs
`art-epic-budget-walkthrough.md:160` und `structure-walkthrough.md:161-164`.

**REQ-15 · Der ART verteilt sein eigenes Budget.** Heute darf der RTE es nur
**lesen**: `budget.read` trägt er mit `scope: "art"`, aber
`artPotAccessDeniedReason` (`domain/art-pot-access.ts:30`) kennt nur drei Wege —
Finance-Partei, `rtb_item.manage`, Produkt-Manager des Epics. Ohne Änderung wäre
die neue Fläche für den ART eine Lesefläche.

Neue Action **`art_budget.distribute`** — das Präfix `art_budget.` ist in
`modules.ts:113` bereits Budgeting zugeordnet, die Registry bleibt unangetastet.
Policy spiegelt `budget.read`:

```
"art_budget.distribute": [
  { roles: [TENANT_ADMIN, PORTFOLIO_MANAGER, VALUE_STREAM_OWNER] },
  { roles: [RTE], scope: "art" },
]
```

`ArtPotAccessFacts` bekommt eine vierte Tatsache; der Doc-Kommentar, der die
drei Wege begründet, wird auf vier fortgeschrieben. **Die Grenze bleibt scharf:**
das Budget wird weiter vom Wertstrom gesetzt, der ART verteilt nur.
_Test:_ alle vier Wege einzeln, plus ein RTE eines **fremden** ARTs.

**REQ-16 · Ein Wort je Sache.** Das Vokabular aus §0.1 wird durchgesetzt.
„Ballot" → **PB-Liste** (~100 Code-Stellen, davon acht sichtbare UI-Texte);
`BallotSheets` → **Verteilbögen**, wie die Route sie schon nennt — damit trennen
sich zwei Dinge, die heute ein Wort teilen. „Veränderungsrahmen"/„ART-Topf"/
„ART-Budget" → **ART-Epic-Budget** mit den drei Zuständen.

Betrifft `RTB_KIND_LABELS`, `ALLOCATION_SOURCE_LABELS`, die Komponenten und die
Doku. Zieht mit: `artBudgetRemaining` → `unassignedToArts` (REQ-7) und
`ArtBudgetRow`, das dreimal Verschiedenes heißt (REQ-12).

**Eigener Commit, keine Logik daneben.** Der Typechecker beweist die Bezeichner,
nicht die deutsche Grammatik — die geänderten Texte werden gelesen.

**REQ-17 · Das Budget meldet sich.** `listMyBudgetingTasks`
(`server/services/my-budgeting-tasks.ts`) kennt heute nur die
Gruppen-Verteilung. Neue Quelle: je ART, für den der Betrachter verteilen darf
(REQ-15) und dessen Budget im offenen Fenster unverteilt ist, eine Aufgabe mit
Link auf `?tab=verteilen`. Erscheint nach dem Aufteilen, verschwindet, wenn
verteilt ist. **Keine Eskalation zum Fensterende** — eine Erinnerungsregel ohne
Schwelle wird Lärm.

**REQ-18 · Eine Quelle je Epic.** `mergeEpicAllocation`
(`epic-allocation.ts:127`) **setzt**, statt zu addieren, und beide Geldwege
schreiben dieselbe Zelle (`finalize-service.ts:132`, `art-pot.ts:201/:247`). Wer
zuletzt schreibt, gewinnt: 100.000 € über die PB-Liste und danach 40.000 € aus
dem ART-Epic-Budget ergeben 40.000 €. Die Flächen gehen dabei auseinander, weil
sie aus verschiedenen Quellen rechnen:

| Sicht                 | Quelle                        | zeigt     |
| --------------------- | ----------------------------- | --------- |
| Gate L3.1 → L3.2      | `BudgetAllocation`            | 40.000 €  |
| Epic-Detail           | `BudgetAllocation`            | 40.000 €  |
| ART-/Wertstrom-Budget | `BudgetCandidate.finalAmount` | 100.000 € |

Erreichbar ohne Zutun: ein über die PB-Liste finanziertes Epic sinkt unter das
Portfolio-Limit, `classifyEpic` macht es zum ART-Epic, es erscheint in der
Verteilliste. Dass es `portfolioOverrideAt` gibt, zeigt, dass die Einordnung
kippt.

**Nicht als Schreibkonflikt lösen, sondern als Zugehörigkeit** — robuster, und
ohne Fehlermeldung im heißen Pfad: `addEpicCandidate` weist als ART-Epic
eingeordnete Epics ab; `loadArtPotView` blendet Epics aus, die im selben Zyklus
Kandidat sind; `mergeEpicAllocation` bekommt ein `source`-Argument und **loggt
laut**, wenn eine belegte Zelle aus der anderen Quelle überschrieben würde.

_Vorher zählen:_ Epics mit `ArtEpicAllocation` **und**
`BudgetCandidate.finalAmount > 0` im selben `cycleKey`. Das Ergebnis entscheidet,
ob eine Bereinigung dazugehört.

**REQ-19 · Hinter der Practice.** `/budgeting/arts` und sein Nav-Eintrag
erscheinen nur bei aktiver Practice `artEpics` — derselbe Schalter, der heute
schon `detail.pot` auf `null` setzt. Kein neuer Mechanismus, und ein Mandant ohne
ART-Epics bekommt keinen Eintrag, der nur Leerzustände zeigt.

**REQ-20 · Der Leitfaden.** `domain/art-funding-phases.ts`, baugleich zu
`domain/period-phases.ts`: fünf Schritte, vier Zustände, `current` ist der erste
weder erledigte noch gesperrte — ohne gespeicherten Zeiger.

| #   | Schritt          | handelt                | Ort                              |
| --- | ---------------- | ---------------------- | -------------------------------- |
| 1   | ART-Epic-Budget  | Wertstrom              | `value-streams/[id]?tab=betrieb` |
| 2   | Auf der PB-Liste | Kachel (beim Start)    | `periods/[id]?tab=setup`         |
| 3   | Zuspruch         | Kachel (Finalisierung) | `periods/[id]?tab=ergebnis`      |
| 4   | Aufteilen        | Wertstrom              | `value-streams/[id]?tab=betrieb` |
| 5   | Verteilen        | **ART**                | `arts/[artId]?tab=verteilen`     |

Zwei Zusätze gegenüber der Kachel-Leiste: **`actor`**
(`value_stream` | `period` | `art`) als Tatsache — wie sich das liest, entscheidet
die Komponente („dran · Sie" / „wartet auf den Wertstrom") — und **`href`** statt
`basePath`, weil die Schritte auf verschiedenen Flächen liegen. Das geht erst,
seit alles unter `/budgeting` liegt.

`ArtFundingRail` sitzt im `subHeader` **beider** Detailflächen. Auf dem Wertstrom
aggregiert Schritt 5 („bei den ARTs · 2 von 3"), deshalb braucht es dort keinen
ART-Wähler: die Schritte 1–4 sind ohnehin Wertstrom-Schritte. Die Abschnitte
tragen über die vorhandene `Step`-Komponente **dieselben Nummern** (1 · 4 · 5) —
keine zweite Zählung daneben, den Fehler beschreibt `period-phases.ts` bei
„Runde starten" selbst.

Die Liste erbt die Kurzform (`phaseSummary()`), wie die Kachel-Gallery sie zeigt.

**REQ-21 · Sammelspeichern.** Die Verteilliste hat je Zeile ein eigenes `<form>`
mit `✓`-Knopf (`art-pot-section.tsx:105-133`) — ein Roundtrip je Betrag, kein
Zustand „ungespeichert", kein Zurück, und der Knopf trägt kein `aria-label`.
`rtb-awards-section.tsx` macht es einen Schritt vorher schon richtig: eine
Tabelle, ein Knopf, Überschreitung sperrt ihn. Beide Flächen tun dasselbe und
sollen sich gleich anfühlen. `budgeting-ui-refactor.md` forderte das im August
(„weg von einem Speichern-Button je Zeile"); es ist nie passiert.

---

## 4 Umzugs-Mechanik

Der Umzug ist **einfacher als der Struktur-Umbau vom 3. September** (`0df7eca`):
das Zielsegment `/budgeting` trägt bereits das richtige Modul, also braucht es
**keinen `PATH_OVERRIDES`-Eintrag** und keine Registry-Änderung — beide
Vollständigkeitsrichtungen in `modules.test.ts:60-92` bleiben grün. Die
Action-Achse liegt schon richtig (`art_budget.`/`rtb_item.` → budgeting).

| Anzufassen                                                                        | Warum                                                                                                                   |
| --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `src/components/nav/nav-config.ts:163-186` + `messages/de.json`/`en.json`         | zwei Einträge                                                                                                           |
| `src/app/[locale]/(dashboard)/layout.tsx:68-82`                                   | **derselbe Aufruf ist Nav-Filter und Route-Guard** — nichts zu tun, aber zu wissen                                      |
| `src/server/http/revalidation.ts:44,48,70,94,98,108` + Test                       | Pfade                                                                                                                   |
| `src/modules/onboarding/domain/role-playbook.ts:308,316,410`                      | `/budgeting/board`; `value_stream_owner.art_budget` sagt heute „Die Detailansicht deines Wertstroms führt dich dorthin" |
| `epic-next-step.ts:140`, `funding-snapshot-table.tsx:24`, `milestones.ts:125-126` | Links auf `/budgeting/board` und `/budgeting`                                                                           |

**Der eigentliche Verlust:** `/budgeting` hat **kein `layout.tsx`**. Die
zuwandernden Flächen verlieren den Struktur-Baum aus
`structure/(organisation)/layout.tsx`, der Aufklapp-Zustand und Scroll-Position
gratis mitbringt. Ersatz sind die Listen-Seiten, `backHref` und der
`subHeader`-Umschalter.

**Rechte-Scope:** `budget.read` wird heute am Knoten mit `scope: "art"`
ausgewertet. Die Detailseite behält den Knoten in der Route; die **Liste**
braucht die drei Wege aus `art/[id]/page.tsx:88-97` als Filter.

**Tab-Erinnerung:** `pulse-structure-tab-art`/`-vs` sind nach Knotenart
geschlüsselt, nicht nach Route. Ein gespeichertes `budget` fällt über
`resolveTab` still auf `overview` zurück — kein Bruch, ein stiller Reset.

---

## 5 Umsetzung in Stufen

Geordnet nach Risiko und Wirkung, nicht nach Kategorie.

1. **Den toten Pfad beleben** — REQ-1 bis REQ-5, REQ-15. Klein und sofort
   wertvoll: das ART-Epic-Budget wird zum ersten Mal ohne Seed benutzbar, und
   der ART darf es verteilen. _Vorher messen:_ wie viele Rahmen-Positionen sind
   inaktiv und tragen einen Award? Das ist die Menge, deren Budget durch REQ-3
   sinkt.
2. **Eine Quelle je Epic** — REQ-18. Datenkorrektheit, bevor mehr gemischte
   Daten entstehen. _Vorher zählen._
3. **Die Riesen zerlegen** — REQ-9, REQ-10, REQ-13. Reine Umstrukturierung, kein
   neues Rechnen; die Reihenfolge in REQ-9 hält jeden Zwischenschritt grün.
4. **Das Vokabular** — REQ-16, dazu REQ-7 und REQ-12. **Eigener Commit.**
5. **Der Leitfaden** — REQ-20 und REQ-17.
6. **Der Umzug** — die neuen Flächen, Nav, REQ-19, REQ-6, REQ-8, REQ-11, REQ-14.
   **Erst wenn beides steht und geprüft ist**, fallen die Reiter unter
   `/structure`: der harte Schnitt ist das Ziel, nicht die Reihenfolge.
   REQ-21 zieht mit der neuen Verteilliste ein.

Stufe 1 steht für sich. Stufen 5 und 6 sind erst sinnvoll, wenn 3 gelaufen ist —
eine Datei zu verschieben, die man gleich zerlegt, verdoppelt den Diff.

---

## 6 Bewusster Verzicht

- **Kein vierter Geldweg.** Der Rahmen entsteht weiter nur aus einer
  abgeschlossenen Kachel. Die Fläche ist unabhängig, das Geld nicht.
- **Guardrails bleiben am Wertstrom** — sie sind `modules/work`, kein Budgeting.
- **Die Grow:Run-Kacheln bleiben an der Solution** — Kennzahl, kein Arbeitsplatz.
- **Keine Ist-Kosten**, wie in `art-budget-transparency.md` §8.
- **Keine E2E-Tests in dieser Spec.** `tests/e2e/` enthält nur `.gitkeep`; das
  ist ein eigener Vorgang, kein Anhängsel.
- **Harter Schnitt, keine Übergangs-Redirects.** Die Reiter unter `/structure`
  fallen ersatzlos; `resolveTab` (`entity-detail-shell.tsx:11`) fängt einen
  gespeicherten Reiter still auf „Allgemein" ab. Genau die dauerhaften
  Weiterleitungen früherer Umzüge sind die Ketten, die diese Spec aufräumt
  (`board` → `round` → `periods`).
- **Kein Recht, ein ART-Epic-Budget selbst zu beantragen.** REQ-15 gibt dem ART
  das Verteilen, nicht das Anlegen — das Budget ist ein Anspruch auf den Zuspruch
  des Wertstroms, und der entscheidet, wofür er ihn einsetzt.

---

## 7 Verifikation

1. `pnpm typecheck`, `pnpm lint`, `pnpm test` — grün außer den fünf
   vorbestehenden `role-playbook`/`role-tour`-Fehlern, die auf `/risks` und
   `/impediments` zeigen (nicht budgeting-bezogen; `0df7eca` hält sie fest).
2. **REQ-1 am laufenden Datensatz:** in Pulse Demo Corp einen Wertstrom öffnen,
   unter „Run the Business" eine Position mit Art = ART-Epic-Budget und einem ART
   anlegen — sie muss danach in `/budgeting/arts/[artId]` als Budget des ARTs
   erscheinen. Heute ist dieser Schritt unmöglich; das ist der Kernbeleg.
3. **REQ-3:** dieselbe Position deaktivieren ⇒ Budget **und** Deckel sinken.
   Gegenprobe vor der Änderung: sie sinken nicht.
4. **REQ-15:** ein Nutzer mit ausschließlich der RTE-Rolle kann auf seinem ART
   speichern und sieht die Zeilen eines fremden ARTs als Text.
5. **REQ-18:** ein Epic, das aus beiden Quellen Geld bekommen soll, taucht in
   genau einer Liste auf.
6. **REQ-20:** drei Wege durchgehen — ART ohne Budget · Budget ohne Kachel ·
   zugesprochen und unverteilt. Jede Leiste zeigt genau einen `current` und
   springt auf eine Route, **die es gibt** — der Fehler, an dem `ProcessRail`
   scheiterte: „wer auf Schritt 4 klickte, landete auf Schritt 0."
7. **REQ-19:** Practice `artEpics` aus ⇒ kein Eintrag „ART-Budgets", Route weg.
8. **Die Strecke:** ART-Epic vormerken → Kachel abschließen → Zuspruch aufteilen
   → verteilen. Vorher fünf Seitenwechsel über drei Nav-Bereiche, nachher zwei
   innerhalb von Budgeting.
9. **Entitlement:** Mandant ohne Budgeting-Modul ⇒ die neuen Routen leiten über
   `layout.tsx:50-53` auf `firstEnabledHome` um, die Nav-Gruppe fehlt.
10. `npx vitest run src/modules/budgeting` und
    `src/modules/core/kernel/domain/__tests__/modules.test.ts`.
11. **Zum Schluss:** `art-budget-detail.ts` unter 350 Zeilen, `art-budget-tab.tsx`
    gibt es nicht mehr, und kein „Ballot", „Veränderungsrahmen" oder „ART-Topf"
    mehr im Code außer in bewusst markierten Bestandszitaten.

---

## 8 Referenzen

- [art-budget-transparency.md](art-budget-transparency.md) — die Spec, deren
  Flächen hier umziehen; §8 bleibt in Kraft
- [budgeting-refactor.md](budgeting-refactor.md) — das Kachel-Modell
- [budgeting-ui-refactor.md](budgeting-ui-refactor.md) — abgelöst, aber die
  Herkunft der Forderung
- [art-epics.md](art-epics.md) — Guardrail 3, die Einordnung klein/groß
- [art-epic-budget-walkthrough.md](art-epic-budget-walkthrough.md) — der gelebte
  Ablauf, nach dem Umzug nachzuziehen
- ADR-0013 (Modul-Schichtung), ADR-0018 (Stage-Gates)
