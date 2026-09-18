# Eine Fläche für das Geld eines Wertstroms — Analyse und Spec

> Status: **umgesetzt** · Erstellt 2026-09-18 · Abgeschlossen 2026-09-19
>
> Vierte Spec der Reihe. Sie setzt auf
> [art-budget-transparency.md](art-budget-transparency.md) (was nach der
> Finalisierung mit dem Geld passiert) und
> [art-budget-relocation.md](art-budget-relocation.md) (wo die Flächen liegen)
> auf und **legt deren zwei Flächen zu einer zusammen**.
>
> `§8` der Transparenz-Spec bleibt unverändert in Kraft: diese Spec verschiebt
> Flächen und vereinheitlicht Wörter, sie eröffnet **keinen weiteren Geldweg**.

`/budgeting/value-streams/[id]` und `/budgeting/arts/[artId]` sind zwei Seiten
über **dasselbe Geld**. Sie sind es geworden, nicht gewesen: die
Relocation-Spec hat beide Flächen aus `/structure` hierher geholt und dabei je
eine eigene Gestalt gegeben. Zielbild dieser Spec: **eine Seite, die ARTs
klappen darin auf.**

---

## 1 Analyse

### 1.1 Was schon eins ist

| Gemeinsam                                | Datei                                                                         |
| ---------------------------------------- | ----------------------------------------------------------------------------- |
| Die Hülle samt Reiter-Mechanik           | `components/detail/entity-detail-shell.tsx`                                   |
| Die fünfschrittige Kette und ihre Leiste | `domain/art-funding-phases.ts:72`, `features/components/art-funding-rail.tsx` |
| Der Halbjahres-Begriff                   | `domain/cycle.ts:88` `resolveCycle`                                           |
| Der Verlaufs-Typ und sein Diagramm       | `domain/allocation-course.ts`, `art-budget/allocation-course-chart.tsx`       |
| Der Falter des ART-Budgets               | `views/art-budget-detail.ts:67` `buildArtBudgetDetail`                        |

Die Kette ist sogar **beidseitig gedacht**: `artFundingPhases` nimmt ein
`focusArtId`; ist es gesetzt, ist Schritt 5 „sein" Schritt, sonst fasst er alle
ARTs zusammen („2 von 3"). Das Konzept existiert also bereits — als reine
Funktion. Nur die Flächen folgen ihm nicht.

### 1.2 Was doppelt ist — im Code

- **Der Halbjahres-Umschalter** steht zeichengleich zweimal da
  (`arts/[artId]/page.tsx:126-141`, `value-streams/[id]/page.tsx:80-95`).
- **`FundingRail` + `RailSkeleton`** sind zweimal identisch definiert, beide mit
  demselben Kommentar („kostet sechs Abfragen" — es sind sieben).
- **Der Euro-Formatierer** ist in beiden Listenseiten lokal nachgebaut, obwohl
  `formatEUR` in `src/lib/formatting.ts:26` steht.
- **Zwei Lader auf dieselbe Zahl:** `art-budget.ts:55` und
  `art-budget-detail.ts:229` aggregieren beide `BudgetCandidate` je Halbjahr.
- **`loadValueStreamCourse`** ruft `buildArtBudgetDetail` mit `artId: null` und
  wirft **fünf von neun Feldern** weg — die Wertstromseite benutzt den
  ART-Falter als Halbfabrikat.

### 1.3 Was doppelt ist — im Vokabular

Der schwerere Teil, und durch Zusammenlegen allein **nicht** gelöst:

- **„ART-Budgets" und „ART-Epic-Budgets" stehen untereinander auf derselben
  Seite und sind verschiedene Zahlen.** Das eine ist aus Epic-Zuteilungen
  abgeleitet (`art-budget.ts:55`), das andere der zugesprochene Rahmen aus
  RTB-Positionen (`art-epic-budget.ts:64`).
- **„ART-Epic-Budget"** bezeichnet an fünf Stellen Verschiedenes: Spaltenkopf
  der ART-Liste, Quellen-Label, Phasen-Label, RTB-Untertabelle, Kachel im
  Verteilformular.
- **„Zugeteilt · Verteilt · Rest · Zugesprochen · Noch zu verteilen"**
  überlappen paarweise, ohne dass eine Stelle sagt, welches Paar welche Frage
  beantwortet.

### 1.4 Die Sperre: die Wertstromseite prüft kein Leserecht

Keine Capability, kein `enabledModules`, keine Scope-Prüfung —
`requirePrincipal` und ein Tenant-Filter, mehr nicht
(`value-streams/[id]/page.tsx:45-56`). Die ART-Seite prüft **vier** Wege
(`art-budget-access.ts:29-61`).

Die ART-Inhalte ohne Weiteres dorthin zu ziehen hiesse, **geschütztes Geld
hinter eine offene Tür** zu stellen. Das ist Stufe 1, und sie trägt auch dann,
wenn vom Rest nichts käme.

### 1.5 Es sind drei Flächen, nicht zwei

Der **Ergebnis-Reiter einer abgeschlossenen Kachel** zeigt dieselben Zahlen aus
derselben Quelle: `period-valuestreams.ts` leitet `BudgetCandidate.finalAmount`
dreifach ab — je Wertstrom, je ART darunter, und Run-the-Business je Wertstrom.
Drittes Layout, dritter Satz Wörter, dieselbe Wahrheit.

Der eingefrorene **Budget-Plan** ist die vierte Darstellung. Er bleibt
ausserhalb: er ist ein Beleg, kein Nachschlagewerk.

### 1.6 Gemessen

|                  | Wertstrom-Detail                                        | ART-Detail           | Listen                            |
| ---------------- | ------------------------------------------------------- | -------------------- | --------------------------------- |
| Abfragen         | 7 (Leiste) + 7 bzw. 6                                   | 7 (Leiste) + ~14     | 3 bzw. 2                          |
| Dreifach gelesen | `BudgetCandidate`, `RunTheBusinessItem`, `RtbItemAward` | `Tenant`, ART-Rahmen | —                                 |
| Leserecht        | **keins**                                               | vier Wege            | ART-Liste filtert, VS-Liste nicht |
| Eigene Tests     | keine                                                   | keine                | keine                             |

**Ladezeiten** (Dev-Modus, aus dem Server-Protokoll): Wertstrom-Detail
**2337 ms**, ART-Liste **1613–2607 ms**, Wertstrom-Liste **1254–2056 ms**.

**Die Ursache ist nicht die Datenbank.** Die schwerste Abfrage läuft in
**0,26 ms**; der Treiber ist die **Rundreise** — 40–95 ms je Abfrage nach
`eu-west-1`. Für die **Detailseiten** zahlt Zusammenlegen sich deshalb wirklich
(14 bzw. 21 Rundreisen). Für die **Listen nicht**: drei Abfragen sind ~180 ms,
der Rest ist Dev-Modus und Rendern.

### 1.7 Das Betriebsgeld — und wo es hingehört

`run`-Positionen tragen **nie** ein ART (0 von 9 je Mandant),
`art_change`-Positionen immer. Auf Kandidatenebene tragen **alle** RTB-Kandidaten
`art_id = null`: 18 von 18 in `Large Test Corp` mit **6,39 Mio €**.

Das Modell dahinter (Festlegung 2026-09-18): Betriebsgeld wird auf drei Ebenen
zugeordnet, und **alle drei enden am ART** —

1. **am ART** (dazu gehört auch der ART-Epic-Topf),
2. **an einer Solution**, die zu einem ART gehört (Solution-Budget darf als
   _ART-Epic-Budget_ geführt werden, wenn es der Weiterentwicklung dient),
3. **am Wertstrom** — dann wird es auf die ARTs **geschlüsselt**.

Wie weit das heute schon gelebt wird:

| Lage der aktiven Betriebspositionen     | Positionen | Summe           |
| --------------------------------------- | ---------- | --------------- |
| über die Solution auf ein ART auflösbar | 14         | **1.116.000 €** |
| nur am Wertstrom — Schlüssel nötig      | 10         | **238.000 €**   |
| Solution **ohne** ART — nicht auflösbar | 1          | 15.000 €        |

Der grösste Teil ist also zuordenbar — aber **kein Code tut es**: auf diesen 14
Zeilen steht `artId = null`.

### 1.8 Die Rollen-Matrix kennt das Geld nicht

`docs/role-function-matrix.md` hat 320 Zeilen und **kein einziges** „budget";
`docs/personas.md` ebenso wenig. Vier Capabilities — `budget.read`,
`budget.round.manage`, `art_budget.distribute`, `rtb_item.manage` — haben keinen
dokumentierten Eigentümer. Für eine Spec, die neu zeichnet, wer welche Zahl
sieht, gibt es nichts zum Abgleichen.

Die Rollen sind dabei keine Theorie: **9 RTE-Zuweisungen** stehen **6
Wertstrom-Ownern** gegenüber.

---

## 2 Zielbild

### 2.1 Eine Fläche, zwei Tiefen

`/budgeting/value-streams/[id]` wird **die** Geldfläche eines Wertstroms. Die
ARTs stehen darin als aufklappbare Zeilen — zugeklappt die Zahlenzeile, die es
heute gibt; aufgeklappt, was bisher die ART-Seite zeigte.

Zwei Reiter, geschnitten nach **Modus**, nicht nach Ebene:

| Reiter      | Inhalt                                                                                 |
| ----------- | -------------------------------------------------------------------------------------- |
| **Budget**  | zum Lesen: Budgetplan · Verlauf · ART-Zeilen (aufklappbar) · Auslastung · Feature-Last |
| **Betrieb** | zum Arbeiten: RTB-Positionen · Zuspruch aufteilen · je ART das Verteilen des Rahmens   |

Skizze einer Zeile:

```
▸ Warehouse & Inventory      Zugeteilt 1.240.000 €   Betrieb 180.000 €   ● gedeckt
▾ Plant Efficiency (OEE)     Zugeteilt   960.000 €   Betrieb 240.000 €   ● überbucht 120.000 €
    Deckung   Last 1.080.000 €  ·  Zugeteilt 960.000 €  ·  Lücke 120.000 €
    Zustand   Nicht begonnen 300.000 € · Gebunden 410.000 € · Verbraucht 250.000 €
    Epics     … (nach Zustand sortiert)
```

Die Zeilen folgen der **Dringlichkeit**: „Nichts begonnen" wiegt schwerer als
„überbucht" — brachliegendes Geld ist verlorene Zeit, Überbuchung hat Vorlauf
(Transparenz-Spec §2.7).

### 2.2 Die Kette wird vier Schritte

„Aufteilen" und „Verteilen" liegen künftig auf einer Seite und werden **ein**
Schritt. `FundingPhase` trägt aber genau **einen** `actor`, und der beantwortet
die Frage, für die es die Leiste gibt — _„auf wen warte ich"_.

**Der Handelnde wandert deshalb innerhalb des Schritts:** solange der Zuspruch
nicht aufgeteilt ist, `actor: "value_stream"`; danach `actor: "art"`. Der Sprung
führt auf dieselbe Seite, aber an verschiedene Stellen.

### 2.3 Die alten Routen bleiben Einsprünge

`/budgeting/arts/[artId]` leitet auf
`/budgeting/value-streams/<vs>?art=<artId>` um, `?tab=verteilen` auf
`…&tab=betrieb&art=<artId>`. Auf die Route zeigen die persönliche Inbox
(`my-budgeting-tasks.ts:126`), Schritt 5 der Kette und ein Wiki-Leitfaden.

`/budgeting/arts` (Liste) sollte **bleiben** samt Nav-Eintrag: sie beantwortet
„alle meine ARTs, über Wertströme hinweg" — der Einstieg des RTE.

> **Zurückgenommen am 2026-09-19.** Entschieden: _„Die Seite soll weg. RTEs
> sollen durch den Wertstrom gehen."_ Damit trägt die Liste nichts mehr, was die
> Geldfläche des Wertstroms nicht zeigt — sie war ein zweiter Nav-Eintrag zu
> demselben Geld, und genau dagegen ist diese Spec geschrieben. Route bleibt als
> Wegweiser, Nav-Eintrag und Übersetzung sind entfallen; keine
> `/budgeting/arts`-Route steht mehr in einer Revalidierungsgruppe.
>
> **Die Begründung liess sich nicht messen**, und das gehört dazu: in den Seeds
> ist _eine_ Person RTE für **alle** ARTs eines Mandanten, 3 von 5 hätten also
> „über Ströme hinweg" gezählt. Ein Seed-Artefakt, kein Befund.

### 2.4 Was ein ART-Verantwortlicher sieht

- Der **Rahmen** des Wertstroms ist für jeden sichtbar, der mindestens ein ART
  dieses Stroms sehen darf.
- **Zahlen je ART** nur für die ARTs, die der Betrachter sehen darf. Die übrigen
  Zeilen stehen als Name ohne Beträge — dass es sie gibt, ist keine
  Geheimhaltung wert; was sie kosten, schon.
- **Summenzeilen des Wertstroms** (Budgetplan, Verlauf, Auslastung) erfordern
  das Wertstrom-Recht. Wer es nicht hat, sieht eine **kürzere** Seite, keine mit
  Lücken.

### 2.5 Ein Vokabular

| Heute                      | Künftig                                        | Was es ist                                 |
| -------------------------- | ---------------------------------------------- | ------------------------------------------ |
| „ART-Budgets" (Tabelle)    | **Zugeteilt je ART**                           | abgeleitet aus Epic-Zuteilungen der Kachel |
| „ART-Epic-Budget" (Rahmen) | **ART-Rahmen**                                 | zugesprochen aus RTB-Positionen            |
| „Verteilt" / „Rest"        | **Aus dem Rahmen verteilt** / **Rahmen offen** | nur am Rahmen                              |
| „Zugeteilt" (RTB)          | **Zugesprochen**                               | Ergebnis der Kachel                        |

**Der Code behält seine Namen.** `ArtEpicBudget`, `loadArtEpicBudgets`,
`ArtEpicAllocation` heissen weiter so — das sind Typ- und Tabellennamen, und die
Tabelle umzubenennen wäre eine Migration ohne Gegenwert. Umbenannt wird, was
jemand **liest**. Wer die Kommentare später angleicht, tut es aus Sorgfalt, nicht
weil etwas falsch wäre; die Zuordnung „Rahmen = `ArtEpicBudget`" steht hier.

### 2.6 Was das Betriebsgeld **nicht** anfassen darf

`ArtCoverage` (`art-coverage.ts:126-135`) rechnet `gap = loadEuro − allocated`,
und `allocated` ist ausschliesslich **Epic**-Geld. Dieselbe Zahl ist zugleich der
**Zähler des €-Satzes** (`cycles[].budget`, :112).

Flösse geschlüsseltes Betriebsgeld dort hinein, spränge die **Deckungsampel auf
„gedeckt"**, obwohl kein Euro davon ein Feature bezahlt — und der **€-Satz
stiege**, weil der Zähler wächst und der Nenner (Job Size) nicht. Da derselbe
Satz die Last in Euro multipliziert, verstärkt sich der Fehler ein zweites Mal.

**Die ART-Zeile zeigt das Betriebsgeld, die Rechnung fasst es nicht an.**

---

## 3 Datenmodell

| Änderung                             | Warum                                                               |
| ------------------------------------ | ------------------------------------------------------------------- |
| `solutions.art_id` wird **NOT NULL** | Jede Solution-Position löst sich eindeutig auf ein ART auf (§1.7)   |
| — sonst nichts                       | Der Schlüssel ist zunächst gleichmässig und braucht keinen Speicher |

Die Nachpflege (7 Zeilen), vier abgeleitet, drei entschieden:

| Solution                       | → ART                        | Herkunft                      |
| ------------------------------ | ---------------------------- | ----------------------------- |
| Logistik Programm              | Warehouse & Inventory        | abgeleitet (29 Epics)         |
| Produktion Programm            | Plant Efficiency (OEE)       | abgeleitet (30)               |
| Customer Experience MVP        | Web & Mobile                 | abgeleitet (2)                |
| Payments Platform MVP          | Cards & Wallets              | abgeleitet (1)                |
| Digital Banking MVP            | Accounts & Onboarding        | entschieden (Epics 3:2)       |
| Verwaltung & Overhead Programm | Shared Services & Automation | entschieden (keine Epics)     |
| Digital Banking Legacy         | Accounts & Onboarding        | entschieden (h0, keine Epics) |

> **Einwand, überstimmt, hier festgehalten.** ADR-0020 legt fest, dass der
> Lebenszyklus einer Solution **in H2 beginnt** („Emerging"); die Seeds geben
> deshalb absichtlich nur den h1-Solutions ein ART. Eine Pflicht-Spalte verlangt
> die Zuordnung im unsichersten Moment, und ADR-0022 hängt die Solution an den
> Wertstrom, nicht unter ein ART. Gemessen löst die Pflicht **eine** heutige
> Position über 15.000 €; die Alternative „ART erst ab H1" hätte dasselbe ohne
> DDL erreicht. Die Entscheidung ist gefallen — ADR-0020 und ADR-0022 bekommen
> einen Nachtrag.

---

## 4 Requirements (testbar)

**REQ-1 · Die Wertstromseite prüft.** Eine reine Regel in
`domain/budget-access.ts` — neben die drei, die dort stehen — beantwortet
„darf dieser Principal dieses Wertstrom-Budget lesen". Die Seite ruft sie;
ohne Recht gibt es keinen Zugang statt einer leeren Seite. Wächter-Test.

**REQ-2 · Eine Regel für Liste und Detail.** `arts/page.tsx:46-53` und
`art-budget-access.ts:29-61` lesen **dieselbe** Funktion. Heute filtert die
Liste enger: ein ART, dessen Detail zugänglich ist, fehlt dort.

**REQ-3 · Zahlen je ART nur mit Recht.** Die Fläche zeigt Beträge nur für ARTs,
die der Betrachter sehen darf; übrige Zeilen tragen den Namen ohne Beträge. Die
Summenzeilen des Wertstroms erscheinen nur mit Wertstrom-Recht.

**REQ-4 · Ein Wort, eine Bedeutung.** Die Tabelle aus §2.5 ist umgesetzt; die
Labels stehen in **einer** Map je Geldstrang und werden von beiden Tiefen
gelesen. Kein Begriff kommt auf der Fläche in zwei Bedeutungen vor.

**REQ-5 · Ein Lader je Gegenstand.** `BudgetCandidate`,
`RunTheBusinessItem` und `RtbItemAward` werden je Seitenaufruf **einmal**
gelesen (`react.cache` wie `budgeting.ts:213`). Die Zahl der Rundreisen der
Detailseite sinkt messbar.

**REQ-6 · Die ART-Zeile klappt auf.** Zugeklappt Zahlenzeile, aufgeklappt
Deckung, Zustandsstaffel und Epics; im Reiter „Betrieb" das Verteilformular.
Sortierung nach Dringlichkeit. Ein ART **ohne jede Zuteilung** sagt das, statt
eine Zeile aus Nullen zu zeigen.

**REQ-7 · Die Einsprünge halten.** `/budgeting/arts/<id>` und
`?tab=verteilen` landen aufgeklappt an der richtigen Stelle; Kette, Inbox und
Wiki-Leitfaden folgen. Der Guard-Test über Leitfaden-Routen bleibt grün.

**REQ-8 · Vier Schritte, wandernder Handelnder.** `artFundingPhases` fasst
„Aufteilen" und „Verteilen" zusammen und trägt `actor: "value_stream"` bis der
Zuspruch aufgeteilt ist, danach `actor: "art"`. Test für beide Stände.

**REQ-9 · Betriebsgeld endet am ART.** Solution-Positionen lösen sich über
`Solution.artId` auf; Wertstrom-Positionen werden gleichmässig auf die ARTs des
Stroms verteilt. Die Zuordnung ist eine **reine** Funktion.

**REQ-10 · Die Rechnung bleibt Veränderungsgeld.** `allocated`, `gap` und der
€-Satz enthalten **kein** `run`-Geld. Wächter-Test, der genau das festhält.

**REQ-11 · Gelöschte ARTs verschwinden.** `value-streams/[id]/page.tsx:195`,
`art-funding.ts:38` und `arts/page.tsx:36` filtern `deletedAt: null` wie
`art-budget.ts:43`.

**REQ-12 · Beide Listen werden revalidiert.** `/budgeting/arts` und
`/budgeting/value-streams` stehen in den Gruppen `budgetAllocation`, `art` und
`rtbItem`; `rtbItem` zeigt zusätzlich auf die ART-Seiten und nicht mehr auf die
entleerten `/structure`-Routen. Der Registry-Test zählt mit.

**REQ-13 · Toter Code fällt.** `ArtBudgetTab view="all"` samt eingebautem
Umschalter, `UnfundedReason "artPot"`, `ArtBudgetDetail.course.art`,
`computeReserve` aus `domain/reserve.ts`, und der String-Umweg in
`ArtBudgetView`.

**REQ-14 · Ein Euro-Formatierer.** Beide Listenseiten benutzen `formatEUR`.

**REQ-15 · Der Ergebnis-Reiter der Kachel** bekommt dieselbe aufklappbare Zeile,
aus **eingefrorenen** Daten, und sagt es („Stand der Finalisierung").

**REQ-16 · Die Rollen-Matrix bekommt das Geld.** Ein Abschnitt je Rolle — wer
liest, wer verteilt, wer teilt auf, mit welchem Scope — im Schnitt der übrigen
Ebenen.

---

## 5 Umsetzung in Stufen

1. **Leserecht der Wertstromseite** (REQ-1, REQ-2, REQ-3). Trägt allein.
2. **Ein Vokabular** (REQ-4). Nur Wörter.
3. **Ein Lader je Gegenstand** (REQ-5, REQ-11, REQ-12, REQ-13, REQ-14).
4. **Die aufklappbare ART-Zeile** im Reiter „Budget" (REQ-6).
5. **Das Verteilen** im Reiter „Betrieb", je ART.
6. **Die Einsprünge und die Kette** (REQ-7, REQ-8).
7. **Betriebsgeld am ART** (REQ-9, REQ-10) — danach die Pflicht-ART an der
   Solution: DDL von Hand, angekündigt, einzeln bestätigt, mit der Nachpflege
   aus §3.
8. **Der Ergebnis-Reiter der Kachel** (REQ-15) und die **Doku** (REQ-16, ADR-
   Nachträge, Nav-Kommentare).

**Nach Stufe 3 ist ein sauberer Halt:** die Seiten sehen aus wie heute, sind
aber geprüft, gleich benannt und schlanker.

### Stand 2026-09-19 — alle acht Stufen umgesetzt

Was beim Umsetzen **anders** kam als hier geplant, und warum:

- **Der Maßstab war falsch.** `react.cache` dedupliziert nur **innerhalb eines
  React-Requests**; `measure-budget-pages.ts` läuft ohne Request und zeigte die
  Zahlen nach REQ-5 deshalb _steigen_. Das Skript weist jetzt „roh" und
  „verschieden" aus, die echte Zahl kommt aus dem laufenden Server
  (`PRISMA_DEBUG=1`). Gemessen dort: Kandidaten, Positionen und Zusprüche je
  **einmal** statt vier-, vier- und zweimal auf der ART-Fläche.
- **REQ-5 nennt drei Tabellen, es sind fünf.** `value-stream-course.ts` las
  Kandidaten in einer vierten Form (fiel erst am laufenden Server auf), und
  `Solution` kam als fünfter geteilter Lader dazu, weil REQ-9 sie braucht. Offen
  bleibt `artEpicAllocation` — es wird auf der ART-Fläche fünfmal identisch
  gelesen, aber über **ungecachte** Wege, die auch in Schreibpfaden liegen; ein
  Cache dort wäre ein stiller Deckel-Fehler beim Geld.
- **Die Zeilenform kam aus der Business-Case-Frage**, nicht aus dieser Spec: die
  Skizze in §2.1 zeigte _ein_ Halbjahr je Zeile. Eine Übersicht mit einer
  Zeitspalte baut niemand — die Matrix bleibt, und die Gruppe klappt **in
  denselben Spalten** auf. Dadurch wurden aus zwei Tabellen eine (die Last steht
  jetzt in derselben Zelle wie das Geld), und `ValueStreamBudgetPlan` entfiel: er
  zeigte dieselben Zahlen wie die erste Zeile der Matrix.
- **Kein Client-State.** `ArtBudgetBreakdown` hatte nach REQ-13 keinen Hook mehr;
  die aufklappbare Zeile ist ein `<Link>` auf `?art=`, serverseitig gerendert.
- **REQ-15 ist nicht wörtlich umsetzbar.** „Dieselbe aufklappbare Zeile aus
  eingefrorenen Daten" gibt es nicht: Deckung, Zustandsstaffel und Verlauf lesen
  den **heutigen** Reifegrad der Epics. Der Ergebnis-Reiter sagt jetzt „Stand der
  Finalisierung", benutzt dieselben Wörter und verlinkt je ART auf die Fläche,
  die das Heute zeigt.
- **Die Pflichtspalte hat eine Nebenwirkung**, die keine Anforderung nannte: der
  Struktur-Baum hängte Solutions **ohne** ART an den Wertstrom. Mit der Pflicht
  wäre der Zweig nie mehr wahr — der Fall aber bleibt, bei einem **weich
  gelöschten** ART. Gefragt wird jetzt „ist ihr ART hier zu sehen", nicht „hat
  sie eins".
- **Gemessen nach dem Eingriff:** 25 von 25 aktiven Betriebspositionen lösen sich
  auf ein ART auf, null bleiben offen (vorher 24 / 1).
- **§2.3 ist zurückgenommen:** die ART-Liste bleibt nicht. Zwei Nav-Einträge für
  dasselbe Geld waren der Geruch, gegen den diese Spec geschrieben ist — die
  Ausnahme „der RTE mit zwei Strömen" trägt ihn nicht.

---

## 6 Bewusster Verzicht

- **Kein Umbuchen an der Fläche**, **keine Ist-Kosten**, **Bedarf ist
  abgeleitet, nie erfasst** — unverändert aus der Transparenz-Spec §8.
- **Der eingefrorene Budget-Plan bleibt aussen vor.** Er ist ein Beleg.
- **Die Kachel behält ihren Ablauf.** Angeglichen wird nur ihr Ergebnis-Reiter;
  die sieben Phasen bleiben, wie sie sind.
- **Kein Schlüssel je Position in dieser Stufe.** Gleichmässig verteilen ist
  grob, aber sichtbar; der Handschlüssel bekommt seine eigene Tabelle, wenn es
  klemmt.
- **Keine Ladezeit-Versprechen für die Listen.** Dort liegt die Zeit nicht in
  der Datenbank.

---

## 7 Verifikation

1. `pnpm test`, `npx tsc --noEmit`, `pnpm lint`, `pnpm build`.
2. **Zugriff:** ART-eingegrenzter Nutzer → sein ART mit Zahlen, die übrigen nur
   als Name, keine Summenzeilen. Ohne jedes Recht → kein Zugang.
3. **Einsprünge:** `/budgeting/arts/<id>?tab=verteilen` landet aufgeklappt im
   Verteilformular; Kette und Inbox ebenso.
4. **Vokabular:** Handprobe gegen §2.5 — kein Wort in zwei Bedeutungen.
5. **Rundreisen:** Zahl der Abfragen je **Detailseite** vorher/nachher aus dem
   Dev-Log, mit dem Hinweis, dass die Listen nicht profitieren.
6. **Leerer Zustand:** ein ART ohne Zuteilung klappt auf und sagt es.
7. **Gelöschte ARTs** erscheinen nirgends mehr.
8. **Bestandszahlen unverändert:** Budgetplan, Verlauf und Auslastung zeigen vor
   und nach dem Umbau dieselben Beträge — SQL-Gegenprobe auf
   `budget_candidates.final_amount` je Wertstrom und Halbjahr.
9. **Die Rechnung:** kein `run`-Betrag in `allocated` — Wächter-Test.

---

## 8 Referenzen

- [art-budget-transparency.md](art-budget-transparency.md) — Zustandsstaffel,
  Verlauf, €-Satz, die zwei Ampeln
- [art-budget-relocation.md](art-budget-relocation.md) — warum die Flächen hier
  liegen
- [art-epics.md](art-epics.md) — der ART-Epic und sein Rahmen
- [art-epic-budget-walkthrough.md](art-epic-budget-walkthrough.md) — der Ablauf
  aus drei Perspektiven
- ADR-0013 (Schichtung), ADR-0020 (Lebenszyklus beginnt in H2), ADR-0022
  (Solution ist Struktur)
