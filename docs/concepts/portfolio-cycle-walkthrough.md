# Ein gelebter Prozess — ein Halbjahr im Portfolio

Der wiederkehrende Takt, dreimal erzählt: aus Sicht des **Portfolio Managers**,
der die Runde organisiert, des **Wertstrom-Owners**, der den Bedarf meldet, und
des **Produkt-Managers**, der Status und Betriebskosten aktuell hält.

Die Schwesterdokumente beschreiben je **einen Mechanismus** — wie eine Kachel
läuft, wie ein Epic reift, wie ein ART an Geld kommt. Dieses hier beschreibt das
**Jahr**: was in welcher Reihenfolge passiert, wer wann angestoßen werden muss,
und welche Regel das Ganze zusammenhält.

Acht Dokumente beschreiben die Abläufe von Pulse und verweisen aufeinander:
[Aufbau](portfolio-setup-walkthrough.md) — woraus alles besteht ·
[Intake](epic-intake-walkthrough.md) — wie eine Idee hereinkommt ·
[Halbjahr](portfolio-cycle-walkthrough.md) — wie der Takt schlägt ·
[Epic](epic-lifecycle-walkthrough.md) — was gebaut wird ·
[Budget](budgeting-walkthrough.md) — womit ·
[ART-Budget](art-epic-budget-walkthrough.md) — womit, wenn es klein ist ·
[PI](pi-walkthrough.md) — wann geliefert wird ·
[Risiko](risk-walkthrough.md) — was dazwischenkommt. Den Rahmen führt
[Struktur](structure-walkthrough.md) vor.

## Die gemeinsame Mechanik

### Die Regel, die Kanban und Budget zusammenhält

Das Kanban managt die Epics; bei der Vergabe haben **laufende Epics Vorrang**.
Daraus folgen zwei Richtungen, und beide sind eine Aussage über den laufenden
Zyklus:

| Reifegrad-Schritt | Darf Budget tragen | Muss Budget haben | Kanban-Spalte    |
| ----------------- | :----------------: | :---------------: | ---------------- |
| L0                |         —          |         —         | Funnel/Hypothese |
| L1                |         —          |         —         | Hypothese        |
| L2                |         —          |         —         | Business Case    |
| **L3.1**          |       **ja**       |         —         | Investition      |
| **L3.2**          |       **ja**       |         —         | Investition      |
| **L4.1**          |       **ja**       |      **ja**       | Umsetzung        |
| **L4.2**          |       **ja**       |         —         | Umsetzung        |
| **L5**            |       **ja**       |         —         | Impact           |

- **Wer Geld trägt, steht mindestens auf L3.1.** Vorher gibt es nichts zu
  finanzieren: im Funnel ist es eine Idee, in der Hypothese eine Vermutung, in
  der Analyse-Einplanung eine Absicht, im Business Case eine Rechnung, die noch
  niemand freigegeben hat. Erst die Freigabe des Lean Business Case macht aus dem
  Vorhaben eine Investitionsentscheidung.
- **Wer in Umsetzung ist, hat Geld.** Ein Epic auf L4.1, das im laufenden Zyklus
  nichts bekommen hat, ist eine Lücke — entweder in der Vergabe oder in den
  Daten.

Daraus liest sich der Bestand einer Kachel:

- Am **Anfang** des Zeitraums stehen manche Epics noch auf **L3.1**: die
  Zuteilung ist da, der Schritt auf L3.2 ist ein eigener Akt und noch nicht
  vollzogen.
- **L3.2** heißt: Geld zugeteilt, aber noch nicht begonnen.
- **L4.1** ist die Umsetzung — der einzige Schritt, der Geld **verlangt**.
- **L4.2** ist im Zeitraum fertig gemeldet worden.
- **L5** kommt vor, ist aber selten: dass der Nutzen im selben Halbjahr schon
  bestätigt ist, passiert nicht oft.

> **Wo die Regel greift — und wo nicht.** Die erste Richtung ist **durchgesetzt**:
> auf die PB-Liste kommt nur, was einen freigegebenen Lean Business Case hat
> (`isPbEligible`), und der Dienst weist alles andere ab. Die zweite Richtung
> — „wer umsetzt, hat Geld" — wird **nur beim Erzeugen von Testdaten geprüft**
> (`allocationRuleViolations` in den Seeds). In der laufenden Anwendung gibt es
> keinen Wächter dafür; sie zu halten ist Sache des Portfolio Managers.

### Welche Kachel heute gilt

Der Status einer Runde (`draft → running → decided → closed`) beschreibt ihre
**Vorbereitung**, nicht ihre Geltung. Die Geltung wird abgeleitet:

| Geltung                          | Wann                                                           |
| -------------------------------- | -------------------------------------------------------------- |
| **In Ausarbeitung**              | nicht abgeschlossen, oder der Zeitraum hat noch nicht begonnen |
| **Angewandtes Budget**           | abgeschlossen **und** der heutige Tag liegt im Zeitraum        |
| **Abgelaufener Budget-Zeitraum** | abgeschlossen, Zeitraum vorbei                                 |

Fällt der heutige Tag in **keine** Kachel, gilt die zuletzt abgelaufene weiter —
zwischen zwei Kacheln klaffen gemessen 3–10 Tage, und ohne diese Regel
verschwänden mehrmals im Jahr für ein paar Tage sämtliche Zahlen.

Eine Kachel deckt ein **Halbjahr** ab. Ihr `cycleKey` ist **kein Eingabefeld** —
er wird aus dem Startdatum abgeleitet, und **zwei Kacheln dürfen nicht im selben
Halbjahr beginnen**.

### Wer die drei sind

| Wer                   | Sein Beitrag zum Takt                                      |
| --------------------- | ---------------------------------------------------------- |
| **Portfolio Manager** | setzt den Rahmen, kuratiert die Wahl, führt den Termin     |
| **Wertstrom-Owner**   | sammelt den Bedarf seiner Solutions und trägt ihn ein      |
| **Produkt-Manager**   | meldet seine Run-Kosten, pflegt den Status seiner Solution |

---

# 1 · Der Portfolio Manager

Meine Frage lautet: **wie bringe ich eine Runde zustande, die etwas taugt?**

## Die Kachel aufsetzen

Ich bin dafür verantwortlich, dass der Budget-Prozess sauber durchgeführt wird.
Unter `/budgeting/periods` lege ich über **„Neue Kachel"** — das „+" ist ein
Icon, nicht Teil des Labels — den neuen Zeitraum an.

Der Dialog **„Neuen Budgeting-Zeitraum anlegen"** fragt:

| Feld                                           | Anmerkung                                                                  |
| ---------------------------------------------- | -------------------------------------------------------------------------- |
| **Geltungszeitraum des Budgets \***            | „Von wann bis wann dieses Budget gilt — nicht die Dauer der Vorbereitung." |
| **Topf (€)**                                   |                                                                            |
| **Abgabe-Deadline (optional, Default = Ende)** | siehe unten                                                                |
| ☑ **Reserve übernehmen**                       | die Reserve der letzten abgeschlossenen Kachel                             |
| ☑ **Vom vorherigen Zeitraum übernehmen**       | Beteiligte, Gruppen samt Sprechern und die PB-Liste                        |

Den Zeitraum habe ich vorher mit dem Finance Department abgestimmt. Beide
Übernahmen sind vorausgewählt — wer zum zweiten Mal budgetiert, ist damit fast
fertig; der Rest des Setups ist Korrektur, nicht Aufbau.

> **Es gibt nur eine Deadline, und sie meint etwas anderes als erwartet.** Die
> **Abgabe-Deadline** ist die Frist, bis zu der die **Gruppen ihre Verteilung
> einreichen** — nicht die Frist für Bedarfsmeldungen aus den Wertströmen. Ein
> Feld für Letztere gibt es nicht; diese Frist muss ich außerhalb von Pulse
> setzen und selbst nachhalten.

## Dann beginnt die eigentliche Arbeit

Die Kachel ist in zwei Minuten angelegt. Was Wochen dauert, steht daneben:

- **Epics müssen vorbereitet werden.** Nur wer einen freigegebenen Lean Business
  Case hat, kann überhaupt zur Wahl stehen. Wer bis zur Frist nicht durch L3.1
  ist, ist in dieser Runde nicht dabei.
- **Wertströme, ARTs und Solutions müssen ihren Bedarf definieren und
  einreichen.** Das ist Teil 2 dieses Dokuments.
- **Bis zur Frist kommen Kollegen mit Rückfragen auf mich zu.** Das ist kein
  Störfall, sondern der Grund, warum die Frist vor dem Termin liegt.

## Die PB-Liste kuratieren

Im Reiter **Setup**, Schritt 2, steht die **PB-Liste**: „Was zur Abstimmung
steht: vorgemerkte Epics plus die aktiven Run-the-Business-Positionen, die beim
Start dazukommen."

Neue Epics nehme ich über das Formular **„Epic aufnehmen"** auf — Auswahl
„Budgeting-reifes Epic wählen…", Schaltfläche **„+ auf die PB-Liste"**.
Angeboten wird mir nur, was **beides** erfüllt: den Merker _Fürs nächste
Budget-Meeting vormerken_ und einen freigegebenen Business Case. Der Merker ist
die Anmeldung durch den Epic Owner, die Aufnahme meine Entscheidung.

Zwei Dinge stehen dort, die ich **nicht** ändern kann:

- Die **Run-the-Business-Positionen** kommen beim Start automatisch dazu. Ihre
  Summe zählt trotzdem schon gegen den Topf — sonst täuschte mich die Zahl unten.
- **ART-Epics stehen gar nicht erst zur Wahl.** Liegen die Kosten unter dem
  Portfolio-Limit des Wertstroms, bedient der ART das Epic aus seinem
  Veränderungsrahmen. Die Fläche sagt an, wie viele das sind: „{n} vorgemerkte
  Epics stehen nicht zur Wahl: sie liegen unter dem Portfolio-Limit und werden
  vom jeweiligen ART aus dessen Rahmen finanziert."

## Die Gruppen bilden

Schritt 3: **Beteiligte & Gruppen**. Ich trage die Personen ein („+ Beteiligte")
und schneide sie in Gruppen („Gruppe hinzufügen"). Jeder Gruppe weise ich eine
Person zu, die für das Einreichen verantwortlich ist.

> Diese Person heißt in Pulse **Sprecher**, nicht „Gruppenleiter". Nur sie — oder
> ein ausdrücklich als Einreicher markiertes Mitglied — kann die Verteilung der
> Gruppe abgeben; **speichern** darf jedes Mitglied.

Pulse prüft den Schnitt und warnt: weniger als drei Gruppen, Gruppen unter vier
oder über sechs Personen, eine Gruppe ohne Sprecher. **Warnungen, keine
Sperren.**

## Den Termin vorbereiten

Das Meiste daran steht nicht im Werkzeug. Zwei Dinge aber gehören dazu:

- **Die Epic Owner müssen wissen, dass sie ihr Epic pitchen.** Die anderen
  Beteiligten sollen eine Vorstellung davon bekommen, was gemacht werden soll und
  was dabei herauskommt. Pulse hat dafür keine Fläche — es ist eine Absprache.
- **Für Gruppen, die auf Papier arbeiten,** gibt es die **Verteilbögen**: einen
  Bogen je Gruppe, mit denselben Abschnitten wie am Bildschirm, unter
  `…/periods/[id]/sheet`.

## Die Runde starten

Am Tag des Termins drücke ich **„Runde starten"**. Das friert die PB-Liste ein,
nimmt die aktiven Run-the-Business-Positionen dazu und schaltet die
Gruppen-Verteilung frei; die Kachel geht auf **läuft**.

Der Knopf sagt an, wenn er noch nicht darf: „Die PB-Liste ist leer — ohne
Kandidaten gibt es nichts zu verteilen." bzw. „Erst möglich, wenn mindestens eine
Gruppe ein Mitglied hat."

Ab hier übernimmt [Budget](budgeting-walkthrough.md): verteilen, schließen,
finalisieren, festschreiben.

---

# 2 · Der Wertstrom-Owner

Meine Frage lautet: **was braucht mein Wertstrom, und wo trage ich es ein?**

## Den Bedarf einsammeln

Der Portfolio Manager hat gesagt, dass das Budgeting vorbereitet werden muss.
Das ist mein Stichwort. Ich gehe auf meine Solutions zu und frage zwei Dinge ab:

1. **Was braucht es, um die Solution am Laufen zu halten?**
2. **Was ist für ihre Weiterentwicklung eingeplant?**

Beides dokumentiere ich selbst — die Solutions liefern die Zahlen, eingetragen
wird es an einer Stelle.

## Wo es eingetragen wird

Unter **Budget → Wertströme → mein Wertstrom** liegen zwei Reiter, und man
erwischt leicht den falschen:

| Reiter               | Wofür                                                   |
| -------------------- | ------------------------------------------------------- |
| **Budget**           | **lesend** — der Budgetplan, der Verlauf, die ART-Sicht |
| **Run the Business** | **hier wird gepflegt**, was beantragt werden soll       |

Im Reiter _Run the Business_ nehme ich über **„+ Position hinzufügen"** die
Positionen auf. Je Zeile: **Position · Periode · Betrag · p. a.** Die Periode ist
monatlich, halbjährlich oder jährlich; Pulse rechnet daraus beides aus — was es
im Jahr kostet und was davon in eine Kachel geht.

**Die Unterteilung ist der Punkt:**

| Art                 | Was hineingehört                                                  |
| ------------------- | ----------------------------------------------------------------- |
| **Betrieb**         | Lizenzen, Wartung — alles, was den Bestand hält                   |
| **ART-Epic-Budget** | der Rahmen für die Weiterentwicklung, den der ART später verteilt |

Sie zu vermischen wäre kein Formfehler: **dann würde Veränderungsarbeit aus dem
Betriebstopf bezahlt**, und vier Flächen sagten die Unwahrheit — die
Grow-/Run-Kacheln der Solution, der Run-Anteil am Wertstrom, die Gliederung der
PB-Liste und Guardrail 2.

Beide Arten gehen denselben Weg über die PB-Liste: **der Wertstrom entscheidet in
der Kachel, wie groß der Rahmen ist, der ART danach, wofür.**

## Die Portfolio-Epics auf den Weg bringen

Was mir jetzt noch fehlt: die Epics meines Wertstroms, die in dieser Runde Geld
brauchen. Sie kommen nicht von selbst auf die Liste. In den nächsten Terminen
stelle ich sicher, dass die Epics, die reif sind, den Merker **„Fürs nächste
Budget-Meeting vormerken"** gesetzt haben — **ohne ihn erscheinen sie in der
Kandidatenliste des Portfolio Managers gar nicht.**

Damit bin ich für diese Runde fertig.

> **Ohne abgeschlossene Kachel ist der Rahmen null.** Was ich hier eintrage, ist
> die **Anfrage**, nicht das Geld. Der Veränderungsrahmen eines ARTs trägt erst
> dann etwas, wenn eine Kachel für dieses Halbjahr geschlossen und
> festgeschrieben ist.

---

# 3 · Der Produkt-Manager

Meine Frage lautet: **steht mein Produkt noch da, wo es im System steht?**

## Der Portfolio Review

Ich bin regelmäßig im Portfolio Review. Dort wird unter anderem über die
Solutions gesprochen — und dazu gehört die Frage, ob sich die **Einordnung**
verschoben hat.

Der Horizont sagt, in welcher Lebenszyklus-Phase eine Solution steht. Hat sie
sich bewegt, setze ich das über die **Lebenszyklus-Leiste** im Unterkopf ihrer
Detailseite nach. Der Weg dorthin und die Kriterien für die eine Kante mit Tor
(`Emerging → Investing`) stehen im [Aufbau](portfolio-setup-walkthrough.md).

**Warum das im Takt zählt und nicht nebenbei:** der Horizont einer Solution
speist die Guardrail „Investment by Horizon". Wird er nicht gepflegt, misst die
Guardrail eine Verteilung, die es nicht mehr gibt — und die nächste Budget-Runde
entscheidet gegen ein falsches Bild.

> Wandert eine Solution, wandern **nicht** ihre bereits freigegebenen Epics mit:
> deren Horizont ist mit der Business-Case-Freigabe eingefroren. Das ist Absicht
> — sonst schriebe ein einziger Solution-Wechsel die gemessene Balance der
> Vergangenheit um. Mehr dazu in [Intake](epic-intake-walkthrough.md).

## Die Run-Baseline aktuell halten

Vor jeder Runde melde ich meinem Wertstrom-Owner, was der Betrieb im kommenden
Halbjahr kostet, und was ich für die Weiterentwicklung einplane. In den Kacheln
meiner Solution sehe ich beides gegeneinander: **Grow · aktive Primär-Epics**,
**Run · Betrieb p.a.** und das Verhältnis **Grow : Run**.

---

## Die Nähte

**Zum Aufbau.** Die Guardrails und die Besetzung stehen vor dem ersten Takt.
Ändert sich im Jahr etwas daran — ein neuer Wertstrom, ein anderes
Portfolio-Limit —, wirkt es ab der nächsten Runde.

**Zum Intake.** Der Merker am Epic ist das Bindeglied: er ist die Anmeldung des
Epic Owners und die Voraussetzung dafür, dass der Portfolio Manager das Epic
überhaupt angeboten bekommt.

**Zum Budget.** Dieses Dokument endet beim Druck auf „Runde starten". Alles
danach — verteilen, Median, festschreiben — steht in
[Budget](budgeting-walkthrough.md).

**Zum ART-Budget.** Der Veränderungsrahmen entsteht hier als
Run-the-Business-Position und wird über die PB-Liste festgeschrieben; verteilt
wird er im Budget-Reiter des ARTs — [ART-Budget](art-epic-budget-walkthrough.md).

## Sätze, die naheliegen und nicht stimmen

| Satz                                                           | Warum er nicht stimmt                                                                            |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| „Die Deadline ist die Frist für die Bedarfsmeldungen."         | Die **Abgabe-Deadline** ist die Frist für die Gruppen-Verteilung. Für Bedarfe gibt es kein Feld. |
| „Ein Epic im Business Case kann Budget bekommen."              | Budget gibt es erst ab **L3.1** — mit freigegebenem Lean Business Case.                          |
| „Pulse warnt, wenn ein laufendes Epic kein Geld hat."          | Diese Richtung wird nur beim Erzeugen von Testdaten geprüft, nicht in der Anwendung.             |
| „Der Gruppenleiter reicht ein."                                | Er heißt **Sprecher**. Speichern darf jedes Mitglied, einreichen nur er.                         |
| „Den Zyklus-Schlüssel gebe ich ein."                           | Er wird aus dem Startdatum abgeleitet. Zwei Kacheln dürfen nicht im selben Halbjahr beginnen.    |
| „Die laufende Kachel ist die mit Status ‚läuft'."              | Geltung ist abgeleitet: **abgeschlossen** und der heutige Tag im Zeitraum.                       |
| „Betriebskosten und Weiterentwicklung trage ich zusammen ein." | Zwei Arten: **Betrieb** und **ART-Epic-Budget**. Vermischt zahlt der Betrieb die Veränderung.    |
| „Der Rahmen im RtB-Reiter ist das Geld des ARTs."              | Er ist die **Anfrage**. Ohne abgeschlossene Kachel für das Halbjahr ist der Topf null.           |
| „ART-Epics stehen auch auf der PB-Liste."                      | Sie werden ausdrücklich ausgenommen — der ART finanziert sie aus seinem Rahmen.                  |

## Wer welchen Schritt macht

| Schritt                                            | Wer                                                        | Recht                            |
| -------------------------------------------------- | ---------------------------------------------------------- | -------------------------------- |
| Kachel anlegen, Rahmen, PB-Liste, Gruppen, Starten | Portfolio Manager / Admin                                  | `budget.round.manage`            |
| Run-the-Business-Positionen pflegen                | Wertstrom-Owner, Finance-Partei, Portfolio Manager / Admin | `rtb_item.manage` (+ Seam)       |
| Den Budget-Merker am Epic setzen                   | wer das Epic bearbeiten darf                               | `epic.update`                    |
| Beträge einer Gruppe setzen                        | jedes Mitglied der Gruppe                                  | Mitgliedschaft                   |
| Verteilung einreichen                              | Sprecher oder markierter Einreicher                        | Mitgliedschaft + Markierung      |
| Solution-Status im Review nachsetzen               | Portfolio Manager / Admin; der benannte Produkt-Manager    | `solution.manage` bzw. Benennung |
| Schließen, festschreiben, fortsetzen               | Finance / Portfolio Manager / Admin                        | `budget.manage`                  |

## Nachschlagepunkte im Code

| Aussage                                               | Quelle                                                                      |
| ----------------------------------------------------- | --------------------------------------------------------------------------- |
| Die Regel Kanban ↔ Budget, beide Richtungen           | `src/modules/budgeting/domain/allocation-eligibility.ts`                    |
| Ihre Prüfung beim Erzeugen von Testdaten              | `prisma/seed-demo.ts`, `prisma/seed-large.ts`                               |
| Eintritt auf die PB-Liste (nur mit freigegebenem LBC) | `src/modules/work/domain/pb-submission.ts` (`isPbEligible`)                 |
| Der Loader der Kandidatenliste (Merker + LBC)         | `src/modules/budgeting/server/services/pb-list.ts`                          |
| Der Merker am Epic                                    | `src/modules/work/features/portfolio/components/epic-governance-flags.tsx`  |
| Welche Kachel heute gilt                              | `src/modules/budgeting/domain/period-validity.ts`                           |
| Die sieben Phasen und ihre Bedingungen                | `src/modules/budgeting/domain/period-phases.ts`                             |
| Kachel anlegen, Übernahmen, Starten                   | `src/modules/budgeting/features/components/period/create-period-dialog.tsx` |
| Der Setup-Reiter mit PB-Liste, Gruppen, Start         | `src/modules/budgeting/features/components/period/period-setup-tab.tsx`     |
| Gruppen-Schnitt-Warnungen                             | `src/modules/budgeting/domain/group-cut.ts`                                 |
| Abgabe-Deadline beim Einreichen                       | `src/modules/budgeting/server/services/group-distribution-service.ts`       |
| ART-Epics von der PB-Liste ausnehmen                  | `src/modules/budgeting/server/views/period-detail.ts`                       |
| Zwei Arten einer Run-Position                         | `src/modules/budgeting/domain/rtb-kind.ts`                                  |
| Periode einer Position, Jahres- und Kachel-Betrag     | `src/modules/budgeting/domain/rtb-interval.ts`                              |
| Solution-Status und seine Übergänge                   | `src/modules/work/domain/solution.ts`                                       |
| Der eingefrorene Epic-Horizont                        | `src/modules/work/domain/epic-horizon.ts`                                   |
| Was welche Rolle darf                                 | `src/server/auth/policies/index.ts`                                         |
