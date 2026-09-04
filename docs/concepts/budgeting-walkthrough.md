# Ein gelebter Prozess — ein Budget-Zeitraum aus drei Perspektiven

Derselbe Durchlauf, dreimal erzählt: aus Sicht des **Portfolio Managers**, der
den Zeitraum aufsetzt und startet, des **Gruppenmitglieds**, das verteilt, und
der **Finance**, die schließt, festschreibt und einfriert. Mit den Namen, die
Pulse tatsächlich verwendet: Kachel, PB-Liste, Verteilung, Ergebnis.

Das Schwesterdokument für das Epic ist
[epic-lifecycle-walkthrough.md](epic-lifecycle-walkthrough.md). Beide treffen
sich an einer Stelle — siehe [Die Naht zum Epic](#die-naht-zum-epic).

Fünf Dokumente beschreiben die Abläufe von Pulse und verweisen aufeinander:
[Epic](epic-lifecycle-walkthrough.md) — was gebaut wird ·
[Budget](budgeting-walkthrough.md) — womit ·
[ART-Budget](art-epic-budget-walkthrough.md) — womit, wenn es klein ist ·
[PI](pi-walkthrough.md) — wann geliefert wird ·
[Risiko](risk-walkthrough.md) — was dazwischenkommt. Den Rahmen, in dem sie
stattfinden, führt [Struktur](structure-walkthrough.md) vor.

## Die gemeinsame Mechanik

Ein Budget-Zeitraum ist eine **Kachel**. Sie durchläuft sieben Phasen —
`Rahmen · PB-Liste · Beteiligte & Gruppen · Runde starten · Verteilen ·
Finalisieren · Protokoll` — über vier Status:
`Entwurf → läuft → entschieden → abgeschlossen`.

Die Phasen sind nirgends gespeichert. Sie werden aus dem Zustand der Kachel
abgeleitet und stehen als Leiste über den drei Reitern _Setup_, _Verteilung_ und
_Ergebnis_. Was gesperrt ist, sagt warum.

Mehrere Kacheln existieren nebeneinander — eine laufende, eine geplante, mehrere
abgeschlossene. Es gibt keinen tenant-weiten „aktiven Zyklus": aktiv ist die
Kachel, die läuft.

Drei Übergänge tragen eine inhaltliche Aussage:

- **Runde starten** friert die PB-Liste ein und nimmt die aktiven
  Run-the-Business-Positionen als Kandidaten dazu. Ab hier ist die Auswahl fix.
- **Verteilung schließen** beendet die Selbst-Verteilung der Gruppen.
- **Verteilung festschreiben** setzt je Kandidat den Endbetrag, schreibt die
  Budget-Zuteilung der finanzierten Epics fort, rechnet die Reserve und friert
  den Stand als Budget-Plan-Revision ein.

Die Regeln, die man kennen sollte, um nicht überrascht zu werden:

- **Was auf die PB-Liste darf.** Ein Epic braucht eine freigegebene Benefit-
  Hypothese **oder** einen freigegebenen Lean Business Case. Der Richtwert kommt
  aus dem Business Case (Σ der Kostenscheiben); liegt nur die Hypothese vor,
  gilt der tenant-weite Default-Aufwand. **Ausgenommen sind ART-Epics** — sie
  werden aus dem ART-Epic-Budget ihres ARTs bedient und stehen deshalb gar
  nicht zur Wahl (siehe [Die Naht zum Epic](#die-naht-zum-epic)).
- **Run the Business wird mitbudgetiert**, nicht vorweg abgezogen. Der Richtwert
  einer Position ist ihr Anteil an _dieser_ Kachel — die Position trägt ihre
  eigene Periode (monatlich, je Halbjahr, jährlich), eine Kachel deckt ein
  Halbjahr ab.
- **Der ART-Epic-Budget eines ARTs ist so eine Position** — geführt als
  eigene Art (`art_change`), damit Wachstums-Geld nicht als Betrieb ausgewiesen
  wird. Er geht denselben Weg über die PB-Liste; was am Ende festgeschrieben ist,
  ist der Topf, den der ART auf seine ART-Epics verteilen darf. Ohne
  **geschlossene** Kachel für dieses Halbjahr ist der Topf null, auch wenn der
  Rahmen gepflegt ist.
- **Das Verteil-Fenster** ist offen, solange die Runde läuft, die Gruppe noch
  nicht eingereicht hat und die Abgabe-Deadline nicht verstrichen ist. Fällt
  eines davon weg, ist Schluss — auch mitten in der Arbeit.
- **Der Median** der abgegebenen Gruppen ist die Vorbelegung der Endbeträge,
  nicht das Ergebnis. Finance setzt sie.
- **Die Reserve** ist der verteilbare Topf minus der Summe der Endbeträge. Sie
  lässt sich beim Anlegen der nächsten Kachel auf deren Topf addieren.
- **Zurücknehmen geht.** Eine abgeschlossene Kachel geht zurück auf
  „entschieden"; die Endbeträge bleiben als Vorbelegung stehen.

Eine Einschränkung, die man kennen muss: der Dienst hinter „Runde starten"
prüft nur, dass die Kachel im Entwurf ist. Dass ein PB-Liste und eine besetzte
Gruppe vorliegen müssen, erzwingt die Oberfläche — über die Schnittstelle ließe
sich eine Runde ohne Gruppen starten.

### Wer die drei sind

|                                | Woher die Reichweite kommt                                                                                                                                                                                                |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Portfolio Manager**          | `budget.round.manage` — Kachel anlegen, Rahmen setzen, PB-Liste kuratieren, Gruppen bilden, starten. Dieselbe Rolle trägt auch `budget.manage`.                                                                           |
| **Gruppenmitglied / Sprecher** | `budget.group.contribute` ist nur ein grober Vorfilter über **alle** Rollen. Maßgeblich ist die Mitgliedschaft in der Gruppe; einreichen darf allein der Sprecher (oder ein als Einreicher markiertes Mitglied).          |
| **Finance**                    | `budget.manage` für das Festschreiben, `budget_plan.revision.capture` für den Budget-Plan. Für Run the Business `rtb_item.manage` je Wertstrom — plus ein Seam, der die Finance-Partei des Wertstroms ohne Rolle zulässt. |

---

# 1 · Der Portfolio Manager

Meine Frage lautet: **wie bringe ich eine Runde zustande?**

Ich stehe in der Gallery der Budgeting-Zeiträume. Oben vier Zahlen zur laufenden
Kachel — Zeitraum, Topf, Abgaben, letzter eingefrorener Stand —, darunter die
Kacheln als Karten. Jede zeigt ihre Phase, nicht nur ihren Status: „läuft" sagt
mir nicht, ob gerade verteilt oder schon finalisiert wird.

Ich lege eine neue Kachel an. Der Dialog fragt nach Topf, Zeitraum und
Abgabe-Deadline und bietet mir zwei Übernahmen an: die **Reserve** der letzten
abgeschlossenen Kachel vor meinem Start-Termin — sie wird auf den Topf addiert —
und die Übernahme **vom vorherigen Zeitraum**: Beteiligte, Gruppen samt
Sprechern und die PB-Liste. Beides ist vorausgewählt; wer zum zweiten Mal
budgetiert, ist damit fast fertig.

Die Kachel steht auf **Entwurf**. Im Reiter _Setup_ arbeite ich eine Liste ab.

**1 · Rahmen.** Topf und Deadline stehen schon aus dem Dialog; hier korrigiere
ich sie, solange die Runde nicht läuft.

**2 · PB-Liste.** Was zur Wahl steht. Ich wähle Epics aus dem budgeting-reifen
Pool — das sind die, deren Hypothese oder Business Case freigegeben ist. Zu
jedem zeigt Pulse den Richtwert, den es aus dem Artefakt ableitet. Die
Run-the-Business-Positionen stehen als eigener, eingeklappter Abschnitt darüber:
ich kann sie hier nicht ändern, sie kommen beim Start automatisch dazu, und ihre
Summe zählt trotzdem gegen den Topf — sonst täuschte mich die Zahl unten. Wer
sie ändern will, geht in die Wertstrom-Pflege.

Unter der Tabelle steht der Satz, auf den es ankommt: Σ Anfragen gegen den Topf.
In aller Regel liegt die Summe deutlich darüber. Das ist kein Fehler, das ist
der Grund für den ganzen Vorgang.

**3 · Beteiligte & Gruppen.** Ich trage die Personen ein und schneide sie in
Gruppen. Der Wert des Verfahrens hängt an diesem Schnitt, deshalb prüft Pulse
ihn und warnt: weniger als drei Gruppen (dann ist die Streuung nicht
auswertbar), Gruppen unter vier oder über sechs Personen, eine Gruppe ohne
benannten Sprecher, ungleich verteilte Einreicher. Warnungen, keine Sperren —
ich entscheide.

**4 · Runde starten.** Der Knopf steht am Ende der Liste und sagt mir, wenn er
noch nicht darf: ohne Kandidaten auf der PB-Liste und ohne eine besetzte Gruppe
gibt es nichts zu verteilen. Drücke ich ihn, friert die PB-Liste ein, die
Run-Positionen kommen dazu, die Kachel geht auf **läuft** — und die Gruppen
bekommen ihren Hinweis.

Danach ist meine Arbeit Beobachten. Im Reiter _Verteilung_ sehe ich, wer
abgegeben hat und wer nicht, und wie viel jede Gruppe verteilt hat. Wenn eine
Gruppe lieber auf Papier arbeitet, drucke ich ihr die Verteilbögen — einen je
Gruppe, mit denselben Abschnitten.

---

# 2 · Das Gruppenmitglied

Meine Frage lautet: **worüber soll ich entscheiden?**

Ich sehe den Hinweis in _My Tasks_: meine Gruppe, der Zeitraum, die Deadline.
Der Hinweis verschwindet, sobald meine Gruppe eingereicht hat. Ein Klick bringt
mich auf das Arbeitsblatt meiner Gruppe.

Oben drei Zahlen: **Verteilbar · Verteilt · Rest**, darunter ein Balken. Der
Rest wird rot, sobald ich zu viel verteilt habe. Dann die Kandidaten — nicht als
lange Liste, sondern als Abschnitte. **Run the Business** steht vorn: der
laufende Betrieb, den es weiter geben muss. Danach ein Abschnitt je Wertstrom,
der größte zuerst, mit eigener Summe und einem Balken, der zeigt, wie weit ich
in diesem Wertstrom gekommen bin. Wo ein Produkt mehrere Positionen trägt, steht
es als Zwischenzeile darüber.

Zwei Spalten: **Anfrage** — was der Kandidat kostet — und **Mein Betrag**, mein
Feld. Nichts ist vorbelegt: jede Zuteilung ist eine Entscheidung, nichts fließt
aus Versehen. Zu Epics kann ich die Budget-Info aufklappen; je nachdem, was
freigegeben ist, speist sie sich aus dem Business Case oder aus der
Benefit-Hypothese.

Sortiert wird nach der Anfrage, nicht nach meiner Eingabe. Das ist Absicht: ich
tippe, und nichts unter meinen Händen springt.

Übersteige ich den verteilbaren Topf, sagt Pulse es mir und lässt mich trotzdem
speichern — **einreichen** aber nicht. Speichern kann jedes Mitglied, einreichen
nur der Sprecher. Danach ist unser Vorschlag fest; das Fenster ist zu.

Genauso zu ist es, wenn die Deadline verstreicht, bevor wir eingereicht haben.
Was wir bis dahin gespeichert haben, zählt: Finance sieht unsere Zahlen in der
Übersicht, aber der Median rechnet nur mit den Gruppen, die tatsächlich
abgegeben haben.

---

# 3 · Finance

Meine Frage lautet: **wo geht das Geld hin?**

Bevor eine Runde beginnt, gehört mir der Betrieb. Im Wertstrom pflege ich die
**Run-the-Business-Positionen**: Name, Betrag und die Periode, für die der
Betrag gilt — monatlich, je Halbjahr oder jährlich. Jede Position kann ich einer
Solution zurechnen; was wertstrom-übergreifend ist (Programm-Office, geteilte
Lizenzen), lasse ich ohne. Die Kopfzeile nennt beide Summen: was das im Jahr
kostet, und was davon in eine Budget-Kachel geht. Aktive Positionen kommen beim
Start jeder Runde automatisch auf die PB-Liste.

Läuft die Runde, schaue ich im Reiter _Verteilung_ zu. Wenn alle abgegeben haben
— oder die Deadline verstrichen ist — **schließe ich die Verteilung**. Die
Kachel geht auf „entschieden", die Gruppen können nichts mehr ändern.

Jetzt der Reiter _Ergebnis_. Dieselben Abschnitte wie beim Verteilen, aber
andere Spalten: **Anfrage · Median · Final**. Der Median ist vorbelegt; ich setze
die Zahlen. Die Zwischensummen je Wertstrom sagen mir, wohin das Geld läuft,
während ich es tue, und oben steht die Zeile \*Verteilbar · Festgeschrieben ·
**Reserve\***. Wird die Reserve negativ, komme ich nicht weiter: die Summe der
finalen Beträge darf den verteilbaren Topf nicht überschreiten.

**Verteilung festschreiben** schließt die Kachel. Damit passiert vieles auf
einmal, und es lohnt zu wissen, was:

- Jeder Kandidat bekommt seinen Endbetrag.
- Jedes finanzierte Epic bekommt seine Budget-Zuteilung für dieses Halbjahr.
- Die Reserve wird gerechnet und festgehalten.
- Der Stand wird als **Budget-Plan-Revision** eingefroren — ohne mein Zutun,
  mit dem Zyklus dieser Kachel.

Darunter stehen die abgeleiteten Budgets: je Wertstrom, aufgeteilt in Run the
Business und die Epics nach ART. Diese Zahlen pflegt niemand — sie sind die
Verteilung, anders gruppiert. Dieselben Zahlen finde ich auf der
Wertstrom-Detailseite wieder.

Habe ich mich vertan, nehme ich die Finalisierung zurück: die Kachel geht auf
„entschieden", die Beträge bleiben als Vorbelegung stehen, und der eingefrorene
Stand bleibt als Beleg dessen, was damals galt. Die nächste Finalisierung
überschreibt ihn.

Zuletzt **starte ich den nächsten Zeitraum**. Beteiligte, Gruppen und die
Reserve wandern mit.

---

## Die Naht zum Epic

Der Reifegrad-Schritt **L3.1 → L3.2** eines Epics — die Investitionsentscheidung
— hat genau eine blockierende Bedingung: _Budget ist alloziert (Σ > 0)_.

**Diese Summe entsteht auf zwei Wegen.** Bis Guardrail 3 gab es nur einen: die
Kachel. Seit die Größe eines Vorhabens darüber entscheidet, wer es verantwortet,
sind es zwei — und welcher gilt, hängt allein an den Kosten des freigegebenen
Business Case gegen das **Portfolio-Limit** des Wertstroms:

|                  | Portfolio-Epic                             | ART-Epic                                                                                                           |
| ---------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| Kosten           | **über** dem Limit                         | **unter** dem Limit                                                                                                |
| Wer entscheidet  | das Portfolio, in einer Budget-Kachel      | der Wertstrom, über den **ART-Epic-Budget** des ARTs                                                               |
| Der Weg          | PB-Liste der Kachel → Finalisierung        | Zuteilung aus dem Rahmen, im Budget-Reiter des ARTs                                                                |
| Wer zuteilt      | die Runde, dann Finance beim Festschreiben | Wertstrom-Owner, Finance-Partei, Portfolio-Management — dazu der **Produkt-Manager** der Solution, für seine Epics |
| Auf der PB-Liste | ja                                         | **nein** — ausdrücklich ausgeschlossen                                                                             |

Beide schreiben am Ende in **dieselbe** `BudgetAllocation`. Für das Epic ändert
sich die Bedingung also nicht: Σ > 0 bleibt Σ > 0. Nur der Weg dorthin ist
zweigeteilt, und mit ihm die Frage, wen man fragen muss.

**Für die PB-Liste heißt das:** ein Epic mit freigegebenem Business Case ist
ballot-fähig, **solange es kein ART-Epic ist**. Ist es eines, taucht es in der
Kandidatenliste der Kachel gar nicht erst auf — nicht abgelehnt, sondern
woanders zuhause. Es wird stattdessen im Budget-Reiter seines ARTs aus dessen
ART-Epic-Budget bedient.

Wie der zweite Weg im Einzelnen abläuft — wer fragt, wer zuteilt, wer abnimmt —
erzählt [art-epic-budget-walkthrough.md](art-epic-budget-walkthrough.md).

Ein Epic **ohne** freigegebenen Business Case hat noch gar keine Klasse — vor
L3.1 ist nicht entschieden, wie groß es ist. Es bleibt deshalb auf der PB-Liste:
genau dieses Geld braucht es, um den Business Case überhaupt zu schreiben.

Wird ein Portfolio-Epic in der Runde nicht finanziert, bleibt es auf L3.1 stehen
— nicht abgelehnt, sondern unbezahlt, und beim nächsten Zeitraum wieder dabei.
Ein ART-Epic, für dessen ART kein Rahmen angelegt ist, hat dagegen **keinen**
Weg: es steht nicht auf der PB-Liste und hat keinen Topf. Pulse weist das an der
Epic-Seite aus, statt es zu verschweigen.

Die Gegenrichtung gilt auch: Wer auf die PB-Liste will, braucht mindestens eine
freigegebene Benefit-Hypothese. Die Budget-Runde entscheidet über Geld, nicht
über Reife.

---

## Die Phasen im Einzelnen

| Phase                | Gilt als erledigt, wenn                       | Gesperrt, solange                        |
| -------------------- | --------------------------------------------- | ---------------------------------------- |
| Rahmen               | Topf > 0 und Zeitraum gesetzt                 | —                                        |
| PB-Liste             | mindestens ein Kandidat                       | —                                        |
| Beteiligte & Gruppen | mindestens eine Gruppe mit einem Mitglied     | —                                        |
| Runde starten        | die Kachel läuft                              | PB-Liste leer oder keine besetzte Gruppe |
| Verteilen            | alle Gruppen eingereicht — oder Verteilung zu | die Runde ist nicht gestartet            |
| Finalisieren         | die Kachel ist abgeschlossen                  | die Verteilung ist nicht geschlossen     |
| Protokoll            | für diesen Zeitraum ist ein Stand eingefroren | die Kachel ist nicht abgeschlossen       |

Der Start schließt die drei Setup-Phasen mit ab: seine Vorbedingungen sind
erfüllt, sonst wäre er nicht gegangen. Eine laufende Kachel fällt deshalb nicht
auf „Phase 1" zurück, bloß weil jemand später einen Kandidaten entfernt.

## Wer welchen Schritt macht

| Schritt                                                                      | Wer                                                                               | Recht                          |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------ |
| Kachel anlegen, Rahmen, PB-Liste, Gruppen, Starten                           | Portfolio Manager / Admin                                                         | `budget.round.manage`          |
| Run-the-Business-Positionen pflegen                                          | Wertstrom-Owner, Finance-Partei des Wertstroms, Portfolio Manager / Admin         | `rtb_item.manage` (+ Seam)     |
| Beträge einer Gruppe setzen                                                  | jedes Mitglied der Gruppe                                                         | Mitgliedschaft                 |
| Verteilung einreichen                                                        | Sprecher oder Einreicher                                                          | Mitgliedschaft + Markierung    |
| Verteilung schließen, festschreiben, zurücknehmen, nächsten Zeitraum starten | Finance / Portfolio Manager / Admin                                               | `budget.manage`                |
| Budget-Plan erfassen                                                         | dieselben — beim Festschreiben ohnehin automatisch                                | `budget_plan.revision.capture` |
| ART-Epic-Budget eines ARTs auf ART-Epics verteilen                           | Wertstrom-Owner, Finance-Partei des Wertstroms, Portfolio Manager / Admin         | `rtb_item.manage` (+ Seam)     |
| Die Geld-Reiter eines Knotens überhaupt sehen                                | Admin, Portfolio Manager, Wertstrom-Owner; RTE auf **seinem** ART; Finance-Partei | `budget.read` (+ Seam)         |

## Nachschlagepunkte im Code

| Aussage                                               | Quelle                                                                |
| ----------------------------------------------------- | --------------------------------------------------------------------- |
| Die sieben Phasen und ihre Bedingungen                | `src/modules/budgeting/domain/period-phases.ts`                       |
| Erlaubte Status-Übergänge                             | `src/modules/budgeting/domain/round-status.ts`                        |
| Kachel anlegen, Übernahme, Starten                    | `src/modules/budgeting/server/services/round-service.ts`              |
| PB-Liste: Epics kuratieren, RtB materialisieren       | `src/modules/budgeting/server/services/candidate-service.ts`          |
| ART-Epics vom PB-Liste ausnehmen                      | `src/modules/budgeting/server/views/period-detail.ts`                 |
| ART-Epic-Budget und Zuteilung an ART-Epics            | `src/modules/budgeting/server/services/art-pot.ts`                    |
| Die Einordnung selbst (Kosten gegen Limit)            | `src/modules/work/domain/pb-submission.ts` (`classifyEpic`)           |
| PB-Liste-Fähigkeit + Richtwert aus LBC bzw. Hypothese | `src/modules/work/domain/pb-submission.ts`                            |
| Gruppen-Schnitt-Warnungen                             | `src/modules/budgeting/domain/group-cut.ts`                           |
| Verteil-Fenster, Einreichen                           | `src/modules/budgeting/server/services/group-distribution-service.ts` |
| Median, Reserve                                       | `src/modules/budgeting/domain/finalize.ts`, `domain/reserve.ts`       |
| Schließen, Festschreiben, Zurücknehmen, Folge-Kachel  | `src/modules/budgeting/server/services/finalize-service.ts`           |
| Periode einer RtB-Position, Jahres- und Kachel-Betrag | `src/modules/budgeting/domain/rtb-interval.ts`                        |
| Gliederung der Kandidaten in Abschnitte               | `src/modules/budgeting/domain/candidate-grouping.ts`                  |
| Abgeleitete Wertstrom-/ART-Budgets                    | `src/modules/budgeting/server/views/period-valuestreams.ts`           |
| Budget-Plan-Revision                                  | `src/modules/budgeting/server/services/budget-plan-revision.ts`       |
| Der Hinweis in My Tasks                               | `src/modules/budgeting/server/services/my-budgeting-tasks.ts`         |
| Was welche Rolle darf                                 | `src/server/auth/policies/index.ts`                                   |
| Die Naht zum Reifegrad L3.2                           | `src/modules/work/domain/gate-readiness.ts`                           |
