# Seeds

Fünf Einstiegspunkte, fünf Zwecke. Alle laufen über einen **rohen** Prisma-Client auf
`DIRECT_URL` (Port 5432, nicht den 6543-Pooler) und legen Konten über die Supabase-Admin-API
an — sie brauchen also `.env.local` mit `DIRECT_URL`, `NEXT_PUBLIC_SUPABASE_URL` und
`SUPABASE_SERVICE_ROLE_KEY`.

| Befehl                     | Mandant          | Inhalt                                                                                                                                                                 |
| -------------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm db:seed`             | Pulse Demo Corp  | Nur Konten, Mandant, Rollen — leere Fachdaten                                                                                                                          |
| `pnpm db:seed:demo`        | Pulse Demo Corp  | Dichter Story-Datensatz: 3 Wertströme, 6 ARTs, 2 Timelines, 20 Epics, 44 Features, Ziele, Budget, Risiken                                                              |
| `pnpm db:seed:large`       | Large Test Corp  | **Sechs durchgespielte Halbjahre**: 3 Wertströme, 6 ARTs, 2 Timelines, 176 Epics in Rollout-Bögen, 384 Features, acht Budget-Kacheln                                   |
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

Der Topf trägt jetzt, was gefordert wird — und **beides wächst**, während der
Topf steht. Genau daraus entsteht der Engpass, den dieser Mandant erzählt:

| `db:seed:large`          | 2024-H1      | 2026-H2     |
| ------------------------ | ------------ | ----------- |
| Topf                     | 2.000.000 €  | 2.000.000 € |
| Betrieb                  | 300.000 €    | 360.000 €   |
| ART-Epic-Budget (6 ARTs) | 660.000 €    | 810.000 €   |
| Rest für die Wahl        | ~1.040.000 € | ~830.000 €  |

Die **Reserve wandert weiter**: was eine Runde nicht vergibt, liegt im Topf der
nächsten (99 T€ → 36,8 T€ → 56,2 T€ → …). Sie ist die einzige Kopplung, die zwei
Runden ökonomisch verbindet.

**ART-Epics stehen nicht auf dem PB-Liste.** Kandidat einer Runde ist nur, was
über dem Portfolio-Limit seines Wertstroms liegt; die kleineren Vorhaben werden
aus dem ART-Epic-Budget ihres ARTs bedient — genau die Regel, die
`period-detail.ts` zur Laufzeit anwendet. In Large ergibt das **65 Portfolio-
und 37 ART-Epics** — plus **74 ohne Klasse**, und das ist keine Lücke: vor der
Freigabe des Business Case ist nicht entschieden, wie groß ein Vorhaben ist.

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
| **Produkt-Manager** je Solution, mit Sitz an L4.1 und am ART-Rahmen | 6 von 7 besetzt                      | 5 von 6 besetzt                        |
| … und keiner benannt ⇒ der Sitz fällt still weg                     | „Payments Platform MVP"              | „Logistik Programm"                    |
| … und **gar keine Solution** ⇒ derselbe Sitz fällt ebenso weg       | die 6 R&D-Epics                      | die 58 R&D-Epics                       |
| **Einordnungs-Erwartung** (`intendedClass`)                         | an jedem Epic                        | an jedem Epic                          |
| Abweichung **nach oben** (Kostenregel bindet)                       | Open-Banking & PSD2 APIs             | 57 erwarten ART                        |
| Abweichung **nach unten** (Bestehen möglich)                        | Biometric Auth                       | 119 erwarten Portfolio                 |
| Abweichung **aufgelöst** durch den Override                         | Card Tokenization                    | 7 Epics                                |
| **Prüf-Achse**: `suggested`                                         | 6                                    | 16                                     |
| **Prüf-Achse**: `rejected`, mit Prüfer und Datum                    | 3                                    | 9                                      |
| Kopf-Issues, unter denen gebündelt wird                             | 4 (bis 3 Ebenen tief)                | 3 (eines je Workstream)                |
| **Abschluss-Tor** vollständig erfüllt                               | „Payments PI 1"                      | „Werk-PI 1", „Werk-PI 2"               |
| Budget-Kacheln, eine je Halbjahr                                    | 3                                    | 8 (6 geschlossen, 1 läuft, 1 Entwurf)  |
| … und die Kadenz, die es verfehlt (Warnung)                         | Konzern-Kadenz, 2 offene ROAM-Issues | Restrukturierungs-Kadenz, 27 offene    |
| Feature-Status `approved` (geplant, nicht begonnen)                 | 11                                   | 199 (die Deliverables der L2/L3-Epics) |

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

### In H3 gibt es keine Solution

Eine Solution ist das langlebige Produkt: sie verursacht Betrieb und hat jemanden,
der für sie geradesteht. In H3 gibt es davon nichts — dort wird geforscht, und ob
daraus je ein Produkt wird, ist offen (ADR-0020). Die Erklärtexte des Produkts
sagten das seit jeher („Evaluating / R&D — **noch keine Solution**"), während der
Anlege-Dialog H3 widerspruchslos anbot.

Für die Seeds heißt das: **ein R&D-Vorhaben hat keine Primär-Solution und trägt
seinen Horizont selbst** — `Initiative.investmentHorizon = "h3"`, den
`stampsForAdvance` bei L3.1 einfriert, statt ihn zu überschreiben.

| Mandant           | Solutions                   | R&D-Epics ohne Solution |
| ----------------- | --------------------------- | ----------------------- |
| `db:seed:large`   | 6 (3 × Betrieb/Programm)    | 58                      |
| `db:seed:demo`    | 7 (3 × Core/MVP + 1 Legacy) | 6                       |
| `db:seed:offsite` | 1 — **in H2**               | 3, die an ihr hängen    |

**Der Offsite-Mandant führt die Regel vor.** Das Format „Außentagung" ist ein
Produkt im Entstehen (H2); die drei Vorhaben daran sind Discovery (H3) und tragen
ihren Horizont am Epic. Im Portfolio-Kanban stehen sie deshalb eine Zeile über
ihrer eigenen Solution — genau das, was `epic-horizon.ts` mit „explizit schlägt
abgeleitet" herstellt.

Die Guardrail-Achse bleibt vierwertig: H3 misst weiter, nur eben Epics statt
Solutions.

### Der Rundenmotor in `db:seed:large`

Dieser Mandant wird **gespielt**, nicht gewürfelt. `prisma/seed-large-rounds.ts`
läuft sechs Halbjahre durch und hält je Epic seinen Zustand fest: Ideen kommen
herein, Owner werden benannt, Hypothesen und Business Cases reifen, eine Runde
verteilt Geld, die Finanzierten setzen um, die anderen warten.

Der Unterschied ist keine Kosmetik. Vorher folgte die Finanzierung aus einem
gewürfelten Reifegrad — und damit konnte der Satz, der den Halbjahres-Takt
ausmacht, im Datensatz gar nicht vorkommen:

> „Wird ein Portfolio-Epic in der Runde nicht finanziert, bleibt es auf L3.1
> stehen — nicht abgelehnt, sondern unbezahlt, und beim nächsten Zeitraum wieder
> dabei." — `portfolio-cycle-walkthrough.md`

Jetzt gehen in Large **52 Epics** mindestens einmal leer aus und treten später
wieder an. Der Reifegrad ist dadurch **Ergebnis, nicht Vorgabe**: er sagt, wie
viele Runden ein Vorhaben überstanden hat. Ebenso die Zahl der Epics — sie folgt
aus Zulauf mal Runden, es gibt kein `EPIC_COUNT` mehr.

Drei Regeln trägt der Motor selbst, weil er an den Services vorbeischreibt:

- **Wer in Umsetzung ist, hat Geld.** `allocationRuleViolations` läuft am Ende
  über **jede** Runde, nicht nur über die laufende — 726 Epic-Stände.
- **Laufende Epics haben Vorrang.** Ein Vorhaben in Umsetzung bekommt seine
  nächste Rate, bevor um neue gerungen wird. Deshalb ist
  `BudgetAllocation.allocations` eine Karte über Halbjahre und kein Betrag.
- **Eine Kachel je Halbjahr.** Zwei würden einander still überschreiben, weil
  Zuteilungen, ART-Rahmen und RtB-Awards alle am Zyklus-Schlüssel hängen.

Zwei Trockenläufe zeigen das Ergebnis, ohne die Datenbank anzufassen:

```
npx tsx prisma/scripts/dry-rounds.ts        # Zahlen je Runde
npx tsx prisma/scripts/dry-gate-history.ts  # alle Tor-Historien, geprüft
```

Die Regeln selbst stehen als Tests in `prisma/__tests__/seed-large-rounds.test.ts`
— ohne Datenbank, weil der Motor rein ist.

### Rollout-Bögen in `db:seed:large`

Ein Kostenhebel wird in einer Restrukturierung nicht einmal gezogen, sondern
**ausgerollt**. Die 176 Epics stehen deshalb in Bögen von zwei bis vier Stufen:

```
Predictive Maintenance — Pilot Werk Nord         2024-H1 eingereicht · L5
  └─ Predictive Maintenance — Rollout Werk Süd     2024-H2 eingereicht · L4
       └─ Predictive Maintenance — Skalierung Konzern  2025-H2 · wartet auf Budget
```

Je Kante eine `Dependency` (`depends_on`) — 116 im ganzen Datensatz. Die Kette
läuft in der **Zeit**: die nächste Stufe ist ein Epic, das später eingereicht
wurde. Dass der Reifegrad entlang der Kette sinkt, ist die Folge und nicht die
Vorgabe — und deshalb stimmt sie auch dann, wenn eine Stufe in ihrer Runde kein
Geld bekommen hat und zurückgefallen ist.

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
