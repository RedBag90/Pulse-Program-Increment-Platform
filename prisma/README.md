# Seeds

Fünf Einstiegspunkte, fünf Zwecke. Alle laufen über einen **rohen** Prisma-Client auf
`DIRECT_URL` (Port 5432, nicht den 6543-Pooler) und legen Konten über die Supabase-Admin-API
an — sie brauchen also `.env.local` mit `DIRECT_URL`, `NEXT_PUBLIC_SUPABASE_URL` und
`SUPABASE_SERVICE_ROLE_KEY`.

| Befehl                     | Mandant          | Inhalt                                                                                                                                                                 |
| -------------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm db:seed`             | Pulse Demo Corp  | Nur Konten, Mandant, Rollen — leere Fachdaten                                                                                                                          |
| `pnpm db:seed:demo`        | Pulse Demo Corp  | Dichter Story-Datensatz: 3 Wertströme, 6 ARTs, 2 Timelines, 20 Epics, 44 Features, Ziele, Budget, Risiken                                                              |
| `pnpm db:seed:large`       | Large Test Corp  | Zehnjahres-Programm: 3 Wertströme, 6 ARTs, 2 Timelines, 200 Epics in Rollout-Bögen, 390 Features, Budget-Historie                                                      |
| `pnpm db:seed:large-setup` | Large Setup Corp | Der Aufbau von Large Test Corp **ohne Inhalte**: Ökonomie, Guardrails, Practice `artEpics`, Rollen, dieselben acht Konten — keine Wertströme, ARTs, Epics oder Budgets |
| `pnpm db:seed:offsite`     | **Test Demo**    | Simulation „Firmen-Offsite": 1 Wertstrom, 1 ART, 1 Kopf-Ziel, 3 Epics, 9 Features                                                                                      |

> **Alle löschen zuerst die Fachdaten ihres Mandanten** (`wipeDomainData`). Konten, der
> Mandant selbst und Rollenzuweisungen bleiben stehen. Was du von Hand angelegt hast, ist
> danach weg. Die Ids sind deterministisch (`uid`), ein zweiter Lauf erzeugt denselben Stand.

## Der Reifegrad ist eine Historie, keine Spalte

Ein Epic kommt in Pulse nur durch **Antrag und namentliche Abnahme** voran
(siehe `docs/concepts/epic-lifecycle-walkthrough.md`). Die Seeds bilden das ab:
sie beschreiben je Epic den _Weg_, und `prisma/seed-gate-history.ts` leitet
daraus die Spalten, Antragszeilen und Abnahmen ab — mit derselben reinen
Domänenlogik, die auch die App benutzt (`stampsForAdvance`, `gateReadiness`,
`resolveGatePolicy`). Ändert sich, welchen Stempel ein Schritt setzt, ziehen die
Seeds beim nächsten Lauf automatisch mit.

Beide Story-Mandanten zeigen deshalb nicht nur den glatten Pfad, sondern auch
die Zustände, an denen sich der Prozess beweist:

| Zustand                              | `db:seed:demo`                   | `db:seed:large`      |
| ------------------------------------ | -------------------------------- | -------------------- |
| Offener Antrag, teils gezeichnet     | AI Fraud Detection, Open-Banking | jedes fünfte L2-Epic |
| Überfällige Business-Owner-Zeichnung | Core Banking Modernization       | jedes fünfzehnte     |
| Begründete Ablehnung                 | Self-Service Contact Center      | gestreut             |
| Rückstufung und zweiter Anlauf       | Card Tokenization                | gestreut über L3.1   |
| Zurückgezogener Antrag               | Developer Platform               | gestreut             |
| „I need help"                        | SME Lending                      | gestreut über L2/L3  |

Die Seeds prüfen sich beim Lauf selbst: `assertGateHistory` wirft, sobald eine
Historie entsteht, die die App so nie erzeugt hätte — etwa zwei offene Anträge
an einem Epic (was am partiellen Unique-Index `stage_gate_transitions_one_open`
scheitern würde) oder ein offener Antrag, dessen `fromGate` nicht zum aktuellen
Schritt passt.

> Die manuellen Indizes gehören vor den ersten Seed-Lauf eingespielt:
> `psql "$DIRECT_URL" -f prisma/manual-indexes.sql`

## Guardrail 3 — ART-Epics in den Datensätzen

`db:seed:demo` und `db:seed:large` schalten die Practice **`artEpics`** im
Zielbild ein; `db:seed:offsite` und `db:seed` lassen sie aus (Default). Ohne sie
gibt es keine Klassifikation, keinen Rahmen und keine Verteilfläche — der
Mandant verhält sich wie vorher.

**`db:seed:demo` erzählt fünf Zustände**, an denen sich die Fläche erklären
lässt. Die Kostenscheiben folgen dazu einer Größenordnung je Epic (`size`) statt
einer Formel über den Index — vorher lag jedes Epic mit Business Case über
210.000 €, und es gab im ganzen Datensatz kein einziges ART-Epic:

| ART / Epic                   | Zustand                                                          |
| ---------------------------- | ---------------------------------------------------------------- |
| **Accounts & Onboarding**    | Rahmen 240.000 €, zwei Epics gedeckt, **124.000 € ungenutzt**    |
| **Web & Mobile**             | Rahmen 120.000 €, zwei Epics à Σ 140.000 € → **eines ungedeckt** |
| **Service & Contact Center** | **kein Rahmen** — sein ART-Epic hat keinen Finanzierungsweg      |
| _Card Tokenization_          | klein, aber **Portfolio-Ausnahme** mit Begründung                |
| _AI Fraud Detection_         | **Klassenwechsel**: alte ART-Zuteilung, heute Portfolio-Epic     |

Ein Wertstrom setzt eigene Guardrail-Ziele, die beiden anderen erben — nur so
zeigt die Fläche beide Herkünfte („Wertstrom-Regel" gegen „Tenant-Default").

> Die Zuteilungen liegen im **abgeschlossenen** Zyklus: ein Rahmen wird erst zum
> Topf, wenn eine Kachel ihn festgeschrieben hat. Die Verteilfläche zeigt sie
> deshalb, lässt sie aber nicht ändern — vergangene Halbjahre sind gesperrt.

`db:seed:large` bekommt Masse statt benannter Einzelfälle: ein
ART-Epic-Budget je ART (alle sechs), 17 ART-Zuteilungen über neun Halbjahre
und Guardrail-Ziele für jeden Wertstrom (**60.000 / 70.000 / 80.000 €**). Der
Rahmen ist der eigentliche Engpass — er deckelt die Zuteilungen, und was nicht
mehr hineinpasst, bleibt sichtbar ungedeckt. Eine künstliche Quote gibt es
nicht: der Rahmen ist der einzige Grund, aus dem ein ART-Epic leer ausgeht.

## Das Geld: eine Kachel je Halbjahr

Beide Story-Mandanten führen **genau eine Kachel je Halbjahr**, und welches das
laufende ist, sagt die **echte Uhr**. Beides war einmal anders, und beides ging
schief:

- `db:seed:large` legte zwei Kacheln in denselben Zyklus — die Wachstumsrunde
  und eine separate „Betriebs- und Rahmenrunde", deren Topf die Summe aller
  Run-the-Business-Asks war und deren Zeitraum außerhalb ihres eigenen
  Halbjahres lag. Das war eine Umgehung: Betrieb (609 T€) und
  ART-Epic-Budget (1.110 T€) forderten zusammen **172 % des Topfes**, die
  Epic-Zuteilungen noch einmal 100 % — also bekam der Betrieb einen eigenen
  Topf. In der Liste standen dadurch zwei Kacheln „H1 20xx", zwischen denen
  nichts unterschied.
- Beide Seeds nagelten das laufende Halbjahr auf **H1** fest. Von Juli bis
  Dezember zeigten sie deshalb eine „laufende" Runde, die für die App längst
  vergangen war: das Verteilfenster der ART-Rahmen (`potWindowClosedReason`)
  war zu, und in `db:seed:demo` stand **jeder ART-Epic-Budget auf 0 €** — die
  ART-Budgetfläche zeigte nichts.

Der Topf trägt jetzt, was gefordert wird:

| `db:seed:large`          | je Halbjahr                 |
| ------------------------ | --------------------------- |
| Topf                     | 2.000.000 € (= 4 Mio./Jahr) |
| Betrieb                  | 306.000 €                   |
| ART-Epic-Budget (6 ARTs) | 690.000 €                   |
| Rest für den PB-Liste    | ~1.000.000 €                |

**ART-Epics stehen nicht auf dem PB-Liste.** Kandidat einer Runde ist nur, was
über dem Portfolio-Limit seines Wertstroms liegt; die kleineren Vorhaben werden
aus dem ART-Epic-Budget ihres ARTs bedient — genau die Regel, die
`period-detail.ts` zur Laufzeit anwendet. In Large ergibt das 66 Portfolio- und
26 ART-Epics.

Die Kachel des **laufenden** Halbjahres ist `abgeschlossen`, nicht `läuft`: die
finalen Beträge entstehen erst im Übergang `entschieden → abgeschlossen`, und
ohne sie wäre jeder ART-Epic-Budget 0 €. Die laufende Runde ist deshalb die
des **nächsten** Halbjahres — man budgetiert H2 im Lauf von H1. In
`db:seed:demo` liegen die ART-Zuteilungen bewusst im **abgeschlossenen**
Halbjahr: die Verteilfläche zeigt sie, lässt sie aber nicht mehr ändern.

## Die Walkthroughs, im Datensatz nachweisbar

`docs/concepts/*-walkthrough.md` beschreibt fünf Abläufe. Die beiden
Story-Mandanten sind der Ort, an dem sich jede Aussage daraus **antreffen**
lässt — dazu tragen sie folgende Zustände:

| Aussage im Dokument                                                 | `db:seed:demo`                       | `db:seed:large`                        |
| ------------------------------------------------------------------- | ------------------------------------ | -------------------------------------- |
| **Produkt-Manager** je Solution, mit Sitz an L4.1 und am ART-Rahmen | 7 von 10 besetzt                     | 6 von 9 besetzt                        |
| … und keiner benannt ⇒ der Sitz fällt still weg                     | die drei H3-Solutions                | die drei Pilot-Solutions               |
| **Einordnungs-Erwartung** (`intendedClass`)                         | an jedem Epic                        | an jedem Epic                          |
| Abweichung **nach oben** (Kostenregel bindet)                       | Open-Banking & PSD2 APIs             | 5 Epics                                |
| Abweichung **nach unten** (Bestehen möglich)                        | Biometric Auth                       | 3 Epics                                |
| Abweichung **aufgelöst** durch den Override                         | Card Tokenization                    | 7 Epics                                |
| **Prüf-Achse**: `suggested`                                         | 6                                    | 19                                     |
| **Prüf-Achse**: `rejected`, mit Prüfer und Datum                    | 3                                    | 9                                      |
| Kopf-Issues, unter denen gebündelt wird                             | 4 (bis 3 Ebenen tief)                | 3 (eines je Workstream)                |
| **Abschluss-Tor** vollständig erfüllt                               | „Payments PI 1"                      | „Werk-PI 1", „Werk-PI 2"               |
| Budget-Kacheln, eine je Halbjahr                                    | 3                                    | 12                                     |
| … und die Kadenz, die es verfehlt (Warnung)                         | Konzern-Kadenz, 2 offene ROAM-Issues | Restrukturierungs-Kadenz, 17 offene    |
| Feature-Status `approved` (geplant, nicht begonnen)                 | 11                                   | 156 (die Deliverables der L2/L3-Epics) |

### Zwei Timelines, nicht eine

Beide Mandanten führen **zwei** Kadenzen — die kleine mit genau einem ART. Das
hat einen Grund in der Mechanik: `countOpenRoamIssues` zählt offene, nicht
eingeordnete Issues über **alle ARTs einer Timeline**, nicht über ein PI. Bei
einer einzigen Timeline wäre „keine offenen Issues" damit eine mandantenweite
Eigenschaft — und weil offene Issues erwünscht sind, käme kein PI je durch das
volle Tor. Über den ARTs der zweiten Kadenz liegt deshalb bewusst keines.

Nebenbei üben die beiden zwei Regeln des PI-Ablaufs aus, die mit einer Timeline
gar nicht vorkommen können: „ein aktives PI je Timeline" und „ein ART tritt
einer Timeline bei".

### Rollout-Bögen in `db:seed:large`

Ein Kostenhebel wird in einer Restrukturierung nicht einmal gezogen, sondern
**ausgerollt**. Die 200 Epics stehen deshalb in Bögen von zwei bis vier Stufen:

```
Predictive Maintenance — Pilot Werk Nord        L5 · bezahlt Jahr 2
  └─ Predictive Maintenance — Rollout Werk Süd    L4 · bezahlt Jahr 4
       └─ Predictive Maintenance — Skalierung Konzern   L2 · wartet auf Budget
```

Je Kante eine `Dependency` (`depends_on`) — 90 im ganzen Datensatz. Weil das
Zyklus-Band am Reifegrad hängt, fällt der Rest von selbst richtig: **der
Reifegrad sinkt entlang der Kette, der Finanzierungszyklus steigt.** Das Budget
ist der Engpass dieses Mandanten, und die Kette erzählt genau ihn.

> Ein Befund am Rande, der im Datensatz **nicht** vorkommt: an **L3.1**
> zeichnet der Produkt-Manager nicht mit, sobald der Antragsteller die fünf
> Parteien benennt — `expandApprovers` verwirft dann alle Platzhalter-Rollen.
> Die Seeds bilden ab, was die App tut, nicht was die Dokumente behaupten.

## `db:seed:offsite` — der Simulationsmandant

Ein absichtlich kleines Szenario zum Kennenlernen: _„Ich will ein Firmen-Offsite planen."_
40 Teilnehmende, 60.000 €, Termin in sechs Monaten.

**Stand nach dem Lauf: kurz vor dem PI-Planning.** Die drei Epics sind ausgearbeitet,
freigegeben und finanziert (Stage Gate L3), die neun Features sind angelegt und geschätzt —
aber **keines ist einem PI zugeordnet**. Genau diesen Schritt geht man in der Simulation
selbst.

Konten (Passwort `Test1234!`, `admin@pulse.dev` = `Admin1234!`):

```
admin@pulse.dev            tenant_admin
portfolio@pulse.dev        portfolio_manager
rte@pulse.dev              rte                  (ART-Scope)
vso@pulse.dev              value_stream_owner   (Wertstrom-Scope)

eo-transport@pulse.dev  ┐                       das „Planungsteam" —
eo-agenda@pulse.dev     ├ epic_owner            sechs Personen mit ART-Scope.
eo-hotel@pulse.dev      ┘                       Ein Team-Objekt gibt es seit dem
fo-transport@pulse.dev  ┐                       Team-Rückbau (fd8164a) nicht mehr;
fo-agenda@pulse.dev     ├ feature_owner         die Plattform endet bei Wertstrom + ART.
fo-hotel@pulse.dev      ┘
```

Der Mandant **muss vorher existieren** — das Skript legt ihn nicht an, sondern bricht ab.
Grund: es wischt Fachdaten, und ein Tippfehler im Namen würde bei find-or-create still einen
Doppelgänger erzeugen und den dann leeren.
