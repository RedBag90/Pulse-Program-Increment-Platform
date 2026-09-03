# Seeds

Drei Einstiegspunkte, drei Zwecke. Alle drei laufen über einen **rohen** Prisma-Client auf
`DIRECT_URL` (Port 5432, nicht den 6543-Pooler) und legen Konten über die Supabase-Admin-API
an — sie brauchen also `.env.local` mit `DIRECT_URL`, `NEXT_PUBLIC_SUPABASE_URL` und
`SUPABASE_SERVICE_ROLE_KEY`.

| Befehl                 | Mandant         | Inhalt                                                                                        |
| ---------------------- | --------------- | --------------------------------------------------------------------------------------------- |
| `pnpm db:seed`         | Pulse Demo Corp | Nur Konten, Mandant, Rollen — leere Fachdaten                                                 |
| `pnpm db:seed:demo`    | Pulse Demo Corp | Dichter Story-Datensatz: 3 Wertströme, 6 ARTs, 20 Epics, ~44 Features, Ziele, Budget, Risiken |
| `pnpm db:seed:large`   | Large Test Corp | Lastdatensatz: 3 Wertströme, 6 ARTs, 200 Epics über 10 Jahre, ~490 Features, Budget-Historie  |
| `pnpm db:seed:offsite` | **Test Demo**   | Simulation „Firmen-Offsite": 1 Wertstrom, 1 ART, 1 Kopf-Ziel, 3 Epics, 9 Features             |

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

`db:seed:large` bekommt keine Einzelfälle, sondern Masse: ein Veränderungsrahmen
je ART (alle sechs), rund 40 erzeugte ART-Zuteilungen und Guardrail-Ziele für
jeden Wertstrom. Etwa ein Drittel der ART-Epics bleibt absichtlich ungedeckt.

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
