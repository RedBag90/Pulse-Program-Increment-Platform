# Ein gelebter Prozess — ein Risiko aus drei Perspektiven

Derselbe Weg eines Issues, dreimal erzählt: aus Sicht dessen, der es
**meldet**, dessen, der es **aufnimmt**, und dessen, der es **ROAMt** und damit
den Takt wieder freigibt. Mit den Namen, die Pulse tatsächlich verwendet:
Register, Exposure, ROAM.

Das Schwesterdokument ist [pi-walkthrough.md](pi-walkthrough.md) — dort ist ein
offenes, nicht eingeordnetes Issue die Bedingung, die den PI-Abschluss berührt.
Dieses Dokument erklärt die andere Seite derselben Naht.

Vier Dokumente beschreiben die Abläufe von Pulse und verweisen aufeinander:
[Epic](epic-lifecycle-walkthrough.md) — was gebaut wird ·
[Budget](budgeting-walkthrough.md) — womit ·
[PI](pi-walkthrough.md) — wann geliefert wird ·
[Risiko](risk-walkthrough.md) — was dazwischenkommt. Den Rahmen, in dem sie
stattfinden, führt [Struktur](structure-walkthrough.md) vor.

## Die gemeinsame Mechanik

Pulse führt **ein** tenant-weites Register. Risiken und Impediments waren
einmal zwei Tabellen; sie sind zusammengelegt, weil in der Praxis niemand vorab
sagen kann, ob eine Beobachtung das eine oder das andere ist. Was zählt, ist,
was mit ihr geschieht.

Und das läuft auf **zwei voneinander unabhängigen Achsen** — das ist die eine
Sache, die man verstanden haben muss:

### Achse 1 · Die Prüfung: kommt es ins Register?

`suggested → documented | rejected`

Ein Vorschlag ist noch kein Eintrag. Nur ein `suggested` lässt sich prüfen; die
Entscheidung führt entweder ins Register (`documented`) oder daran vorbei
(`rejected`). Ein einmal geprüfter Eintrag lässt sich nicht erneut prüfen — die
Achse läuft in eine Richtung.

Der Standard eines neu angelegten Issues ist `documented`: wer das Recht hat,
direkt zu dokumentieren, geht nicht durch die Vorschlagsschleife.

### Achse 2 · ROAM: was tun wir damit?

`open → resolved | owned | accepted | mitigated`

**R**esolved (erledigt), **O**wned (jemand kümmert sich), **A**ccepted (wir
leben damit), **M**itigated (abgefedert). `open` ist der Zustand davor:
identifiziert, aber noch nicht eingeordnet.

**Die beiden Achsen greifen nicht ineinander.** Ein Eintrag kann `documented`
und trotzdem `open` sein — das ist sogar der häufigste Zustand kurz nach dem
Anlegen, und genau er ist es, der am PI-Abschluss auftaucht. ROAM und Exposure
gelten nur für dokumentierte Einträge; einen Vorschlag einzuordnen hieße, über
etwas zu entscheiden, das noch niemand angenommen hat.

### Die Exposure

Eine Bewertung, zwei Angaben: **Eintrittswahrscheinlichkeit × Auswirkung**, je
fünfstufig (`very_low … very_high`). Ihr Produkt ist der Score von 1 bis 25, und
der fällt in ein Band:

| Score  | Band     |
| ------ | -------- |
| ≤ 4    | niedrig  |
| ≤ 9    | mittel   |
| ≤ 15   | hoch     |
| bis 25 | kritisch |

Dieselbe Funktion färbt die Zeile in der Liste und die Zelle in der Matrix —
deshalb können die beiden nicht auseinanderlaufen. Eine Bewertung ist optional:
ein Eintrag ohne sie ist ungescored und sortiert ans Ende, statt eine Null zu
behaupten.

Dazu kommen eine optionale **Kategorie** (technisch, fachlich, terminlich,
extern), eine **laufende Nummer** je Mandant als Handhabe im Gespräch, die
Verknüpfung zu einem **Epic oder Feature**, und die Möglichkeit, Einträge unter
einem Kopf-Issue zu bündeln.

Die Bewertungen werden **historisiert**: jede Neubewertung ist eine eigene
Zeile mit Datum und Notiz. Man sieht also nicht nur, wie riskant etwas ist,
sondern wie sich diese Einschätzung entwickelt hat.

### Wer die drei sind

|                  | Woher die Reichweite kommt                                                                           |
| ---------------- | ---------------------------------------------------------------------------------------------------- |
| **Wer meldet**   | `risk.suggest` — **jede** Rolle bis hinunter zum Viewer.                                             |
| **Wer aufnimmt** | `risk.document` / `risk.review` — Portfolio Manager, RTE; der Epic Owner **wertstrom-eingegrenzt**.  |
| **Wer ROAMt**    | `risk.roam` — dieselbe Runde. Diese Handlung ist die einzige mit unmittelbarer Wirkung auf den Takt. |

---

## Wer meldet: es aufschreiben, bevor es vergessen ist

Ich sehe etwas, das uns aufhalten wird. Vielleicht bin ich Feature Owner und
merke, dass eine Schnittstelle nicht rechtzeitig steht; vielleicht bin ich
Viewer und kenne einen Vertrag, der ausläuft.

**Melden darf ich in jedem Fall.** `risk.suggest` liegt bei allen Rollen, bis
zum Viewer hinunter — und das ist Absicht: Beobachtungen sind wertlos, wenn der
Weg, sie loszuwerden, an einer Berechtigung hängt. Wer eine Sache sieht, soll
sie melden können, ohne jemanden zu fragen.

Was ich hinschreibe, ist ein Titel und, wenn ich kann, eine Beschreibung.
Bewerten muss ich nicht — Wahrscheinlichkeit und Auswirkung darf einschätzen,
wer mehr Überblick hat. Was ich beitrage, ist die Beobachtung.

Mein Eintrag steht danach auf **`suggested`**. Er ist im System, aber noch nicht
im Register: er trägt keine Exposure, taucht in der Matrix nicht auf, und er
blockiert auch keinen PI-Abschluss. Er wartet darauf, dass jemand ihn ansieht.

---

## Wer aufnimmt: entscheiden, ob es eine Sache ist

Auf meinem Tisch liegen die Vorschläge. Meine Entscheidung ist binär und
einmalig: **annehmen** (`documented`) oder **ablehnen** (`rejected`). Ein
bereits Geprüftes kann ich nicht noch einmal prüfen — die Achse läuft vorwärts.

Nehme ich an, ist der Eintrag im Register. Jetzt gehört ihm eine **Bewertung**:
Wahrscheinlichkeit und Auswirkung, jeweils fünfstufig. Aus beiden entsteht der
Score und daraus das Band — und erst damit hat der Eintrag ein Gewicht, mit dem
sich arbeiten lässt. Ich kann ihn außerdem **verknüpfen**: mit dem Epic oder
Feature, an dem er hängt, und mit einem Kopf-Issue, wenn mehrere Einträge
dasselbe Thema haben.

Lehne ich ab, verschwindet nichts. Der Eintrag bleibt als `rejected` stehen —
nachvollziehbar, dass jemand ihn gesehen und entschieden hat. Ein Vorschlag, der
spurlos verschwindet, ist ein Grund, beim nächsten Mal nichts mehr zu melden.

Meine Reichweite hängt daran, wo ich stehe: als Portfolio Manager oder RTE gilt
sie mandantenweit, als Epic Owner **nur in meinem Wertstrom**. Das ist dieselbe
Eingrenzung, die auch sonst im Produkt trägt — man entscheidet dort, wo man die
Folgen mitträgt.

---

## Wer ROAMt: den Takt wieder freigeben

Ein dokumentierter Eintrag steht zunächst auf **`open`**: er ist da, er ist
bewertet, aber niemand hat gesagt, was daraus wird. Genau dieser Zustand ist
der, der zurückkommt.

Meine Aufgabe ist die Einordnung — vier Möglichkeiten, und keine davon heißt
„ignorieren":

- **Resolved** — erledigt, die Ursache ist weg.
- **Owned** — jemand kümmert sich, mit Namen.
- **Accepted** — wir leben damit, bewusst.
- **Mitigated** — abgefedert; dazu gehören die Maßnahmen, die am Eintrag hängen.

Das ist die Handlung mit der unmittelbarsten Wirkung im ganzen Produkt: **ein
offenes, nicht eingeordnetes Issue über die ARTs einer Timeline meldet sich beim
PI-Abschluss zurück.** Im vollen Tor der API blockiert es, in der Oberfläche
warnt es. In beiden Fällen ist es genau ein Satz — _„n offene Issue(s) ohne
ROAM"_ —, und der verschwindet nur, wenn jemand entscheidet.

Bemerkenswert ist, was das nicht ist: keine Aufforderung, das Risiko zu lösen.
`accepted` genügt. Verlangt wird nicht die Beseitigung, sondern die
**Entscheidung** — dass ein Zeitraum nicht endet, ohne dass jemand zu jedem
offenen Punkt Stellung genommen hat.

---

## Die Nähte

**Zum PI.** Die einzige harte Verbindung: offene Issues ohne ROAM über die ARTs
einer Timeline gehen in die Abschlussprüfung des PI ein. Siehe
[pi-walkthrough.md](pi-walkthrough.md) — dort dieselbe Naht von der anderen
Seite.

**Zum Epic und zum Feature.** Ein Eintrag kann an einer Initiative hängen. Auf
der Epic-Seite werden die Risiken des ganzen Feature-Teilbaums aufgerollt: man
sieht am Epic, was unter ihm liegt, ohne es einzeln zu suchen.

**Zum Portfolio.** Die Übersicht zeigt die dokumentierten, nicht erledigten
Einträge nach Kritikalität — die einzige Stelle, an der Risiken aus dem Register
in die Steuerungssicht treten.

---

## Wer welchen Schritt macht

| Schritt                          | Wer                                                      | Recht           |
| -------------------------------- | -------------------------------------------------------- | --------------- |
| Melden (Vorschlag anlegen)       | jede Rolle, bis zum Viewer                               | `risk.suggest`  |
| Vorschlag annehmen oder ablehnen | Portfolio Manager, RTE; Epic Owner wertstrom-eingegrenzt | `risk.review`   |
| Direkt ins Register anlegen      | dieselben                                                | `risk.document` |
| Bewerten und ändern              | dieselben                                                | `risk.update`   |
| ROAM setzen                      | dieselben                                                | `risk.roam`     |
| Mit Epic/Feature verknüpfen      | dieselben                                                | `risk.link`     |
| Löschen                          | **nur** Portfolio Manager — enger als das Ändern         | `risk.delete`   |

## Nachschlagepunkte im Code

| Aussage                                         | Quelle                                             |
| ----------------------------------------------- | -------------------------------------------------- |
| Prüf-Achse und ihre einzige legale Richtung     | `src/modules/risks/domain/risk-review.ts`          |
| ROAM-Zustände                                   | `src/modules/core/kernel/domain/roam.ts`           |
| Exposure: Score, Bänder, Farbe                  | `src/modules/risks/domain/risk-matrix.ts`          |
| Kategorien                                      | `src/modules/risks/domain/risk-category.ts`        |
| Aufrollen über den Feature-Teilbaum eines Epics | `src/modules/risks/domain/issue-subtree-rollup.ts` |
| Bündelung unter einem Kopf-Issue                | `src/modules/risks/domain/issue-tree.ts`           |
| Laufende Nummer je Mandant                      | `src/modules/risks/domain/risk-number.ts`          |
| Was welche Rolle darf                           | `src/server/auth/policies/index.ts`                |
| Die Wirkung auf den PI-Abschluss                | `src/modules/drumbeat/server/services/pi.ts`       |
