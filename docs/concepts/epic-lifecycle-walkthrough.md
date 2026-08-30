# Ein gelebter Prozess — ein Epic aus drei Perspektiven

Derselbe Epic-Durchlauf, dreimal erzählt: aus Sicht des **Epic Owners**, der ihn
vorantreibt, des **Portfolio Managers / VMO**, der ihn steuert und abnimmt, und
der **Finance**, die das Geld und den Nutzen gegenzeichnet. Mit den Namen, die
Pulse tatsächlich verwendet: Reifegrad-Schritte, Reiter, Merker, Freigabewege.

## Die gemeinsame Mechanik

Ein Epic durchläuft acht Schritte:
`L0 · L1 · L2 · L3.1 · L3.2 · L4 · L4.2 · L5`. Jeder einzelne bewegt sich
dadurch, dass jemand ihn **beantragt** und benannte Personen ihn **abnehmen** —
je Wertstrom und Gate konfigurierbar. Vor dem Antrag zeigt Pulse eine
Checkliste: welche Kriterien erfüllt sind und welche fehlen. Beim Antrag wird
diese Checkliste **eingefroren** und an der Antragszeile mitgeführt, damit später
nachvollziehbar bleibt, worauf hin freigegeben wurde.

Zwei dieser Schritte tragen zugleich eine inhaltliche Aussage:

- Die Abnahme von **L0 → L1** ist die Freigabe der **Benefit-Hypothese**.
- Die Abnahme von **L2 → L3.1** ist die Freigabe des **Lean Business Case** —
  dort zeichnen MGMT, Business Owner, Finance, IRT-Owner und LACE/VMO.

Freigeben und Weiterrücken sind damit ein Vorgang: ein Antrag, eine Abnahme,
eine Aussage. Solange ein Antrag offen ist, ist der Text gesperrt, über den
entschieden wird — die Abnehmer sollen nicht auf etwas schauen, das sich unter
ihnen ändert.

Sieben der acht Stufen werden so beantragt. Eine wird rein **abgeleitet**:
`L4.1 · Umsetzung läuft` heißt „L4, aber noch nicht bestätigt fertig". Dass
`L3.1` und `L3.2` daneben als Sub-Stage unter dem Gate L3 erscheinen, ist die
Anzeige: die Spalte trägt „L3", und der Investitions-Stempel entscheidet, welche
der beiden Stufen zu sehen ist.

### Wer die drei sind

|                             | Woher die Reichweite kommt                                                                                                                                                                                                           |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Epic Owner**              | Rolle `epic_owner`, plus die Eintragung als Owner am Epic.                                                                                                                                                                           |
| **Portfolio Manager / VMO** | Rolle `portfolio_manager` — der konsolidierte Portfolio-Lead. Der **VMO-Sitz** in der Gate-Policy ist davon getrennt: `ValueStream.vmoId` benennt je Wertstrom die Person, die die Abnahme-Zeilen bekommt.                           |
| **Finance**                 | **Keine Rolle.** `ValueStream.financeApproverId` benennt die Person je Wertstrom; daraus folgen ihre Abnahme-Sitze und, über einen Service-Seam, das Recht, ART-Budget und Run-the-Business-Positionen dieses Wertstroms zu pflegen. |

---

# 1 · Der Epic Owner

Meine Frage lautet: **wie bringe ich mein Vorhaben durch?**

Ich sehe ein Kopf-Ziel und erkenne ein Vorhaben, das darauf einzahlt. Ich lege
es als Epic an und verknüpfe es mit dem Ziel — über die KPI-Kette rechnet Pulse
später aus, wie viel mein Epic zu diesem Ziel beiträgt.

Das Epic steht damit auf **L0 · Idee** im Funnel. Der Zeitstrahl im Reiter
_Reifegrad-Phasen und Timeline_ bekommt seinen ersten Eintrag: Funnel Entry.

Ich werde als Owner eingetragen — damit gehört mir die Konkretisierung. Im
Reiter _Hypothese_ schreibe ich die Benefit-Hypothese: erwarteter Nutzen, die
Annahme dahinter, Leading Indicators, Risiken. Im Reiter _Overview_ ordne ich das
Epic ein: Business oder Enabler, dazu der Horizont. Diese Einordnung entscheidet
mit, in welchen Guardrail-Topf mein Epic später fällt. Nebenher trage ich im
Timeline-Reiter einen ersten Wurf ein, je Phase ein Schätzdatum. Das ist noch
grob, aber zwei dieser Schätzungen sind mehr als eine Notiz: aus „Umsetzung
gestartet" und „Umsetzung fertig" leitet Pulse das geplante Zeitfenster ab.

Ist die Hypothese ausgearbeitet, beantrage ich **L0 → L1**. Ab dem gestellten
Antrag ist der Text gesperrt. Der VMO stimmt zu, und mit diesem einen Akt ist die
Hypothese freigegeben und das Epic steht auf L1. Lehnt er begründet ab, bleibt
das Epic auf L0 und der Text ist wieder frei. Habe ich es mir anders überlegt,
ziehe ich meinen Antrag selbst zurück.

Für die Konkretisierung brauche ich Geld. Es kommt aus derselben Budgetrunde wie
alles andere — eine je Halbjahr. Mein Epic kommt schon mit der freigegebenen
Hypothese aufs Ballot: Pulse setzt dann einen tenant-konfigurierten
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
einmalig oder laufend. Daraus rechnet Pulse den Nutzenbeitrag. Die Baseline ist
ein Feld, das ich hier setze, kein Akt zu einem späteren Zeitpunkt.

Komme ich nicht weiter, setze ich auf der Gate-Karte den Haken **„I need help"**.
Portfolio-Management und der VMO meines Wertstroms sehen mein Epic dann in ihren
Tasks — das ist die einzige Stelle im Ablauf, an der ich um Unterstützung bitte,
statt etwas zu beantragen.

Steht der Business Case, beantrage ich **L2 → L3.1**. Beim Antrag besetze ich die
fünf Parteien: MGMT, Business Owner, Finance, IRT-Owner und LACE/VMO — Finance
und LACE/VMO sind aus der Wertstrom-Governance vorbelegt, die anderen drei
benenne ich. Ab dem gestellten Antrag ist der Business Case gesperrt. Sind alle
fünf durch, ist er freigegeben und das Epic steht auf **L3.1 · BC freigegeben**.
Lehnt eine Partei begründet ab, bleibt das Epic auf L2 und der Text ist wieder
frei.

Jede Freigabe zieht einen Schnappschuss des freigegebenen Textes. Brauche ich
einen zweiten Anlauf, wird das Epic mit Begründung auf L2 zurückgestuft — das
kann nur das Portfolio-Management —, ich überarbeite und beantrage neu. Die
Abnehmer sehen diesmal eine Gegenüberstellung: was stand da zuletzt, was steht da
jetzt. Die Historie steckt vollständig in den Antrags-Zeilen.

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

Zum Umsetzungsstart erfasse ich den ersten Messwert je KPI. Damit beginnt die
Messreihe, an der Pulse den Erfüllungsgrad entlang der Strecke Baseline → Ziel
abliest.

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

Mit ihr steht auch die **gelieferte Menge** fest. Steht meine Erfolgs-KPI bei
70 %, dann sind es 70 % — der Rest wird nicht mehr hochgerechnet, denn gebaut
ist gebaut. Liegt sie über 100 %, zählt sie voll. Spätere Messungen bewegen die
Menge nicht mehr; was sich danach noch ändern kann, ist ihr _Wert_, und den
verantwortet Finance.

Und dann warte ich. „Fertig gebaut" ist nicht „Nutzen nachgewiesen", und
zwischen beidem darf beliebig viel Zeit liegen. Irgendwann sieht Controlling im
Bericht, dass sich die Bottom Line bewegt hat, und sagt Bescheid. Ich beantrage
**L4.2 → L5 · Impact realisiert**; Voraussetzung ist die bestätigte Umsetzung.
Die Abnahme setzt den Impact-Stempel — und erst damit ist der Kreis zum
Kopf-Ziel vom Anfang geschlossen.

---

# 2 · Der Portfolio Manager / VMO

Meine Frage lautet: **arbeiten wir am Richtigen, und wo muss entschieden
werden?** Ich sehe nicht ein Epic, ich sehe alle.

Mein Tag beginnt bei den **Zielen**. Zielbild und Kopf-Ziele stehen hier; jedes
Epic zahlt später auf eines davon ein. Ohne gepflegte Ziele lässt sich am
Jahresende kein Wertnachweis führen — die KPI-Kette der Epics hängt an ihnen.

Auf dem **Portfolio-Board** stehen alle Epics nach Reifegrad L0–L5. Was sich
links staut, ist unentschieden; was rechts steht, läuft bereits. Die Epic-Liste
zeigt dieselbe Menge als Funnel, mit dem nächsten notwendigen Schritt je Zeile
und der Zahl der offenen Abnehmer, wo ein Antrag läuft.

Meine Entscheidungen sammeln sich unter **Meine Freigaben**. Was dort liegt, sind
beantragte Reifegrad-Wechsel, an denen ich als Abnehmer benannt bin. Zu jedem
sehe ich, worum es geht, und — sobald es eine frühere Freigabe gibt — die
Gegenüberstellung zur zuletzt freigegebenen Fassung. Ich stimme zu oder lehne
begründet ab; eine Ablehnung ohne Text nimmt Pulse nicht an. Solange ich nichts
tue, steht das Epic still. Das ist kein Nebeneffekt, sondern die Absicht: der
Reifegrad bewegt sich nur durch eine Unterschrift.

Wo ich zeichne, hängt an der Gate-Policy meines Wertstroms. Nach den
Code-Defaults bin ich als VMO an **→ L1** (und gebe damit die Benefit-Hypothese
frei), an **→ L2**, an **→ L4** und an **→ L4.2**; beim Business Case sitze ich
als LACE/VMO neben den vier anderen Parteien an **→ L3.1**; die
Investitionsentscheidung **→ L3.2** zeichne ich zusammen mit Finance. Wer für
welchen Schritt eingetragen ist, konfiguriere ich je Wertstrom — die Defaults
sind nur der Startpunkt.

Zwei Listen kommen ungefragt auf mich zu. **„Zur Steuerung markiert"** auf der
Portfolio-Übersicht führt die Epics, deren Owner den Steering-Haken gesetzt hat,
sortiert nach der längsten Zeit ohne Update — das ist die Agenda des nächsten
Termins, nicht meine Erfindung. Und die offenen **„I need help"**-Bitten: als
Portfolio-Manager sehe ich alle im Mandanten, ein reiner VMO die seines
Wertstroms.

Dann das Geld. Ich setze den **Budget-Topf** je Halbjahr und verteile ihn auf die
Epics. Die Zeile „Verbleibend" färbt sich rot, sobald ich mehr verteile, als im
Topf ist. Eine gespeicherte Zuteilung schiebt das Epic **nicht** weiter: sie
erfüllt das blockierende Kriterium für **→ L3.2**, mehr nicht. Die
Investitionsentscheidung ist der Antrag plus meine und Finance' Abnahme — dort
werden Genehmiger und Datum gestempelt.

Im **Portfolio-Review** stelle ich Plan und Ist gegenüber: Benefit-Plan,
Forecast, Plantreue, Terminabweichung, Top-down von Portfolio über Wertströme
bis zu einzelnen Epics. Über den Stichtag vergleiche ich Stände.

Auf der **Guardrails**-Fläche lese ich, ob die Verteilung noch zum Zielbild
passt: der Horizont-Mix, die Capacity Allocation zwischen Business und Enabler,
und das **Business-Owner-Engagement** — ob die Business Owner ihre Zeichnung an
L3.1 überhaupt leisten und wie lange sie dafür brauchen. Die Zielwerte dieser
Guardrails setze ich selbst.

Geht etwas schief, bin ich die Korrektur-Instanz: **nur ich darf einen Reifegrad
zurückstufen**, genau einen Schritt, mit Pflicht-Begründung. Das räumt die
Stempel des verlassenen Schritts ab — eine zurückgenommene BC-Freigabe ist
wirklich zurückgenommen, und der Text wird wieder editierbar. Bei den Risiken
gilt dasselbe Prinzip: einordnen darf jeder, löschen nur ich.

---

# 3 · Finance

Meine Frage lautet: **stimmt die Rechnung, und ist sie am Ende aufgegangen?**

Ich habe keine Rolle im System. Ich bin an meinem Wertstrom als
Finance-Approver benannt, und daraus folgt alles Weitere: die Abnahme-Zeilen, die
bei mir landen, und das Recht, das Budget dieses Wertstroms auf die ARTs
herunterzubrechen und seine Run-the-Business-Positionen zu pflegen — ohne dass
mir jemand eine Portfolio-Rolle geben müsste.

Ich habe **drei Sitze** im Lebenszyklus eines Epics:

**→ L3.1 · Business Case.** Ich bin eine der fünf Parteien. Was ich prüfe, hat
der Epic Owner aufgeschrieben, aber mit mir gerechnet: die Kostenscheiben auf der
einen Seite, auf der anderen die KPI-Kalkulation — Wert je Einheit, Nutzenart
einmalig oder laufend, und daraus der Nutzenbeitrag. Die Felder pflegt der Owner;
meine Zeichnung ist die Gegenprobe. Sie deckt Deliverables und KPIs mit ab, es
gibt keine getrennte Abnahme je Abschnitt. Zeichne ich nicht, ist der Business
Case nicht freigegeben — das Quorum ist einstimmig.

**→ L3.2 · Investitionsentscheidung.** Hier zeichne ich zusammen mit dem VMO, und
hier fällt das Geld. Blockierendes Kriterium ist eine Zuteilung größer null; die
Abnahme stempelt Genehmiger und Datum ans Epic. Dass dieser Schritt vom Eintritt
in L3 getrennt ist, ist Absicht: ein freigegebener Business Case ist noch keine
Investition.

**→ L5 · Impact realisiert.** Der letzte Schritt gehört mir allein. Voraussetzung
ist die bestätigte Umsetzung (L4.2) — „fertig gebaut" ist nicht „Nutzen
nachgewiesen", und zwischen beidem darf beliebig viel Zeit liegen. Ich bestätige,
dass der prognostizierte Nutzen an den KPIs bzw. auf der Bilanz angekommen ist.
Die Abnahme setzt den Impact-Stempel.

Genau in diesem Fenster liegt meine eigentliche Arbeit. Die **Menge** ist mit
L4.2 festgeschrieben, der **Wert** noch nicht: jetzt zeigt sich, ob eine Einheit
Verbesserung wirklich so viel gebracht hat, wie im Business Case angesetzt.
Ziehe ich den Umrechnungsfaktor nach, gilt der neue Wert **rückwirkend** für die
ganze Ist-Rechnung — der **Plan** dagegen bleibt bei dem Faktor und dem Ziel, die
bei der Freigabe galten. Nur so misst Plan gegen Ist etwas.

Darin steckt eine Asymmetrie, die den Schnitt erklärt: ich zeichne die
**Geld**-Entscheidung mit und bestätige am Ende den **Nutzen** — den Eintritt in
L3 mit dem freigegebenen Business Case aber nicht allein. Genau deshalb sind
L3.1 und L3.2 zwei Schritte und nicht einer.

Ein Epic kann damit auf **zwei Achsen** über- oder unterliefern, und die
Kalkulation weist beide getrennt aus: die **Menge** (hat die KPI ihr Ziel
erreicht?) und den **Wert** (war eine Einheit so viel wert wie angesetzt?). Ein
Epic, das nur 70 % seines KPI-Ziels erreicht, dessen Einheiten sich aber als
wertvoller herausstellen, kann unterm Strich trotzdem liefern — und man sieht,
woran es lag.

Zwischen den Sitzen ist die **Dashboard-Ökonomie** meine Lesefläche: Break-Even,
Benefit Velocity gegen den Plan, die Kostenkurve gegen den Kostenneutralitäts-
Zielwert, und der Wasserfall „Wert je Reifegrad-Status" gegen den Zielwert des
jeweiligen Kopf-Ziels. Was dort als Forecast steht, ist genau das, was ich an
L3.1 mitgezeichnet habe — und was als Ist danebensteht, das, was an L5 daraus
geworden ist.

---

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

Zwei dieser Kriterien fragen nach **Inhalt** statt nach einer Freigabe: → L1 und
→ L3.1 tragen die Freigabe selbst, sie können sie also nicht voraussetzen. Der
Stempel wird dort gesetzt, nicht geprüft — und von den Folgeschritten → L2 und
→ L3.2 abgefragt.

## Wer nimmt welchen Schritt ab

Die Code-Defaults, je Wertstrom überschreibbar. Das Quorum ist durchgehend
einstimmig — wer eingetragen ist, muss zustimmen.

| Schritt               | Abnahme                                            |
| --------------------- | -------------------------------------------------- |
| → L1 · L2 · L4 · L4.2 | VMO                                                |
| → L3.1                | MGMT, Business Owner, Finance, IRT-Owner, LACE/VMO |
| → L3.2                | VMO **und** Finance                                |
| → L5                  | Finance                                            |

Die fünf Parteien an → L3.1 sind der Code-Default und zugleich der Ausdruck der
Practice „Mehrparteien-Freigabe". Ist sie im Zielbild aus, zeichnet dort der VMO
allein. Wer für MGMT, den Business Owner und den IRT-Owner _dieses_ Epics steht,
benennt der Antragsteller beim Antrag — das ist eine Eigenschaft des Epics, keine
Regel des Wertstroms.

## Nachschlagepunkte im Code

| Aussage                                                 | Quelle                                                                     |
| ------------------------------------------------------- | -------------------------------------------------------------------------- |
| Schritte + Sub-Stages, L3.2 und L4.2 als echte Schritte | `src/modules/work/domain/stage-gate.ts`                                    |
| Kriterien je Schritt, blockierend vs. beratend          | `src/modules/work/domain/gate-readiness.ts`                                |
| Wer nimmt welchen Schritt ab                            | `src/modules/work/domain/gate-policy.ts`                                   |
| Sperre, Diff und Baseline der beiden Texte              | `src/modules/work/domain/epic-revision-visibility.ts`                      |
| Welcher Schritt welchen Stempel setzt und abräumt       | `src/modules/work/domain/gate-transition.ts`                               |
| Rollensatz und Labels                                   | `src/modules/core/kernel/domain/roles.ts`                                  |
| Was welche Rolle darf                                   | `src/server/auth/policies/index.ts`                                        |
| Finance-Seam ohne Rolle (ART-Budget, RTB)               | `src/modules/budgeting/server/services/art-budget.ts`                      |
| Empfänger der „I need help"-Bitten                      | `src/modules/work/server/services/my-help-requests.ts`                     |
| Business-Owner-Engagement (Guardrail 4)                 | `src/modules/work/server/views/portfolio-guardrails-view.ts`               |
| Ballot-Fähigkeit + Default-Aufwand                      | `src/modules/work/domain/pb-submission.ts`                                 |
| Budget-Prozessleiste, Rundenstatus                      | `src/modules/budgeting/server/views/budget-process-rail.ts`                |
| Beschriftung der zwei Merker                            | `src/modules/work/features/portfolio/components/epic-governance-flags.tsx` |
| Timeline-Estimates = geplantes Fenster                  | `src/modules/work/domain/epic-schedule.ts`                                 |
