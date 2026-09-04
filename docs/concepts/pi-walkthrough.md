# Ein gelebter Prozess — ein Program Increment aus drei Perspektiven

Derselbe PI-Durchlauf, dreimal erzählt: aus Sicht des **RTE**, der die Kadenz
führt, des **Feature Owners**, der liefert, und des **Epic Owners**, der zusieht,
wie sein Vorhaben Gestalt annimmt. Mit den Namen, die Pulse tatsächlich
verwendet: Timeline, PI, Cockpit, Delivery-Status.

Die Schwesterdokumente sind
[epic-lifecycle-walkthrough.md](epic-lifecycle-walkthrough.md) — was gebaut wird
— und [budgeting-walkthrough.md](budgeting-walkthrough.md) — womit es bezahlt
wird. Dieses hier beantwortet die dritte Frage: **wann geliefert wird.** Alle
drei treffen sich; siehe [Die Nähte](#die-nähte).

Fünf Dokumente beschreiben die Abläufe von Pulse und verweisen aufeinander:
[Epic](epic-lifecycle-walkthrough.md) — was gebaut wird ·
[Budget](budgeting-walkthrough.md) — womit ·
[ART-Budget](art-epic-budget-walkthrough.md) — womit, wenn es klein ist ·
[PI](pi-walkthrough.md) — wann geliefert wird ·
[Risiko](risk-walkthrough.md) — was dazwischenkommt. Den Rahmen, in dem sie
stattfinden, führt [Struktur](structure-walkthrough.md) vor.

## Die gemeinsame Mechanik

Ein Program Increment durchläuft drei Zustände:

`planned → active → completed`

Strikt vorwärts, keine Rückwege, `completed` ist endgültig. Zwei Regeln rahmen
das ein:

- **Ein aktives PI je Timeline.** Ein zweites zu starten scheitert mit dem Namen
  des Störenfrieds: _„PI … ist bereits in dieser Timeline aktiv; bitte zuerst
  abschließen"_. Die Kadenz ist eine Reihe, keine Wolke.
- **Ein PI ohne Timeline lässt sich weder starten noch fortschreiben.** Die
  Timeline ist der Träger des Takts; ein PI daneben wäre ein Termin ohne
  Kalender.

Der Takt selbst wird nicht am PI gepflegt, sondern am **PI-Standard** der
Timeline: Ankertag, Ankermonat, Kadenz in Wochen, Anzahl. Daraus entstehen die
PIs. Ein ART tritt einer Timeline bei und übernimmt damit ihren Takt — er trägt
keine eigene Kadenz.

### Das Abschluss-Tor — und warum es zwei Wege gibt

Ein PI abzuschließen heißt zu behaupten, dass ein Zeitraum wirklich zu Ende ist.
Pulse kennt dafür ein Tor mit vier Bedingungen:

| Bedingung                          | Warum                                                                           |
| ---------------------------------- | ------------------------------------------------------------------------------- |
| keine offenen Issues **ohne ROAM** | Ein Risiko, das niemand eingeordnet hat, wandert sonst unbemerkt ins nächste PI |
| System-Demo-Termin gesetzt         | Es gab eine Gelegenheit, das Ergebnis zu zeigen                                 |
| Inspect-&-Adapt-Termin gesetzt     | Es gab eine Gelegenheit, daraus zu lernen                                       |
| Retrospektive-Notizen vorhanden    | Das Gelernte steht irgendwo                                                     |

**Dieses Tor ist heute nur über die API erreichbar.** `POST /api/v1/pis/[id]/complete`
erzwingt es vollständig. In der Oberfläche gibt es genau einen Weg, ein PI zu
beenden: **„PI abschließen & nächstes öffnen"** — und der prüft nur die offenen
ROAM-Issues, und auch die nur als **Warnung**, die nicht blockiert. Die drei
Zeremonien werden dort gar nicht geprüft.

Das ist kein Versehen, sondern eine bewusste Lücke mit einem Grund, der im Code
steht: **es gibt keine Oberfläche, um die drei Termine zu setzen.** Ein Tor, das
niemand öffnen kann, würde den Betrieb anhalten. Wer das Tor scharf haben will,
braucht zuerst die Fläche dafür — bis dahin ist die Warnung die ehrlichere
Variante.

### Wer die drei sind

|                   | Woher die Reichweite kommt                                                                                                                                  |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **RTE**           | Rolle `rte`. Legt PIs an, startet und schreibt fort (`pi.create`, `pi.start`, `pi.advance`). Start und Fortschreiben teilt er sich mit dem Wertstrom-Owner. |
| **Feature Owner** | Rolle `feature_owner`. Setzt den Delivery-Status seiner Features (`feature.delivery.set`) und pflegt die System-Demo (`pi.demo.manage`).                    |
| **Epic Owner**    | Rolle `epic_owner`. Liefert nicht selbst — sein Epic bewegt sich, weil seine Features sich bewegen.                                                         |

---

## Der RTE: die Kadenz führen

Meine Timeline hat einen PI-Standard, und daraus stehen die nächsten PIs schon
im Kalender. Ich muss sie nicht anlegen; ich muss entscheiden, wann eines
**startet**.

Vor dem Start liegt die **PI-Planung**. Auf `/pi-planning` ordne ich Features
den PIs zu und sehe die Kapazität dagegen: Job Size und €-Budget je PI, beides
pro PI überschreibbar, wenn die abgeleitete Zahl nicht passt. Was hier
zugeordnet wird, ist der Inhalt, über den ich gleich sage: das schaffen wir.

Dann **starte** ich das PI. Pulse prüft zweierlei: dass es auf `planned` steht —
ein bereits abgeschlossenes lässt sich nicht erneut starten — und dass in
derselben Timeline nicht schon eines aktiv ist. Das zweite ist die Regel, die
mich am häufigsten trifft, und sie ist richtig so: zwei aktive PIs nebeneinander
hieße, dass niemand mehr sagen kann, in welchem Takt gearbeitet wird.

Ab jetzt lebe ich im **Cockpit** (`/umsetzung`). Es zeigt die Matrix aus PIs und
Features, den Delivery-Status jeder Zeile, und wo es klemmt. Von hier aus arbeite
ich in die Tiefe: `/umsetzung/art/[id]` für einen ART, `/umsetzung/pi/[id]` für
ein PI, `/umsetzung/feature/[id]` für ein einzelnes Feature.

Am Ende schreibe ich die Kadenz fort: **„PI abschließen & nächstes öffnen".** Das
ist eine Transaktion — das laufende PI geht auf `completed`, das nächste öffnet
sich. Existiert kein nächstes, erzeugt Pulse es aus der Kadenz. Gibt es offene
Issues ohne ROAM, sagt Pulse mir das als Warnung; ich kann trotzdem
fortschreiben, aber ich weiß es dann.

Was ich dabei **nicht** bekomme, ist der Anspruch, den das Abschluss-Tor
formuliert: nach System-Demo, Inspect & Adapt und Retrospektive fragt mich hier
niemand. Wer diese Disziplin will, muss sie heute außerhalb von Pulse führen.

---

## Der Feature Owner: liefern

Mein Feature ist einem PI zugeordnet — das hat die PI-Planung entschieden. Für
mich beginnt die Arbeit mit einem Status, der eine Zusage ist:

`approved → in_progress ↔ blocked → completed | cancelled`

**`approved`** heißt: es ist geplant, aber noch nicht angefangen. Mit
**`in_progress`** sage ich, dass jetzt daran gearbeitet wird. **`blocked`** ist
kein Makel, sondern ein Signal — und der Weg zurück nach `in_progress` steht
offen, deshalb der Doppelpfeil. **`completed`** und **`cancelled`** sind die
beiden Enden; das zweite ist eine Entscheidung, keine Niederlage.

Diesen Status setze ich selbst. Er ist die einzige Stelle, an der ich täglich
etwas beitrage — und die Zahl, aus der alles andere abgeleitet wird: die
Fortschrittsanzeige meines Epics, die Auslastung meines ARTs, die Frage, ob das
PI zu ist.

Zum **System Demo** trage ich bei, was ich gebaut habe: die Demo eines PI ist
eine geordnete Liste von Punkten, jeder darf sich auf ein Feature beziehen — der
Verantwortliche wird dann daraus abgeleitet. Es ist die eine Gelegenheit, an der
das Ergebnis eines PI nicht als Status, sondern als Sache gezeigt wird.

Fällt mir dabei etwas auf, das uns aufhält, melde ich es als **Issue**. Wie es
weitergeht, steht in [risk-walkthrough.md](risk-walkthrough.md) — hier zählt
nur: ein gemeldetes, nicht eingeordnetes Issue taucht am PI-Abschluss wieder auf.

---

## Der Epic Owner: zusehen, wie es Gestalt annimmt

Ich liefere in diesem Ablauf nichts. Mein Epic steht auf **L4 · Umsetzung
läuft**, und was jetzt passiert, passiert an meinen Features.

Was ich sehe, ist Ableitung: Pulse zeigt mir, wie viele meiner Child-Features
begonnen und wie viele abgeschlossen sind. Das ist zugleich das Kriterium meines
nächsten Schritts — **L4 → L4.2 · Umsetzung fertig** setzt voraus, dass _alle_
Child-Features abgeschlossen sind. Beratend, nicht blockierend: ich kann den
Antrag auch früher stellen, dann steht die offene Zahl daneben und die Abnehmer
entscheiden.

Der Takt gibt mir dabei etwas, das der Reifegrad allein nicht hätte: einen
**Rhythmus**. Zwischen L4 und L4.2 liegen ein oder mehrere PIs, und jedes davon
hat ein Ende, an dem gezeigt wird, was entstanden ist. Mein Epic bewegt sich
nicht, weil jemand es bewegt, sondern weil ein Zeitraum vergangen ist, in dem
gearbeitet wurde.

---

## Die Nähte

**Zum Epic.** Der Schritt **L4 → L4.2** hängt an den Features des PI: „Alle
Child-Features sind abgeschlossen" ist sein beratendes Kriterium. Der PI liefert
also die Bewegung, die das Epic weiterschiebt — und umgekehrt füllt das Epic den
PI mit Inhalt, denn Features sind Kinder von Epics.

**Zu den Risiken.** Ein offenes Issue **ohne ROAM** ist die einzige Bedingung,
die den PI-Abschluss auch in der Oberfläche berührt — als Warnung. Im vollen Tor
der API blockiert sie. Das macht ROAM zur einzigen Risiko-Handlung mit
unmittelbarer Wirkung auf den Takt; siehe
[risk-walkthrough.md](risk-walkthrough.md).

**Zum Budget** gibt es **keine** direkte Naht — und das ist eine Aussage, keine
Lücke. Geld wird je Halbjahr entschieden, geliefert wird je PI; die beiden
Rhythmen laufen absichtlich nebeneinander. Berührung gibt es nur mittelbar: die
Kapazität eines PI kennt ein €-Budget, und die Last eines ARTs wird über die Job
Size seiner eingeplanten Features in Geld umgerechnet.

---

## Wer welchen Schritt macht

| Schritt                              | Wer                                   | Recht                                   |
| ------------------------------------ | ------------------------------------- | --------------------------------------- |
| PI anlegen, ändern, löschen          | RTE                                   | `pi.create` · `pi.update` · `pi.delete` |
| PI starten                           | RTE, Wertstrom-Owner                  | `pi.start`                              |
| Kadenz fortschreiben (UI-Abschluss)  | RTE, Wertstrom-Owner                  | `pi.advance`                            |
| PI abschließen (volles Tor, nur API) | RTE, Wertstrom-Owner                  | `pi.complete`                           |
| PI-Standard einer Timeline pflegen   | Tenant-Admin, Portfolio Manager       | `pi_standard.manage`                    |
| Timeline anlegen, ART beitreten      | Tenant-Admin, Portfolio Manager       | `timeline.manage`                       |
| Delivery-Status eines Features       | Feature Owner, RTE, Portfolio Manager | `feature.delivery.set`                  |
| System-Demo pflegen                  | RTE, Feature Owner                    | `pi.demo.manage`                        |

## Nachschlagepunkte im Code

| Aussage                                       | Quelle                                                          |
| --------------------------------------------- | --------------------------------------------------------------- |
| Zustände, Übergänge, Abschluss-Tor            | `src/modules/drumbeat/domain/pi-rules.ts`                       |
| Ein aktives PI je Timeline (DB-abhängig)      | `src/modules/drumbeat/server/services/pi.ts` (`startPi`)        |
| Der weiche UI-Abschluss samt Warnung          | `src/modules/drumbeat/server/services/pi.ts` (`advanceCadence`) |
| Das harte Tor (nur über die v1-API)           | `src/modules/drumbeat/server/services/pi.ts` (`completePi`)     |
| Takt aus Ankertag, Kadenz und Anzahl          | `src/modules/drumbeat/domain/pi-standard.ts`                    |
| Delivery-Status eines Features                | `src/modules/work/domain/feature-status.ts`                     |
| Was welche Rolle darf                         | `src/server/auth/policies/index.ts`                             |
| Cockpit-Modell (Matrix, Rechte je Fläche)     | `src/modules/drumbeat/server/views/umsetzung-cockpit-view.ts`   |
| Kriterien der Epic-Schritte (u. a. L4 → L4.2) | `src/modules/work/domain/gate-readiness.ts`                     |
