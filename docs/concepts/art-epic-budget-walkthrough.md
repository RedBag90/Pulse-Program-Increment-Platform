# Ein gelebter Prozess — ein ART-Epic kommt an Geld

Derselbe Weg, dreimal erzählt: aus Sicht des **Epic Owners**, der sein Vorhaben
durchbringt, des **Produkt-Managers**, dem das Produkt gehört, das verändert
wird, und des **Wertstrom-Owners**, der den Rahmen führt, aus dem bezahlt wird.
Mit den Namen, die Pulse tatsächlich verwendet: ART-Epic-Budget, Zuteilung,
L3.2, L4.1.

Das Schwesterdokument ist [budgeting-walkthrough.md](budgeting-walkthrough.md).
Es erzählt den **anderen** Weg zum selben Geld — den über die Kachel und ihren
PB-Liste. Welcher gilt, entscheidet allein die Größe des Vorhabens; siehe dort
[Die Naht zum Epic](budgeting-walkthrough.md#die-naht-zum-epic).

Fünf Dokumente beschreiben die Abläufe von Pulse und verweisen aufeinander:
[Epic](epic-lifecycle-walkthrough.md) — was gebaut wird ·
[Budget](budgeting-walkthrough.md) — womit ·
[ART-Budget](art-epic-budget-walkthrough.md) — womit, wenn es klein ist ·
[PI](pi-walkthrough.md) — wann geliefert wird ·
[Risiko](risk-walkthrough.md) — was dazwischenkommt. Den Rahmen, in dem sie
stattfinden, führt [Struktur](structure-walkthrough.md) vor.

## Die gemeinsame Mechanik

Ein ART-Epic wartet auf keine Budget-Runde. Es steht auf keinem PB-Liste — nicht
abgelehnt, sondern woanders zuhause. Sein Geld kommt aus dem
**ART-Epic-Budget** seines ARTs.

Vier Dinge muss man dafür wissen, und drei davon überraschen:

### Der Rahmen ist kein Betriebsgeld

Der ART-Epic-Budget wird geführt wie eine Run-the-Business-Position, trägt
aber eine eigene Art (`art_change`) — ausdrücklich getrennt, damit
Wachstums-Geld nicht als Betrieb ausgewiesen wird. Betriebsgeld (`run`)
finanziert **nie** ein Epic. Wer nach „dem übrigen Run-the-Business-Budget"
fragt, fragt nach der falschen Größe.

Wie jede andere Position geht der Rahmen über die PB-Liste einer Halbjahres-Kachel.
Was dort am Ende festgeschrieben ist, **ist** der Topf. Ohne geschlossene Kachel
für dieses Halbjahr ist er null, auch wenn der Rahmen gepflegt ist.

### Der Rahmen gilt je Halbjahr und wandert nicht

Zugeteilt wird im **laufenden oder im nächsten** Halbjahr, nie rückwirkend.
Vergangene sind gesperrt, und Pulse sagt auch warum: _„Die Zuteilungshistorie
bleibt unbeweglich."_ Ein Rest aus dem letzten Zyklus ist kein verfügbares Geld
— er verfällt nicht und wandert nicht, er wird ausgewiesen und ist die Grundlage
für das Gespräch über den nächsten Rahmen.

### Die Reihenfolge ist die, die man andersherum erwartet

**Erst die Zuteilung, dann der Antrag.** Der Reifegrad-Schritt
**L3.1 → L3.2 · Budget alloziert** hat genau ein Kriterium, und es ist
**blockierend**: die Summe der Zuteilung ist größer null. Der Antrag scheitert
sonst schon beim Anlegen, nicht erst bei der Abnahme.

Das ist kein Versehen, sondern eine Festlegung: die Investitionsentscheidung
soll ein eigener, beantragter Schritt sein und nicht die Nebenwirkung einer
Budgetzuteilung (ADR-0018). Die Abnahme von L3.2 genehmigt deshalb kein Geld —
sie stellt fest, dass welches da ist.

### Reserviert wird nichts

Einen Zwischenzustand „vorgemerkt, aber noch nicht wirksam" kennt das Modell
nicht. Zugeteilt ist zugeteilt: die Zeile am ART entsteht, der Rest des Rahmens
sinkt sofort, und am Epic steht dieselbe Budget-Summe, die auch ein PB-Liste
geschrieben hätte. Für den Reifegrad ist es gleichgültig, woher das Geld kam.

### Wer die drei sind

|                     | Woher die Reichweite kommt                                                                                                                                                                                    |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Epic Owner**      | Rolle `epic_owner`, plus die Eintragung als Owner am Epic. Er merkt vor und beantragt — **ans Geld kommt er nicht**, und er sieht den freien Rahmen auch nicht.                                               |
| **Produkt-Manager** | **Keine Rolle.** `Solution.productManagerId` benennt die Person je Solution. Daraus folgen drei Dinge: sie darf ihre Solution bearbeiten, sie zeichnet Freigaben mit, und sie darf für ihre Epics zuteilen.   |
| **Wertstrom-Owner** | Rolle `value_stream_owner`, wertstrom-scoped. Er pflegt den Rahmen (`rtb_item.manage`) und verteilt ihn. Dieselbe Reichweite haben Portfolio-Management und die **Finance-Partei** des Wertstroms ohne Rolle. |

---

# 1 · Der Epic Owner

Meine Frage lautet: **wie komme ich an das Geld, das ich brauche?**

Mein Business Case ist freigegeben, das Epic steht auf **L3.1**. Mit dieser
Abnahme ist etwas passiert, das vorher nicht möglich war: **die Einordnung ist
entstanden.** Pulse hat die Kostenscheiben zusammengerechnet und dem
Portfolio-Limit meines Wertstroms gegenübergestellt — meine liegen darunter,
also ist mein Vorhaben ein **ART-Epic**.

Was das heißt, merke ich sofort: in der Kandidatenliste der nächsten
Budget-Kachel tauche ich gar nicht auf. Ich warte auf keine Runde. Mein Geld
liegt woanders.

**Mein erster Schritt ist ein Haken.** Im Overview setze ich „Fürs nächste
Budget-Meeting vormerken". Bei einem Portfolio-Epic meldet der Haken eine Runde
an; bei mir tut er etwas anderes — er schaltet mein Epic auf der **Verteilliste
meines ARTs** frei. Ohne ihn steht dort keine Zeile, in die jemand einen Betrag
eintragen könnte. Das ist die einzige Handlung dieses Abschnitts, die bei mir
selbst liegt.

**Dann muss ich fragen.** Auf meiner Epic-Seite sehe ich, **ob** für meinen ART
überhaupt ein ART-Epic-Budget angelegt ist — ist keiner da, sagt Pulse mir
das deutlich, statt es mich beim Warten herausfinden zu lassen. Wie viel davon
frei ist, sehe ich nicht: die Geld-Reiter tragen ein eigenes Recht, und das
liegt bei den Rollen oberhalb von mir. Das ist keine Lücke, sondern die
Entscheidung — Geld gehört an den Knoten, nicht ans Epic.

Ich frage also. Auskunft geben mir der **Wertstrom-Owner**, die
**Finance-Partei** des Wertstroms, der **RTE** (der den Topf seines ARTs sieht)
oder das **Portfolio-Management** — und seit Neuestem auch der
**Produkt-Manager** meiner Primär-Solution, der nicht nur Auskunft geben, sondern
selbst zuteilen darf.

Ist der Betrag eingetragen, **beantrage ich L3.2 · Budget alloziert.** Jetzt
erst: vorher wäre der Antrag gar nicht herausgekommen, das Kriterium blockiert.
Abgenommen wird von zwei Seiten — dem VMO meines Wertstroms und der
Finance-Partei. Mit der Abnahme stempelt Pulse Genehmiger und Datum an mein
Epic.

Der Rest ist derselbe Weg wie bei jedem anderen Epic. Ich ordne meine Features
den PIs zu — das ist eine Handlung im Cockpit, keine Folge einer Abnahme — und
beantrage **L4.1 · Umsetzung läuft**. Ein Kriterium gibt es, „mindestens ein
Feature ist gestartet", aber es blockiert nicht: der Antrag selbst _ist_ der
bewusste Start. Steht es offen, sieht man die Zahl daneben und die Abnehmer
entscheiden.

> **Zur Zahl 4.1.** Gespeichert wird dieser Schritt als `L4`; angezeigt heißt er
> überall `L4.1`. Das **Haupt-Gate** L4 umfasst beide Unterstufen — L4.1 und
> L4.2 — und heißt in der Trichter-Leiste weiterhin so. Wo ein **Schritt**
> benannt wird, steht L4.1: dieselbe Zahl, die danach am Epic steht.

---

# 2 · Der Produkt-Manager

Meine Frage lautet: **was passiert mit meinem Produkt, und kann ich etwas
dagegen tun?**

Ich bin an einer Solution als Produkt-Manager eingetragen. Das ist keine Rolle,
sondern ein Personenfeld — Produktverantwortung fällt nicht mit einer SAFe-Rolle
zusammen, und wer sie trägt, ist eine Frage der Organisation, nicht der
Berechtigung.

Drei Dinge hängen daran, und sie bauen aufeinander auf.

**Ich darf mein Produkt bearbeiten** — Horizont, Beschreibung, ART-Zuweisung —
auch ohne die allgemeine Solution-Berechtigung.

**Ich zeichne bei Reifegrad-Freigaben mit.** Am Business Case (→ L3.1) bei jedem
Epic meiner Solution: dort ist die Einordnung noch gar nicht entschieden, eine
Einschränkung auf ART-Epics wäre also nicht möglich. Am Start der Umsetzung
(→ L4.1) nur bei ART-Epics — dort ist die Klasse bekannt, und dort wird mein
Produkt aus dem Rahmen seines ARTs verändert.

**Und ich darf das Geld dafür zuteilen.** Aus dem ART-Epic-Budget des ARTs,
aber **nur den Epics meiner Solution.** Der Rahmen gehört dem ART, die
Verantwortung für das einzelne Vorhaben mir; deshalb hängt dieses Recht am Epic,
nicht am Topf. Stünde es am Topf, dürfte ich über fremde Vorhaben desselben ARTs
mitentscheiden, nur weil sie zufällig danebenliegen.

Auf der Verteilfläche (`/structure/art/…`, Reiter _Budget_) sehe ich deshalb
alle Zeilen, bedienen kann ich meine eigenen. Bei den übrigen steht der Betrag
als Text — ein Eingabefeld, das beim Speichern ablehnt, wäre die schlechtere
Auskunft.

Der Reiter öffnet sich mir überhaupt nur an den ARTs, an denen mindestens ein
vorgemerktes Epic meiner Solution auf Geld wartet. Wo ich nichts tun kann, sehe
ich auch den Rahmen nicht.

Der dritte Punkt ist der Grund für den zweiten und der zweite für den ersten:
Verantwortung ohne Handlungsmöglichkeit wäre eine leere Zuschreibung. Wer über
eine Freigabe entscheidet, deren Gegenstand sein eigenes Produkt ist, soll auch
den Weg dorthin gehen können.

---

# 3 · Der Wertstrom-Owner

Meine Frage lautet: **reicht das Geld, das ich habe, für das, was ansteht?**

**Der Rahmen entsteht bei mir.** Auf der Wertstrom-Seite, im Reiter _Betrieb_,
lege ich je ART eine Position mit der Art „ART-Epic-Budget" an. Sie geht
denselben Weg wie jede Run-the-Business-Position: sie wird Kandidat auf dem
PB-Liste der Halbjahres-Kachel, und was dort festgeschrieben wird, ist der Topf,
den dieser ART verteilen darf.

Lege ich für einen ART keinen an, hat jedes ART-Epic dieses ARTs **keinen** Weg
zu Geld: es steht nicht auf der PB-Liste und hat keinen Topf. Pulse weist das an
der Epic-Seite aus, statt es zu verschweigen. Der Ausweg ist entweder ein Rahmen
— oder die bewusste Erklärung, dass dieses Vorhaben trotz seiner Größe
Portfolio-Sache bleibt.

**Verteilt wird im Budget-Reiter des ARTs.** Dort sehe ich drei Zahlen: Topf,
Verteiltes, Rest. Darunter die vorgemerkten ART-Epics mit ihrem Richtwert — der
friert beim ersten Zuteilen ein, sonst verschöbe sich die Liste zwischen zwei
Besuchen dem Business Case hinterher, ohne dass jemand etwas getan hat.

Zwei Grenzen halten mich, und beide prüft der Schreibpfad in derselben
Transaktion, nicht nur die Oberfläche:

- **Der Rahmen ist der Deckel.** Was nicht mehr hineinpasst, bleibt sichtbar
  ungedeckt. Es gibt keine Quote und keinen Verteilschlüssel — wer leer ausgeht,
  geht leer aus, weil das Geld alle ist.
- **Das Halbjahr ist gesperrt oder offen.** Laufendes und nächstes ja,
  vergangene nein.

Verteilen dürfen neben mir die **Finance-Partei** meines Wertstroms — ohne dafür
eine Rolle zu brauchen — und das **Portfolio-Management**. Dazu der
**Produkt-Manager** einer Solution, aber nur für deren eigene Epics. Der **RTE**
sieht seinen Topf, verteilt ihn aber nicht: der Rahmen wird _für_ den ART
verteilt, nicht _von_ ihm.

**Und ich zeichne nicht mit.** An L3.2 stehen der VMO und die Finance-Partei;
die Investitionsentscheidung ist die ihre, nicht meine. Ich stelle das Geld
bereit und teile es zu — über den Reifegrad entscheidet die Governance.

---

## Die Nähte

**Zum Epic.** Der Schritt L3.1 → L3.2 ist die einzige harte Verbindung: ohne
Zuteilung kein Antrag. Beide Finanzierungswege — Kachel wie ART-Rahmen —
schreiben in dieselbe `BudgetAllocation`, für den Schritt ist es also
gleichgültig, woher das Geld kam. Siehe
[epic-lifecycle-walkthrough.md](epic-lifecycle-walkthrough.md).

**Zum Budget.** Der Rahmen selbst ist ein PB-Listen-Kandidat wie jede andere
Run-the-Business-Position und wird in derselben Kachel entschieden. Zwei
Flächen, ein Topf: entschieden im Budgeting, verteilt am ART. Siehe
[budgeting-walkthrough.md](budgeting-walkthrough.md).

**Zur Struktur.** Der Rahmen hängt am ART, der Produkt-Manager an der Solution.
Beide Knoten und ihre Reiter führt
[structure-walkthrough.md](structure-walkthrough.md) vor.

**Zum PI** gibt es **keine** Naht, und das ist eine Aussage. Die PI-Zuordnung
der Features ist keine Folge der L4.1-Abnahme — sie geht ihr voraus: ein Feature
lässt sich erst starten, wenn es in einem PI liegt, und ein gestartetes Feature
ist dann der beratende Anhaltspunkt für den Antrag. Geld und Takt laufen
absichtlich nebeneinander.

---

## Sechs Sätze, die naheliegen und nicht stimmen

| Was man erwartet                                           | Was gilt                                                                                                                                                   |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| „Ich beantrage L3.2, **damit** das Budget genehmigt wird." | Umgekehrt. L3.2 **setzt** die Zuteilung voraus — sie ist das einzige, blockierende Kriterium des Schritts.                                                 |
| „Ich frage den **Solution Manager**."                      | Diese Rolle gibt es nicht. Pulse kennt acht Rollen, keine heißt so. Der Nächstliegende ist der **Produkt-Manager** einer Solution — ein Feld, keine Rolle. |
| „… wie viel **Run-the-Business-Budget** übrig ist."        | Falsche Größe. Der ART-Epic-Budget ist eine eigene Art (`art_change`); Betriebsgeld finanziert nie ein Epic.                                               |
| „… aus dem **letzten** Budget-Zyklus."                     | Der Rahmen gilt je Halbjahr und wandert nicht. Vergangene Halbjahre sind gesperrt.                                                                         |
| „Das Budget wird **reserviert**."                          | Einen Zwischenzustand gibt es nicht. Zugeteilt ist zugeteilt, der Rest sinkt sofort.                                                                       |
| „Mit **L4.1** kommen die Features ins nächste PI."         | Keine Abnahme rührt die Features an. Ein Feature muss _schon_ in einem PI liegen, um gestartet werden zu können.                                           |

## Wer welchen Schritt macht

| Schritt                              | Wer                                                                                                                   | Recht                     |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| ART-Epic-Budget anlegen              | Wertstrom-Owner, Portfolio-Management; Finance-Partei über den Seam                                                   | `rtb_item.manage`         |
| Rahmen in der PB-Liste festschreiben | Finance, beim Schließen der Kachel                                                                                    | `budget.manage`           |
| Epic vormerken                       | Epic Owner                                                                                                            | `epic.update`             |
| Freien Rahmen sehen                  | Tenant-Admin, Portfolio Manager, Wertstrom-Owner; RTE auf seinem ART; Finance-Partei; Produkt-Manager auf seinen ARTs | `budget.read` + Seams     |
| Aus dem Rahmen zuteilen              | Wertstrom-Owner, Portfolio-Management, Finance-Partei; **Produkt-Manager** für die Epics seiner Solution              | `rtb_item.manage` + Seams |
| L3.2 beantragen                      | Epic Owner                                                                                                            | `epic.gate.request`       |
| L3.2 abnehmen                        | VMO **und** Finance-Partei des Wertstroms                                                                             | Gate-Policy               |
| L4.1 beantragen                      | Epic Owner                                                                                                            | `epic.gate.request`       |
| L4.1 abnehmen                        | VMO; bei ART-Epics zusätzlich der Produkt-Manager                                                                     | Gate-Policy               |

## Nachschlagepunkte im Code

| Aussage                                             | Quelle                                                     |
| --------------------------------------------------- | ---------------------------------------------------------- |
| Die Einordnung eines Epics                          | `src/modules/work/domain/pb-submission.ts`                 |
| L3.2 verlangt Σ > 0, blockierend                    | `src/modules/work/domain/gate-readiness.ts`                |
| Wer den ART-Rahmen verteilen darf                   | `src/modules/budgeting/domain/art-pot-access.ts`           |
| Laufendes und nächstes Halbjahr, sonst gesperrt     | `src/modules/budgeting/domain/art-pot-window.ts`           |
| Rahmen je Halbjahr, Deckel in derselben Transaktion | `src/modules/budgeting/server/services/art-pot.ts`         |
| Betrieb gegen ART-Epic-Budget                       | `src/modules/budgeting/domain/rtb-kind.ts`                 |
| Beide Wege schreiben dieselbe Summe                 | `src/modules/budgeting/server/services/epic-allocation.ts` |
| Die Verteilliste zeigt nur Vorgemerkte              | `src/modules/budgeting/server/views/art-budget-detail.ts`  |
| Beantragbare Schritte und ihre Beschriftung         | `src/modules/work/domain/stage-gate.ts`                    |
| Der Produkt-Manager als Abnehmer                    | `src/modules/work/domain/gate-policy.ts`                   |
| Ein Feature braucht ein PI, bevor es startet        | `src/modules/work/server/services/feature.ts`              |
| Was welche Rolle darf                               | `src/server/auth/policies/index.ts`                        |
