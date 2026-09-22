# Ein gelebter Prozess — die Wirkung

Ob das Ziel erreicht wird, und woran man das sieht. Dreimal erzählt: aus Sicht
des **Epic Owners**, der die KPI definiert und misst, der **Finance**, die
sagt, was eine Einheit wert ist, und des **Ziel-Owners**, der eincheckt und
zusieht, wie die Zahlen nach oben rollen.

Dies schließt den Kreis, den [Aufbau](portfolio-setup-walkthrough.md) mit dem
Kopfziel öffnet. Dort wird verabredet, was erreicht werden soll; hier wird
gemessen, ob es passiert.

Elf Dokumente beschreiben die Abläufe von Pulse und verweisen aufeinander:
[Mandant](tenant-onboarding-walkthrough.md) — wer hereinkommt und was er darf ·
[Aufbau](portfolio-setup-walkthrough.md) — woraus alles besteht ·
[Intake](epic-intake-walkthrough.md) — wie eine Idee hereinkommt ·
[Halbjahr](portfolio-cycle-walkthrough.md) — wie der Takt schlägt ·
[Epic](epic-lifecycle-walkthrough.md) — was gebaut wird ·
[Budget](budgeting-walkthrough.md) — womit ·
[ART-Budget](art-epic-budget-walkthrough.md) — womit, wenn es klein ist ·
[PI](pi-walkthrough.md) — wann geliefert wird ·
[Lieferung](delivery-walkthrough.md) — was liefert und was blockiert ·
[Wirkung](benefit-walkthrough.md) — ob es etwas gebracht hat ·
[Risiko](risk-walkthrough.md) — was dazwischenkommt. Den Rahmen führt
[Struktur](structure-walkthrough.md) vor.

## Die gemeinsame Mechanik

### Zwei Achsen, und sie gehören verschiedenen Leuten

Ein Epic kann auf **zwei unabhängigen Achsen** über- oder unterliefern, und
beide bedeuten etwas anderes:

| Achse     | Was sie sagt                                 | Wem sie gehört | Wann sie feststeht      |
| --------- | -------------------------------------------- | -------------- | ----------------------- |
| **Menge** | wie weit die KPI ihr Ziel erreicht hat       | dem Epic Owner | friert mit **L4.2**     |
| **Wert**  | mit welchem Faktor eine Einheit in Geld wird | der Finance    | korrigierbar bis **L5** |

Die Trennung ist der ganze Punkt. **Menge** friert mit der Abnahme „die
Umsetzung ist fertig": was gebaut ist, ist gebaut, und ein projizierter Rest
wäre eine Behauptung ohne Grundlage. **Wert** bleibt offen, weil sich erst nach
der Umsetzung zeigt, ob eine Einheit wirklich so viel wert war — und eine
Korrektur wirkt **rückwirkend** auf die ganze Ist-Rechnung.

> **Ohne obere Deckelung.** Unter 100 % verfällt der Rest, über 100 % zählt er
> voll. Wer mehr liefert als versprochen, bekommt es angerechnet.

### Der Plan entsteht mit der Business-Case-Freigabe

Vor **L2** gibt es keinen Plan-Bezug: jede Änderung am Faktor ist zugleich der
Plan. Mit der Freigabe wird er festgehalten, und ab da ist „Plan gegen Ist" eine
Aussage statt einer Tautologie. Die Fläche sagt das an, solange es fehlt:

> „Kein Plan-Bezug — festgehalten wird er mit der Freigabe des Business Case
> (Analyse → L2). Bis dahin ist jede Änderung des Faktors sofort auch der Plan."

### Die Richtung steckt im Vorzeichen

Es gibt **kein Richtungs-Feld**. Ob eine KPI steigen oder fallen soll, ergibt
sich aus dem Vorzeichen von `Ziel − Baseline`: Durchlaufzeit 10 → 6 und NPS
40 → 80 funktionieren beide, weil der Nenner das Vorzeichen trägt. Wer eine KPI
anlegt, trägt „heute" und „das Ziel" ein — mehr braucht es nicht.

### Wer die drei sind

| Wer                             | Was er tut                                      | Recht                          |
| ------------------------------- | ----------------------------------------------- | ------------------------------ |
| **Epic Owner**                  | KPI anlegen, gewichten, Messwerte erfassen      | `epic.update`                  |
| **Finance / Portfolio Manager** | den Wert je Einheit setzen, den Impact abnehmen | `kpi.bind`, `epic.gate.decide` |
| **Ziel-Owner**                  | einchecken, kommentieren, den Baum pflegen      | `target.manage`                |

> **Ein Befund, der hierher gehört.** Check-in **und** Kommentar hängen beide an
> `target.manage`. Ein Epic Owner, RTE oder Feature Owner kann auf einem Ziel
> also weder einchecken noch kommentieren — **auch nicht auf einem Ziel, zu dem
> sein eigenes Epic beiträgt.** Ob das so gewollt ist, steht nirgends; im Code
> gibt es dazu keinen Kommentar.

---

# 1 · Der Epic Owner

Meine Frage lautet: **woran misst man, ob mein Vorhaben etwas bewirkt hat?**

## Die KPI

Im Reiter **KPIs** meines Epics lege ich an, woran der Erfolg hängt: ein Name,
eine **Baseline** („heute"), ein **Ziel**, eine Einheit. Ein Gewicht kann ich
setzen — leer heißt „auto", dann teilen sich die KPIs gleichmäßig auf.

Die Karte zeigt danach den Ist-Wert groß, darunter `Baseline … → Ziel …` und
den Anteil am Gesamtnutzen.

**Das alles hängt an `epic.update`, nicht an `kpi.bind`.** Die KPI zu führen ist
Autorenarbeit am eigenen Epic.

## Die Verknüpfung zum Ziel

Erst die Verbindung macht aus der KPI einen Beitrag. Sie trägt **zwei
verschiedene Handlungen in einer Aktion**, und Pulse unterscheidet sie seit
September 2026:

| Handlung                       | Was sie bedeutet                                                                                              | Recht         |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------- | ------------- |
| **Blankes Anhängen**           | „dieses Vorhaben zahlt auf jenes Ziel ein" — Teil des Vorschlags, den der VMO bei L0 → L1 bestätigt           | `epic.update` |
| **Bezifferten Beitrag binden** | eine KPI, ein Umrechnungsfaktor, eine Wirkungsart — diese Zahl rollt in den Ziel-Baum und ist eine **Zusage** | `kpi.bind`    |

> **Warum die Trennung nötig war.** Vorher verlangten beide `kpi.bind`, und das
> hat nur der Portfolio Manager. Ein Epic Owner konnte sein Epic anlegen, aber
> nicht sagen, worauf es einzahlt: die Fläche bot ihm das Feld an, und die
> Aktion antwortete „Insufficient permissions" — **nachdem das Epic bereits
> stand.**

## Messen

**„Messwert erfassen"** — ein Wert, ein Datum. Die Messreihe hängt als
chronologische Liste an der KPI, und die Karte zeichnet daraus eine
Mini-Trendlinie mit markiertem letztem Punkt. Darunter der Abschnitt
**Verlauf**.

Was danach in der Zeile steht, ist die Zerlegung aus der Mechanik oben:

```
Plan (bei Freigabe)     120.000 € /Jahr
Ist  (festgeschrieben)  138.000 € /Jahr · 115 %
Menge (Zielerreichung)  +18.000 € /Jahr
Wert  (Umrechnungsfaktor)        0 € /Jahr
```

„(festgeschrieben)" erscheint, sobald L4.2 abgenommen ist — mit dem Tooltip
„Die Umsetzung ist abgenommen (L4.2) — die gelieferte Menge steht fest."

Solange nichts gemessen ist, steht dort **„noch nicht gemessen"**. Das ist eine
Auskunft, keine Null.

---

# 2 · Finance

Meine Frage lautet: **was ist eine Einheit wert, und wann glaube ich es?**

## Der Wert je Einheit

Ich hinterlege am Ziel-Link einen **Wert je Einheit** in der natürlichen Einheit
der KPI — Euro je eingespartem Tag, Euro je gewonnenem NPS-Punkt. Daraus
rechnet Pulse beides: den Euro-Wert der aktuellen Bewegung und, fürs Anzeigen,
den äquivalenten „Euro je Prozentpunkt der Ziel-Lücke". Mathematisch dieselbe
Zahl, zwei Lesarten.

Dazu zwei Angaben, die die Ökonomie steuern:

| Angabe                              | Werte                    | Wirkung                                                       |
| ----------------------------------- | ------------------------ | ------------------------------------------------------------- |
| **Benefit-Art**                     | `one_time` · `recurring` | einmalig realisiert, oder als laufende Run-Rate               |
| **Intervall** (nur bei `recurring`) | `monthly` · `yearly`     | monatlich direkt, jährlich verteilt auf ein Zwölftel je Monat |

Beide haben einen Standard, der das Altverhalten bewahrt: **wiederkehrend,
jährlich**. Wer nichts angibt, bekommt genau das, was Bestands-KPIs schon immer
gerechnet haben.

## Die Abnahme des Impacts

Der letzte Reifegrad-Schritt, **L5**, ist meiner allein. Bis dahin darf ich den
Faktor korrigieren — und die Korrektur wirkt **rückwirkend** auf die ganze
Ist-Rechnung. Die **Menge** kann ich nicht mehr bewegen; die steht seit L4.2.

Das ist die saubere Arbeitsteilung: der Epic Owner verantwortet, **was
geliefert wurde**, ich verantworte, **was es wert war**.

## Das Dashboard

`/portfolio/dashboard` — „Wirtschaftlichkeit über Zeit — Kosten, Business
Value, ROI und Break-even je Epic."

Sieben Tafeln auf einer gemeinsamen Monatsachse:

| Tafel                                 | Was sie zeigt                                                         |
| ------------------------------------- | --------------------------------------------------------------------- |
| **Benefit Velocity**                  | Business Value je Monat; die Linie ist der **kostenneutrale Betrieb** |
| **Cost Distribution**                 | Kosten je Monat, gestapelt nach wählbarer Dimension                   |
| **ROI**                               | Business Value gegen Kosten je Monat                                  |
| **Break Even Analyse**                | der Monat, in dem es kippt — oder „Kein Break-even im Zeitraum"       |
| **Gained Value Analyse**              | kumulierter Business Value                                            |
| **Cost Analysis**                     | kumulierte Kosten                                                     |
| **Positiver und Negativer Cash-Flow** | laufender Saldo, negativ unter, positiv über der Null-Linie           |

Drei Rechenregeln muss man kennen, um die Kurven zu lesen:

- Die **geschätzten Kosten** (Σ Kostenscheiben) fallen tageweise gewichtet im
  Umsetzungsfenster **L4.1 → L4.2** an. Eine Zuteilung übersteuert sie.
- **Go-live** = Kostenstart + (Anzahl Scheiben × 6 Monate). Dort landet der
  einmalige Nutzen.
- Der **wiederkehrende Nutzen** läuft ab Go-live bis zum Horizont-Ende, ein
  Zwölftel des Jahreswerts je Monat.

## Der Benefit-Wasserfall

Die zweite Sicht auf dasselbe Geld, aber gegen den **Zielwert** eines Ziels:
„Wie viel Value steckt heute in jeder Spalte — und wie viel fehlt bis zum
aufgestellten Zielwert?"

Bewertet wird **reifegradabhängig**, in drei Bändern:

| Band           | Welche Epics           | Womit sie zählen                                   |
| -------------- | ---------------------- | -------------------------------------------------- |
| `estimate`     | frühe                  | mit ihrem geschätzten Zielbeitrag                  |
| `achieved_gap` | in laufender Umsetzung | mit dem gemessenen Anteil, plus gestricheltem Rest |
| `actual`       | fertige                | mit dem tatsächlichen Wert                         |

Die **Dimension** ist frei wählbar — Reifegrad-Status, Wertstrom, ART, Epic. Sie
bestimmt nur, in welcher Spalte ein Epic landet; die Ist-/Forecast-Semantik
bleibt dieselbe. Alle Beträge stehen bereits **in der Einheit des Ziels**; die
Umrechnung über den Faktor passiert vorher.

---

# 3 · Der Ziel-Owner

Meine Frage lautet: **wo stehen wir, und was sage ich den anderen?**

## Der Check-in

Ein Check-in ist **eine** Handlung, die mehreres auf einmal festhält:

| Feld            | Was es tut                                                                                 |
| --------------- | ------------------------------------------------------------------------------------------ |
| **Status**      | On track · At risk · Off track — oder ein Abschluss: Achieved · Partial · Missed · Dropped |
| **Fortschritt** | die Zahl                                                                                   |
| **Ist-Wert**    | bei manuellen Key Results der neue Messwert                                                |
| **Notiz**       | freier Text                                                                                |
| **Sektionen**   | strukturierte Abschnitte des Status-Updates                                                |
| **Datum**       | setzt den Punkt im Verlaufsgraphen — nicht zwingend heute                                  |

Daneben gibt es die **schmale Variante**: nur Zahl und Datum, ohne
Statusaussage. Sie erzeugt einen neutralen Punkt im Graphen. Und den
**Kommentar**, bis 2000 Zeichen. Alle drei laufen in denselben Aktivitäts-Feed.

> Dass ich das Datum wählen kann, ist wichtiger, als es klingt: ein Check-in,
> der eine Woche zu spät geschrieben wird, gehört trotzdem an die Stelle, an der
> er gemeint war. Sonst verzerrt sich jede Verlaufskurve nach rechts.

## Woher der Fortschritt kommt

Das ist beim Anlegen entschieden worden — die drei Quellen stehen im
[Aufbau](portfolio-setup-walkthrough.md). Hier zählt, was sie im Betrieb
bedeuten:

- **Manuell** — ich pflege den Wert. Der Check-in ist die Pflege.
- **Aus Unterzielen** — gewichteter Durchschnitt der Kinder. Meine eigene
  Metrik wird ignoriert; mein Check-in trägt dann nur Status und Notiz.
- **KPI-Baum** — als Blatt zieht das Ziel seinen Ist aus den verknüpften
  Epic-KPIs (Δ × Faktor); als Ast kaskadiert es die Werte seiner Unterziele
  hoch.

Ein Unterziel kann ich vom automatischen Rollup **ausnehmen** — es bleibt
sichtbar, zählt aber nicht in den Durchschnitt. Ebenso kann ich ein
**verantwortliches Team** setzen.

## Die Kaskade

Der Umrechnungsfaktor zwischen Unterziel und Kopfziel
(`parentUnitPerChildUnit`) ist die Einheiten-Brücke: „1 Transaktion/s =
8.000 €". Er ist **nicht** derselbe wie der Faktor am Ziel-Link zum Epic; die
Verwechslung ist eingebaut und in [Aufbau](portfolio-setup-walkthrough.md)
benannt.

Zusammen ergeben sie eine Kette, die von einem gemessenen Epic-KPI-Wert bis zum
Kopfziel durchrechnet:

```
Messwert am Epic-KPI
   × Umrechnungsfaktor (kpi.bind)      → Beitrag in Ziel-Einheiten
   × parentUnitPerChildUnit            → Beitrag in Eltern-Einheiten
   × Gewicht im Rollup                 → Anteil am Fortschritt des Elternziels
```

**Related work** — Features und PIs am Ziel — ist ausdrücklich **kein**
Wertbeitrag, sondern nur ein Deeplink. Wer dort etwas verknüpft, bewegt keine
Zahl.

---

## Die Nähte

**Zum Epic.** L4.2 friert die Menge, L5 nimmt den Impact ab. Beide Tore stehen
in [Epic](epic-lifecycle-walkthrough.md); hier steht, was sie mit den Zahlen
machen.

**Zum Aufbau.** Kopfziel, Unterziele, Fortschrittsquelle und die beiden
Umrechnungsfaktoren werden dort angelegt. Dieses Dokument beschreibt, was danach
mit ihnen passiert.

**Zum Budget.** Die Kostenseite des Dashboards sind die Kostenscheiben des
Business Case, tageweise über das Umsetzungsfenster verteilt — es sei denn, eine
Zuteilung übersteuert sie. Woher die Zuteilung kommt, steht in
[Budget](budgeting-walkthrough.md).

## Sätze, die naheliegen und nicht stimmen

| Satz                                                          | Warum er nicht stimmt                                                                   |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| „Über 100 % Zielerreichung wird gekappt."                     | Es gibt keine obere Deckelung. Unter 100 % verfällt der Rest, über 100 % zählt er voll. |
| „Nach L4.2 ist die Rechnung fertig."                          | Nur die **Menge**. Der **Wert** bleibt bis L5 korrigierbar — und wirkt rückwirkend.     |
| „Eine KPI braucht eine Richtungsangabe."                      | Die Richtung steckt im Vorzeichen von `Ziel − Baseline`.                                |
| „KPIs pflegen verlangt `kpi.bind`."                           | Nein — `epic.update`. `kpi.bind` regelt nur die Brücke KPI → Key Result.                |
| „Wer ein Epic anlegen darf, darf es auch an ein Ziel binden." | Anhängen ja, **beziffern** nein. Das ist seit September 2026 getrennt.                  |
| „Plan gegen Ist gilt von Anfang an."                          | Der Plan-Bezug entsteht mit L2. Davor ist jede Faktor-Änderung zugleich der Plan.       |
| „Wiederkehrender Nutzen ist immer jährlich."                  | Standard ja, aber `monthly` gibt es — dann zählt der Periodenwert direkt je Monat.      |
| „Ein Check-in trägt immer das heutige Datum."                 | Das Datum ist wählbar und setzt den Punkt im Graphen.                                   |
| „Related work am Ziel zählt in den Fortschritt."              | Es ist ein Deeplink, kein Wertbeitrag.                                                  |
| „Der Epic Owner kann auf seinem Ziel einchecken."             | Check-in und Kommentar hängen an `target.manage`.                                       |

## Wer welchen Schritt macht

| Schritt                                                       | Wer                                                            | Recht                      |
| ------------------------------------------------------------- | -------------------------------------------------------------- | -------------------------- |
| KPI anlegen, gewichten, löschen                               | Epic Owner, Portfolio Manager, Wertstrom-Owner (scoped)        | `epic.update`              |
| Messwert erfassen                                             | dieselben                                                      | `epic.update`              |
| Epic an ein Ziel **anhängen**                                 | dieselben                                                      | `epic.update`              |
| Einen **bezifferten** Beitrag binden (Faktor, Art, Intervall) | Portfolio Manager / Admin                                      | `kpi.bind`                 |
| Impact abnehmen (L5)                                          | Finance                                                        | `epic.gate.decide`         |
| Check-in, Fortschritt, Kommentar                              | Portfolio Manager / Admin; Wertstrom-Owner in seinem Wertstrom | `target.manage`            |
| Unterziel aus dem Rollup nehmen, Team setzen                  | dieselben                                                      | `target.manage`            |
| Custom-Field-**Werte** setzen                                 | dieselben                                                      | `target.manage`            |
| Custom-Field-**Definitionen**                                 | Tenant-Admin                                                   | `goal.custom_field.manage` |

## Nachschlagepunkte im Code

| Aussage                                               | Quelle                                                                             |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Die zwei Achsen, Einfrieren bei L4.2, keine Deckelung | `src/modules/core/kpi/domain/kpi-outcome.ts`                                       |
| Wert je Einheit, beide Lesarten                       | `src/modules/core/kpi/domain/kpi-valuation.ts`                                     |
| Richtung aus dem Vorzeichen                           | `src/modules/core/kpi/domain/kpi-direction.ts`                                     |
| Einmalig gegen wiederkehrend                          | `src/modules/core/kpi/domain/kpi-benefit-kind.ts`                                  |
| Monatlich gegen jährlich                              | `src/modules/core/kpi/domain/kpi-recurring-interval.ts`                            |
| Die Messreihe                                         | `src/modules/core/kpi/domain/kpi-measurement.ts`, `kpi.ts`                         |
| Anhängen gegen Beziffern                              | `src/modules/core/goals/domain/epic-link-access.ts`                                |
| Check-in, Fortschritt, Kommentar                      | `src/modules/core/goals/features/actions/ziele.ts`                                 |
| Die sieben Ziel-Status                                | `src/modules/core/goals/domain/goal-status.ts`                                     |
| Rollup, Gewicht, Ausnahme                             | `src/modules/core/goals/domain/goals-rollup.ts`                                    |
| Der Beitrag eines Epics zu einem Ziel                 | `src/modules/core/goals/domain/epic-contribution.ts`                               |
| Die Monatsachse, Break-even, Cash-Flow                | `src/modules/work/domain/portfolio-economics.ts`                                   |
| Kosten- und Nutzenfluss je Epic                       | `src/modules/work/domain/epic-flows.ts`                                            |
| Der Wasserfall und seine drei Bänder                  | `src/modules/work/domain/goal-benefit-waterfall.ts`                                |
| Der KPI-Reiter am Epic                                | `src/modules/work/features/portfolio/components/epic-kpis-tab.tsx`                 |
| Die sieben Tafeln des Dashboards                      | `src/modules/work/features/portfolio/components/dashboard/portfolio-dashboard.tsx` |
| Was welche Rolle darf                                 | `src/server/auth/policies/index.ts`                                                |
