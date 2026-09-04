# Eine Führung durch den Bereich Struktur

Dies ist **kein** „gelebter Prozess" wie die fünf Schwesterdokumente — und das
ist Absicht. [Epic](epic-lifecycle-walkthrough.md),
[Budget](budgeting-walkthrough.md), [ART-Budget](art-epic-budget-walkthrough.md),
[PI](pi-walkthrough.md) und [Risiko](risk-walkthrough.md) erzählen
Abläufe: etwas beginnt, wandert durch Zustände, endet. Die Struktur wandert
nicht. Sie ist der Rahmen, in dem sie stattfinden — Wertströme, ARTs,
Solutions und die Menschen, die dafür geradestehen.

Deshalb ist dies eine **Führung durch eine Fläche**, kein Durchlauf über Rollen.
Ein Format zu erzwingen, das nicht passt, hätte nur einen künstlichen Ablauf
erfunden.

Die Konzeptdokumente dahinter sind
[epic-class-filter.md](epic-class-filter.md) und
[art-epics.md](art-epics.md); dieses hier wiederholt sie nicht, sondern zeigt,
wo man das Beschriebene antrifft.

## Was hier lebt

```
Struktur
├── Organisation   der Baum und die Knoten dahinter
├── Solutions      die flache Liste über alle Wertströme
└── Timelines      die PI-Kadenz
```

Der Bereich steht **vor** Portfolio, und das ist eine Aussage: erst die
Organisation, dann was sie tut. Bis September 2026 hing die Struktur unter
„Setup", zwischen dem Einrichtungs-Leitfaden und den Timelines — als wäre sie
etwas, das man einmal macht und dann liegen lässt.

## Der Baum

Drei Ebenen, links, stehend:

```
Wertstrom Produktion
├── ART Plant Efficiency (OEE)
│   └── Solution Produktion Betrieb
├── ART Materials & Energy
└── Solution Produktion Pilot        ← ohne ART: direkt am Wertstrom
```

Eine Solution trägt **immer** einen Wertstrom, aber nur **optional** einen ART.
Die ohne hängen deshalb eine Ebene höher, statt zu verschwinden — im Baum darf
nichts unauffindbar sein.

Zwei Eigenschaften, die man beim Bedienen merkt:

- **Der Baum bleibt stehen.** Er lebt in einem Layout, nicht in jeder Seite:
  beim Wechsel von Knoten zu Knoten und von Reiter zu Reiter wird er nicht neu
  gerendert. Aufklapp-Zustand und Scroll-Position überleben, und er lädt einmal
  statt bei jedem Klick.
- **Wertströme klappen ein.** Offen ist der Zweig, der den gewählten Knoten
  enthält. Beim Suchen wird flach gezeigt, was passt — sonst versteckte die
  Einklappung genau den Treffer.

Ein Knoten ist eine **Route**, kein Query-Parameter
(`/structure/value-stream/…`, `/structure/art/…`, `/structure/solution/…`), und
die Reiter sind **Links** mit `?tab=`. Damit funktionieren Zurück-Taste,
Lesezeichen und geteilte Links. Ohne `?tab=` öffnet der zuletzt genutzte Reiter
— gemerkt in einem Cookie, je Knotenart eine Ablage, weil Wertstrom und ART
verschiedene Reiter haben. Ein Link **mit** `?tab=` schlägt diese Erinnerung
immer; sie gilt je Browser, nicht je Konto.

## Ein Wertstrom

`Allgemein · Budget · Guardrails · Betrieb · Solutions · Verlauf`

**Allgemein** trägt, wofür jemand geradesteht: Name, Beschreibung,
Finance-Approver, Portfolio Manager — als Formular, wo die Rechte es zulassen,
sonst als Definitionsliste. Dieselbe Fläche zeigt die **Freigabe-Regeln**: wer
je Reifegrad-Schritt zeichnet. Auch das Löschen sitzt hier.

**Budget · Guardrails · Betrieb** waren bis zum Umbau _ein_ Reiter mit fünf
Abschnitten. Das waren drei Fragen in einem Topf, und sie sind jetzt getrennt:

| Reiter         | Die Frage                                                                                              |
| -------------- | ------------------------------------------------------------------------------------------------------ |
| **Budget**     | Wie viel Geld ist da, und wie verteilt es sich auf die ARTs?                                           |
| **Guardrails** | Welche Regeln gelten — Kapazitätsmix, Portfolio-Limit, und was das für die anstehenden Epics bedeutet? |
| **Betrieb**    | Was kostet der laufende Betrieb, und wie groß sind die ART-Epic-Budgets der ARTs?                      |

**Solutions** listet, was zu diesem Wertstrom gehört, mit Horizont und
ART-Zuweisung. **Verlauf** ist die Audit-Historie.

## Ein ART

`Allgemein · Budget · Solutions · Verlauf`

**Der Budget-Reiter bleibt hier einer** — anders als beim Wertstrom. Deckung,
Rahmen, Verlauf und Aufteilung beantworten eine einzige Frage: _reicht mein Geld
für meine Last?_ Sie zu zerschneiden nähme ihnen den Zusammenhang. Das ist die
Fläche, für die der ganze ART-Epic-Budget gebaut wurde: hier sieht ein RTE seine Last,
seinen Rahmen und seinen Rest, und hier wird auf ART-Epics verteilt.

**Allgemein** zeigt Name, Beschreibung, RTE — und die **Timeline** als Feld mit
Link. Eine eigene PI-Kadenz trägt der ART nicht mehr: der Takt entsteht am
PI-Standard der Timeline, der ART tritt ihr bei. Zwei Kadenzen nebeneinander
hätten einander widersprechen können, und eine davon berechnete nichts.

**Solutions** zeigt die diesem ART zugewiesenen und bietet die übrigen des
eigenen Wertstroms zum Zuweisen an. **Wertstrom-fremd geht nicht** — auf der
Zuordnung Solution→Wertstrom rechnen Run-Kosten und Horizont.

## Eine Solution

Der **Produkt-Manager** ist das Feld, das den Unterschied macht: ein freies
Personenfeld ohne Rollenbindung, weil Produktverantwortung nicht mit einer
SAFe-Rolle zusammenfällt. Fehlt die Benennung, steht dort derselbe
bernsteinfarbene Hinweis wie bei einem ART ohne RTE.

Er ist keine Beschriftung. Drei Dinge hängen daran:

1. Er **darf seine Solution bearbeiten** — Horizont, Beschreibung,
   ART-Zuweisung — auch ohne die allgemeine Solution-Berechtigung.
2. Er **zeichnet bei Reifegrad-Freigaben mit**: am Business Case (→ L3.1) bei
   jedem Epic seiner Solution, am Start der Umsetzung (→ L4) nur bei ART-Epics.
   Ist keiner benannt, fällt er still weg — der Antrag läuft wie zuvor.
3. Er **darf Geld aus dem ART-Epic-Budget zuteilen** — aber nur den Epics
   **seiner** Solution. Der Rahmen gehört dem ART, die Verantwortung für das
   Vorhaben ihm; deshalb hängt dieses Recht am Epic, nicht am Topf. Auf der
   Verteilfläche des ARTs sieht er alle Zeilen, bedienen kann er seine eigenen.

Der zweite und dritte Punkt sind der Grund für den ersten: Verantwortung ohne
Handlungsmöglichkeit wäre eine leere Zuschreibung.

## Wer was sieht

Zwei Regeln, die man kennen muss, weil sie zwei Nutzern **verschiedene** Flächen
zeigen.

**Das Geld.** Bis zum Umbau war nur das Modul geschützt, nicht die Rolle: wer
die Wertstrom-Seite öffnete, sah den Budget-Plan. Jetzt tragen die Geld-Reiter
ein eigenes Recht:

- die Rollen **oberhalb des Epic Owners** — Tenant-Admin, Portfolio Manager,
  Wertstrom-Owner;
- der **RTE auf seinem ART** — er soll seine Last und sein Restbudget selbst
  managen, dafür ist die Fläche gebaut;
- die **Finance-Partei des Wertstroms**, über den Service-Seam, ohne dafür eine
  Rolle zu brauchen.

Epic Owner, Feature Owner und Viewer sehen die Geld-Reiter nicht — und seit die
Budget-Summe aus dem Baum verschwunden ist, auch keine Teilzahl.

**Der eigene Bereich.** Der **Baum zeigt alles**: Orientierung über die eigene
Grenze hinaus ist nötig, sonst versteht niemand Abhängigkeiten. Die **Fläche**
eines fremden Knotens zeigt dagegen nur _Allgemein_, schreibgeschützt, mit einem
Satz, der es sagt — nicht nur einem Schloss-Symbol.

Der Fall, an dem sich diese Regel entscheidet, ist der RTE: sein ART liegt in
einem Wertstrom, den er nicht „besitzt". Ihn davon auszusperren hieße, ihn aus
dem Kontext auszusperren, in dem er arbeitet. Deshalb gilt ein Wertstrom als
offen, sobald einer **seiner ARTs** im Bereich des Betrachters liegt.

## Die Nähte

**Zum Epic.** Das Portfolio-Limit eines Wertstroms steht im Guardrails-Reiter —
es entscheidet, ob ein Epic Portfolio- oder ART-Sache wird. Die
Klassifikations-Vorschau dort zeigt, wie die anstehenden Epics fallen würden.

**Zum Budget.** Der ART-Epic-Budget entsteht im Betrieb-Reiter des Wertstroms
als Run-the-Business-Position und wird über die PB-Liste festgeschrieben; verteilt
wird er im Budget-Reiter des ARTs. Zwei Flächen, ein Topf.

**Zum PI.** Die Timeline am ART ist die Verbindung zum Takt: sie trägt den
PI-Standard, aus dem die PIs entstehen.

## Nachschlagepunkte im Code

| Aussage                                          | Quelle                                                                   |
| ------------------------------------------------ | ------------------------------------------------------------------------ |
| Der Baum inkl. Solutions als dritter Ebene       | `src/modules/core/org/server/views/structure-page.ts`                    |
| Adressen der Knoten, aktiver Knoten aus dem Pfad | `src/modules/core/org/features/structure/components/structure-routes.ts` |
| Wer einen fremden Knoten öffnen darf             | `src/modules/core/org/domain/structure-access.ts`                        |
| Wer die Geld-Reiter sieht (`budget.read`)        | `src/server/auth/policies/index.ts`                                      |
| Produkt-Manager als Freigabe-Platzhalter         | `src/modules/work/domain/gate-policy.ts`                                 |
| Produkt-Manager am ART-Epic-Budget               | `src/modules/budgeting/domain/art-pot-access.ts`                         |
| Die Einordnung eines Epics                       | `src/modules/work/domain/pb-submission.ts`                               |
| ART-Epic-Budget und Zuteilung                    | `src/modules/budgeting/server/services/art-pot.ts`                       |
| Modul-Gating der Unterpfade                      | `src/modules/core/kernel/domain/modules.ts`                              |
