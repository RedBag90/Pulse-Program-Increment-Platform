# Ein gelebter Prozess — ein Epic von der Idee bis zum bestätigten Impact

Dieses Papier erzählt einen vollständigen Epic-Durchlauf aus Sicht des Epic
Owners, mit den Namen, die Pulse tatsächlich verwendet: Reifegrad-Schritte,
Reiter, Merker, Freigabewege. Am Ende steht, wo eine verbreitete Beschreibung
des Prozesses von der Mechanik im Tool abweicht.

## Eine Achse, keine zwei

Bevor die Erzählung losgeht, eine Klarstellung, ohne die der Rest verwirrend
bleibt — zumal die verbreitete Beschreibung hier noch anders klingt. „Freigabe"
heißt in Pulse **eine** Sache:

- **Reifegrad-Schritte** — `L0 · L1 · L2 · L3.1 · L3.2 · L4 · L4.2 · L5`. Ein Schritt
  bewegt sich ausschließlich, wenn jemand ihn **beantragt** und benannte Personen
  ihn **abnehmen** (Finance, VMO, Epic Owner, die fünf Business-Case-Parteien —
  je Wertstrom und Gate konfigurierbar). Es gibt keinen Automatismus, nirgends.
  Siehe [ADR-0018](../adr/0018-stage-gate-transitions-are-requested-and-approved.md).

Eine **eigene Freigabe-Achse** für Hypothese und Business Case gab es einmal;
sie ist in die Reifegrad-Schritte aufgegangen. Die Abnahme von **L0 → L1** _ist_
die Freigabe der Benefit-Hypothese, die Abnahme von **L2 → L3.1** _ist_ die
Freigabe des Lean Business Case — dort zeichnen MGMT, Business Owner, Finance,
IRT-Owner und LACE/VMO. Ein Antrag, eine Abnahme, eine Aussage. Siehe den
Nachtrag zu [ADR-0003](../adr/0003-initiative-state-axes-stay-orthogonal.md).

Dazu kommt: nicht jeder angezeigte Reifegrad ist ein beantragbarer Schritt.
Genau eine Stufe wird rein **abgeleitet** — `L4.1 · Umsetzung läuft`: sie ist
schlicht „L4, aber noch nicht bestätigt fertig". `L3.1`, `L3.2` und `L4.2`
werden dagegen beantragt und abgenommen wie jedes Haupt-Gate. Dass `L3.1` und
`L3.2` daneben auch als Sub-Stage unter dem Gate L3 erscheinen, ist nur die
Anzeige: die Spalte trägt „L3", und der Investitions-Stempel entscheidet, welche
der beiden Stufen zu sehen ist.

## Der Durchlauf

Ich sehe ein Kopf-Ziel und erkenne ein Vorhaben, das darauf einzahlt. Ich lege
es als Epic an und verknüpfe es mit dem Ziel — über die KPI-Kette rechnet Pulse
später aus, wie viel mein Epic zu diesem Ziel beiträgt.

Das Epic steht damit auf **L0 · Idee** im Funnel. Der Zeitstrahl im Reiter
_Reifegrad-Phasen und Timeline_ bekommt seinen ersten Eintrag: Funnel Entry.

Ich werde als Owner eingetragen — damit gehört mir die Konkretisierung. Im
Reiter _Hypothese_ schreibe ich die Benefit-Hypothese: erwarteter Nutzen, die
Annahme dahinter, Leading Indicators, Risiken. Nebenher trage ich im
Timeline-Reiter einen ersten Wurf ein, je Phase ein Schätzdatum. Das ist noch
grob, aber zwei dieser Schätzungen sind mehr als eine Notiz: aus „Umsetzung
gestartet" und „Umsetzung fertig" leitet Pulse das geplante Zeitfenster des
Epics ab.

Ist die Hypothese ausgearbeitet, beantrage ich den Reifegrad-Wechsel
**L0 → L1**. Einen eigenen Freigabelauf für die Hypothese gibt es nicht — **die
Abnahme dieses Schritts ist ihre Freigabe**. Ab dem gestellten Antrag ist der
Text gesperrt: die Abnehmer sollen nicht auf etwas schauen, das sich unter ihnen
ändert. Der VMO stimmt zu, und mit diesem einen Akt steht der Stempel und das
Epic auf L1. Lehnt er begründet ab, bleibt das Epic auf L0 und der Text ist
wieder frei.

Reifegrade bewegen sich nie von allein: ich stelle einen Antrag, benannte
Personen nehmen ihn ab, und Pulse zeigt mir vorher, welche Kriterien erfüllt
sind und welche fehlen.

Für die Konkretisierung brauche ich Geld. Ein eigenes Analyse-Budget gibt es
nicht — es gibt eine Budgetrunde je Halbjahr. Mein Epic kommt aber schon mit der
freigegebenen Hypothese aufs Ballot: Pulse setzt dann einen konfigurierten
Default-Aufwand als Kosten-Richtwert an, grob das, was das Erarbeiten des
Business Case kostet. Ich setze im Overview den Haken **„Fürs nächste
Budget-Meeting vormerken"**.

Die Runde entscheidet, ich bekomme das Geld für die Konkretisierung. Ich
beantrage **L1 → L2**, „Für Analyse ausgewählt". Auf L2 zu stehen _ist_ „Business
Case in Arbeit" — einen Sub-Stage-Split gibt es hier nicht.

Jetzt die eigentliche Arbeit. Im Reiter _Deliverables_ schneide ich die
Endprodukte als Features. Im Reiter _Dependencies_ hänge ich die Abhängigkeiten
dran. Im Reiter _KPI & Nutzenkalkulation_ definiere ich die KPIs: Baseline,
Ziel, Einheit — und zusammen mit Finance den Wert je Einheit und die Nutzenart,
einmalig oder laufend. Daraus rechnet Pulse den Nutzenbeitrag. Finance
verifiziert das nicht nebenbei, sondern zeichnet es ab: Finance ist eine der fünf
Parteien, die den Schritt auf L3.1 abnehmen, und diese Abnahme deckt Deliverables
und KPIs mit ab — eigene Abnahmen je Abschnitt gibt es nicht mehr. Die
Freigabe-Inbox unter _Meine Tasks_ führt deshalb nur noch eine Gruppe:
**Reifegrad-Wechsel**. „Epic-Hypothesen", „Epic-Stakeholder-Freigaben" und
„Epic-Abschnitte" waren einmal drei weitere — jede Entscheidung, die dort heute
landet, ist eine Gate-Abnahme, und daneben steht, für welche Partei ich
zeichne.

Die Timeline verfeinere ich — die groben Schätzungen von damals stehen jetzt
neben belastbaren Daten.

Steht der Business Case, beantrage ich **L2 → L3.1**. Beim Antrag besetze ich die
fünf Parteien: MGMT, Business Owner, Finance, IRT-Owner und LACE/VMO — Finance
und LACE/VMO sind aus der Wertstrom-Governance schon vorbelegt, die anderen drei
benenne ich. Ab dem gestellten Antrag ist der Business Case gesperrt. Einen
eigenen Freigabelauf davor gibt es nicht — **diese Abnahme ist die Freigabe**.
Sind alle fünf durch, steht der Stempel und das Epic auf
**L3.1 · BC freigegeben**. Lehnt eine Partei begründet ab, bleibt das Epic auf
L2 und der Text ist wieder frei.

Beim **ersten** Lauf sehen die Abnehmer den Business Case, wie er dasteht. Ab dem
zweiten sehen sie eine Gegenüberstellung: die Abnahme zieht jedes Mal einen
Schnappschuss des freigegebenen Textes, und der nächste Antrag zeigt daneben, was
sich seither geändert hat. Denn einen zweiten Anlauf gibt es — nur heißt er nicht
mehr „neue Revision": Ich stufe das Epic mit Begründung auf L2 zurück (das räumt
den Stempel ab), überarbeite und beantrage neu. Die Historie steckt vollständig in
den Antrags-Zeilen.

Ich setze den Haken **„Im nächsten Steering-Meeting behandeln"**. Im
Portfolio-Review wird mein Epic aufgerufen, und das Ergebnis lautet: hol dir
Budget. Ich setze den zweiten Haken, „Fürs nächste Budget-Meeting vormerken".
Die beiden Haken hängen technisch nicht zusammen — dass der eine auf den anderen
folgt, ist meine Entscheidung, nicht die des Tools.

Die nächste Runde läuft. Diesmal steht mein Epic mit freigegebenem Business Case
auf dem Ballot, und der Kosten-Richtwert ist jetzt die Summe der Kostenscheiben
aus dem BC statt des Defaults. Die Runde diskutiert, entscheidet, teilt zu.

Jetzt kommt der Schritt, den man leicht übersieht: **L3.1 → L3.2 · Budget
alloziert**. Das ist die Investitionsentscheidung, und sie ist ein eigener
Antrag — nicht die Nebenwirkung einer Budgetzuteilung. Ein blockierendes
Kriterium: die Summe der Zuteilung ist größer null. Mit der Abnahme stempelt
Pulse Genehmiger und Datum ans Epic.

Das ist mein Stichwort. Ich ordne meine Features den PIs zu und beantrage
**L3.2 → L4**, den Start der Umsetzung. Ein Kriterium gibt es — „mindestens ein
Feature ist gestartet" —, aber es blockiert nicht: der Antrag selbst _ist_ der
bewusste Start. Danach zeigt mein Epic **L4.1 · Umsetzung läuft**.

Zum Umsetzungsstart erfasse ich den ersten Messwert je KPI. Die Baseline habe
ich schon bei der Definition gesetzt; was jetzt beginnt, ist die Messreihe, an
der Pulse den Erfüllungsgrad entlang der Strecke Baseline → Ziel abliest.

Dann arbeite ich ab. PI für PI, Feature für Feature, Status im Delivery-Cockpit.
Zwischendurch erfasse ich Messwerte — der realisierte Nutzen wächst mit.

Unterwegs stoße ich auf Dinge, die mir gefährlich werden können. Ich nehme sie
im Reiter _Issues_ am Epic auf und bewerte sie über Eintritt × Auswirkung, dazu
die ROAM-Einordnung. Damit stehen sie in der Risiko-Matrix und im Register —
sichtbar, statt in meinem Kopf.

Das Ende der Umsetzung ist erreicht. Ich beantrage **L4 → L4.2 · Umsetzung
fertig**. Ein Kriterium erinnert daran, dass alle Child-Features abgeschlossen
sein sollten — es hält den Antrag aber nicht auf: dass die Umsetzung fertig ist,
stellt die Abnahme fest, nicht der Zähler. Die Abnahme kommt, der Stempel steht.

Und dann warte ich. „Fertig gebaut" ist nicht „Nutzen nachgewiesen", und
zwischen beidem darf beliebig viel Zeit liegen. Irgendwann sieht Controlling im
Bericht, dass sich die Bottom Line bewegt hat, und sagt Bescheid. Ich beantrage
**L4.2 → L5 · Impact realisiert**; Voraussetzung ist die bestätigte Umsetzung.
Die Abnahme setzt den Impact-Stempel — und erst damit ist der Kreis zum
Kopf-Ziel vom Anfang geschlossen.

## Die Kriterien je Schritt

Was Pulse vor jedem Antrag prüft. **Blockierend** heißt: ohne das geht der
Antrag nicht durch. **Beratend** heißt: Pulse zeigt es an, hält aber nicht auf.

| Schritt | Blockierend                                      | Beratend                                    |
| ------- | ------------------------------------------------ | ------------------------------------------- |
| → L1    | Benefit-Hypothese ist ausgearbeitet              | Epic Owner ist benannt                      |
| → L2    | Benefit-Hypothese ist freigegeben                | Epic Owner benannt · Business Case begonnen |
| → L3.1  | Business Case ist ausgearbeitet                  | Epic Owner ist benannt                      |
| → L3.2  | Budget alloziert (Σ > 0)                         | —                                           |
| → L4    | —                                                | Mindestens ein Feature ist gestartet        |
| → L4.2  | —                                                | Alle Child-Features sind abgeschlossen      |
| → L5    | Umsetzung ist als abgeschlossen bestätigt (L4.2) | —                                           |

Zwei dieser Kriterien fragen bewusst nach **Inhalt** und nicht nach einer
Freigabe: → L1 und → L3.1 tragen die Freigabe selbst, sie können sie also nicht
voraussetzen. Der Stempel wird dort gesetzt, nicht geprüft.

## Wer nimmt welchen Schritt ab

Die Code-Defaults, je Wertstrom überschreibbar. Das Quorum ist durchgehend
einstimmig — wer eingetragen ist, muss zustimmen.

| Schritt               | Abnahme                                            |
| --------------------- | -------------------------------------------------- |
| → L1 · L2 · L4 · L4.2 | VMO                                                |
| → L3.1                | MGMT, Business Owner, Finance, IRT-Owner, LACE/VMO |
| → L3.2                | VMO **und** Finance                                |
| → L5                  | Finance                                            |

Darin steckt die Begründung für den Schnitt: Finance zeichnet die
**Geld**-Entscheidung mit (L3.2) und bestätigt am Ende den **Nutzen** (L5) — den
Eintritt in L3 mit dem freigegebenen Business Case dagegen nicht. Genau deshalb
sind L3.1 und L3.2 zwei Schritte und nicht einer.

Zwei Schritte tragen zusätzlich eine inhaltliche Aussage: mit der Abnahme von
**→ L1** ist die Benefit-Hypothese freigegeben, mit der von **→ L3.1** der Lean
Business Case. Einen zweiten Lauf davor gibt es in beiden Fällen nicht.

Die fünf Parteien an → L3.1 sind der Code-Default und zugleich der Ausdruck der
Practice „Mehrparteien-Freigabe". Ist sie im Zielbild aus, zeichnet dort der VMO
allein. Wer für MGMT, den Business Owner und den IRT-Owner _dieses_ Epics steht,
benennt der Antragsteller beim Antrag — das ist eine Eigenschaft des Epics, keine
Regel des Wertstroms.

## Wo die verbreitete Beschreibung von der Mechanik abweicht

1. **Freigabe und Reifegrad-Wechsel sind nicht zwei Schritte.** Die gängige
   Erzählung lässt Hypothese und Business Case erst in einem eigenen Lauf
   freigeben und den Reifegrad danach nachziehen. Im Tool ist das **ein** Akt:
   die Abnahme von L0 → L1 _ist_ die Hypothesen-Freigabe, die von L2 → L3.1 _ist_
   die des Business Case. Wer zweimal zeichnen will, findet dafür keine zweite
   Stelle — und die Kriterien dieser beiden Schritte fragen deshalb nach Inhalt,
   nicht nach einem Stempel.
2. **Die Investitionsentscheidung fehlt.** Die gängige Erzählung springt von der
   Budgetrunde direkt zur Umsetzungsfreigabe. Dazwischen liegt der beantragte
   Schritt **L3.1 → L3.2**, und genau dieser Übergang _ist_ die
   Investitionsentscheidung — hier werden Genehmiger und Datum am Epic gestempelt.
3. **Die x.2-Stufen sind echte Schritte, keine Anzeige.** Verbreitet ist die
   Annahme, alles hinter dem Punkt sei abgeleitet. Tatsächlich werden **L3.1**,
   **L3.2** und **L4.2** beantragt und namentlich abgenommen; nur **L4.1**
   ergibt sich von selbst — es ist „L4, solange die Umsetzung nicht bestätigt
   fertig ist".
4. **Kein separates Analyse-Budget.** Häufig wird „Geld für die Konkretisierung"
   als eigene Runde beschrieben. Es gibt eine Budgetrunde je Zyklus; ein Epic
   kommt aufs Ballot, sobald **Hypothese oder** Lean Business Case freigegeben
   ist. Bei nur-Hypothese setzt das Ballot einen tenant-konfigurierbaren
   Default-Aufwand als Kosten-Richtwert an. Gleiche Runde, anderer Richtwert.
5. **Die KPI-Baseline ist ein Feld, kein Akt zum Freigabezeitpunkt.** Sie wird
   beim Definieren der KPI gesetzt. Was zum Umsetzungsstart passiert, ist der
   erste **Messwert**; der Nutzen rechnet sich aus dem Erfüllungsgrad entlang
   Baseline → Ziel.
6. **Steering-Merker und Budget-Merker sind unabhängig.** Oft wird das Vormerken
   fürs Budget aus dem Review-Ergebnis abgeleitet. Es sind zwei Checkboxen im
   Epic-Overview ohne technische Kopplung — die Reihenfolge ist Konvention.

## Nachschlagepunkte im Code

| Aussage                                                 | Quelle                                                                     |
| ------------------------------------------------------- | -------------------------------------------------------------------------- |
| Schritte + Sub-Stages, L3.2 und L4.2 als echte Schritte | `src/modules/work/domain/stage-gate.ts`                                    |
| Kriterien je Schritt, blockierend vs. beratend          | `src/modules/work/domain/gate-readiness.ts`                                |
| Wer nimmt welchen Schritt ab                            | `src/modules/work/domain/gate-policy.ts`                                   |
| Sperre, Diff und Baseline der beiden Texte              | `src/modules/work/domain/epic-revision-visibility.ts`                      |
| Welcher Schritt welchen Stempel setzt und abräumt       | `src/modules/work/domain/gate-transition.ts`                               |
| Ballot-Fähigkeit + Default-Aufwand                      | `src/modules/work/domain/pb-submission.ts`                                 |
| Budget-Prozessleiste, Rundenstatus                      | `src/modules/budgeting/server/views/budget-process-rail.ts`                |
| Beschriftung der zwei Merker                            | `src/modules/work/features/portfolio/components/epic-governance-flags.tsx` |
| Phasen-Labels des Zeitstrahls                           | `src/components/detail/initiative-labels.ts`                               |
| Timeline-Estimates = geplantes Fenster                  | `src/modules/work/domain/epic-schedule.ts`                                 |
