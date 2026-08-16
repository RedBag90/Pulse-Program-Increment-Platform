# Pulse als Planspiel (`sim`) — PI-getaktete Transformationssimulation

Konzept für ein Simulationsmodul. **Status: Konzept, vor Implementierung.** Dieses Dokument beschreibt
_was_ die Simulation ist und _wie_ sie funktioniert; es enthält bewusst keinen Implementierungsauftrag.

---

## 1. Kontext & Zweck

Pulse bildet heute den **Betrieb** einer SAFe-Organisation ab: Wertströme, ARTs, PIs, Epics, Features,
Budgets, Ziele, Risiken. Alles, was der Nutzer sieht, ist ein Ist-Zustand, den jemand eingetragen hat.
Was das Werkzeug nicht zeigt: **die Konsequenzen der Entscheidungen, die zu diesem Zustand geführt haben.**
Wer zu viel in ein PI plant, sieht das Auslastungsband auf „over" springen — aber nie, was daraus wird.

Das Planspiel schließt diese Lücke. Der Spieler übernimmt eine Rolle in einer fiktiven Organisation und
steuert sie über mehrere Program Increments. Nach jeder Runde rechnet eine Engine aus, was tatsächlich
geliefert wurde, was gerutscht ist, was schiefging und was es gekostet hat. Gelernt wird nicht durch
Erklärung, sondern durch Rückkopplung.

### Zielgruppe und Einsatz

|                             |                                                                                                         |
| --------------------------- | ------------------------------------------------------------------------------------------------------- |
| **Primär**                  | Interne Nutzung — das Modell validieren, das Werkzeug an realistischen Verläufen härten                 |
| **Solo-Modus**              | Eine Person spielt ein Szenario allein durch, jederzeit, ohne Begleitung                                |
| **Workshop-Modus** (später) | Mehrere Teams spielen parallel dasselbe Szenario, ein Moderator taktet die Runden und führt das Debrief |

### Die vier Lernziele

Jede Mechanik in diesem Konzept dient genau einem davon. Was keinem dient, gehört nicht hinein.

| #      | Lernziel                             | Kernfrage, die der Spieler beantworten lernt                               |
| ------ | ------------------------------------ | -------------------------------------------------------------------------- |
| **L1** | **Priorisierung & Ökonomie**         | Woran erkenne ich, was zuerst gemacht gehört — und wann rechnet sich das?  |
| **L2** | **Fluss, Kapazität, Abhängigkeiten** | Warum liefert ein überlastetes System _weniger_, nicht gleich viel später? |
| **L3** | **Governance & Freigaben**           | Was kosten Stage Gates und Freigaben — und was verhindern sie?             |
| **L4** | **Transformation / Zielzustand**     | Welche Praktik führe ich wann ein, und warum wird es erst schlechter?      |

### Abgrenzung zum Produktbetrieb

Die Simulation ist **kein** Modus über echten Daten. Sie läuft in einem eigenen Tenant mit eigenen
Zustandstabellen. Ein Produktivmandant merkt von der Existenz des Moduls nichts; wird das Modul
entfernt, verschwinden ausschließlich die `sim_*`-Tabellen und `src/modules/sim/`.

---

## 2. Leitentscheidungen

Nummeriert und begründet — dies sind die Weichen, an denen das Konzept hängt.

### E1 — Eigener Sim-Tenant, kein Szenario-Overlay auf echten Daten

Ein Simulationslauf ist ein vollwertiger Tenant (`Tenant.kind = "simulation"`), befüllt aus einem
Szenario-Pack. **Begründung:** Die Alternative — ein Copy-on-Write-Overlay über dem echten Portfolio —
verlangt, dass jede Leseabfrage im gesamten Produkt szenariobewusst wird. Das ist ein Eingriff in jede
Service- und View-Datei und wäre für ein internes Experiment grob unverhältnismäßig. Ein eigener Tenant
kostet dagegen nichts: Mandantentrennung ist bereits die Grundlage des Systems (`tenantId` auf jeder
Tabelle, RLS über `request.jwt.claims`, siehe `src/server/db/prisma.ts`).

**Folge:** Alle bestehenden Screens funktionieren im Sim-Tenant unverändert. Das ist der eigentliche
Hebel des ganzen Konzepts — siehe E6.

### E2 — Das Program Increment ist die Rundenkörnung

Eine Runde = ein PI. **Begründung:** Das PI ist bereits die feinste Zeitkörnung des Datenmodells — es
gibt keine Iteration/Sprint-Entität und keinen Story-Level. Feiner takten hieße, ein Zeitraster zu
erfinden, das das Produkt nicht kennt. Zugleich ist das PI die Körnung, auf der die interessanten
Entscheidungen tatsächlich fallen: Planung, Budgetzyklus, Freigabe, Inspect & Adapt.

**Folge:** Ein Lauf über 8 Runden entspricht rund zwei Jahren Organisationsgeschichte — lang genug,
dass Transformationseffekte (L4) sichtbar werden.

### E3 — Die Engine ist eine reine, seed-deterministische Funktion

```
resolvePi(world, decisions, config, rng) → outcome
```

Keine I/O, kein `Date.now()`, kein ungezähmter Zufall. Gleiche Eingabe + gleicher Seed ⇒ bitgleiches
Ergebnis. **Begründung:** dreifach.

1. **Fairness** — im Workshop müssen zwei Teams mit identischen Entscheidungen identische Ergebnisse
   bekommen, sonst ist das Debrief wertlos.
2. **Balancing** — ein Szenario lässt sich nur austarieren, wenn man es hundertfach mit variierendem
   Seed durchrechnen kann.
3. **Konvention** — die Codebase trennt durchgehend reine Builder von unreinen Loadern; die Engine ist
   nur der bislang größte reine Kern.

### E4 — Simulationszustand lebt in eigenen Tabellen, nie als Spalte auf `Initiative`

Der Restaufwand eines Features (die eine fehlende Größe, siehe §3) landet in `SimFeatureState`, nicht
als `Initiative.remainingJobSize`. **Begründung:** Modul-Layering (ADR-0013) ist in diesem Repo per
ESLint erzwungen, und der Produktkern soll nicht wissen, dass es eine Simulation gibt. Der Preis ist
ein Join; der Gegenwert ist, dass „Simulation entfernen" ein `DROP TABLE` bleibt.

### E5 — Kapazität rechnet auf ART-Ebene, nicht auf Team-Ebene

**Begründung:** Die Team-Entität wird gerade aus dem Produkt entfernt (Routen, Services und
`pi-objective.ts` sind im laufenden Umbau gelöscht; `pi-overview.ts` vermerkt „Team-derived capacity and
PI objectives were removed"). Ein Simulationsmodell auf `Team.targetVelocity` zu bauen hieße, gegen die
Richtung des Produkts zu arbeiten. Die ART-Kapazität ist ohnehin die belastbarere Größe: sie existiert
als expliziter Override (`ProgramIncrement.capacityJobSize`) **und** als Herleitung aus dem ART-Budget
(`prorateArtBudgetToPi`).

### E6 — Die bestehenden Screens sind die Spielsteuerung

Es wird **kein** Spielbrett gebaut. Der Spieler priorisiert im Portfolio, plant im Umsetzungs-Cockpit,
verteilt Budget im Controlling, ROAMt im Risk-Register, setzt Ziele in Ziele. Neu ist nur der Rahmen um
die Runde: eine Sim-Leiste, ein PI-Report, ein Debrief.

**Begründung:** Das ist zugleich der billigste _und_ der lehrreichste Weg. Billig, weil ~95 % der
Oberfläche schon existiert. Lehrreich, weil der Spieler das echte Werkzeug bedient — was das Planspiel
nebenbei zum besten denkbaren Onboarding macht.

**Folge:** Weil die Engine echte `Impediment`- und `Risk`-Zeilen erzeugt, tauchen Ereignisse dort auf,
wo der Spieler sie ohnehin bearbeiten würde. Es braucht keine Ereignis-Sonderoberfläche.

---

## 3. Vorhandene Substanz — was schon da ist

Der überraschendste Befund der Vorabanalyse: **vier der fünf Rechenkerne, die ein solches Planspiel
braucht, existieren bereits** — rein, unit-getestet, produktiv im Einsatz. Die Simulation muss sie
orchestrieren, nicht erfinden.

| Braucht die Engine           | Existiert als                                                                                       | Ort                                                                              |
| ---------------------------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Kapazität & Nachfrage je PI  | `computeCapacity`, `computeDemand`, `prorateArtBudgetToPi`, `utilizationBand` (`ok`/`warn`/`over`)  | [pi-capacity.ts](../../src/modules/drumbeat/domain/pi-capacity.ts)               |
| Priorisierungsreihenfolge    | `computeWsjf` (in [schemas/initiative](../../src/domain/schemas/initiative.ts)), `wsjfTier`         | [wsjf.ts](../../src/modules/drumbeat/domain/wsjf.ts)                             |
| Zufallsereignisse            | `riskExposure`, `LEVEL_VALUE` (5×5, `score = p·i`), `bandForScore`                                  | [risk-matrix.ts](../../src/modules/risks/domain/risk-matrix.ts)                  |
| Nutzen in €                  | `kpiValueContribution`, `kpiDelta`, richtungsbewusst über baseline→target                           | [kpi-valuation.ts](../../src/modules/core/kpi/domain/kpi-valuation.ts)           |
| **Nutzenverfall bei Verzug** | `realisierungsfaktor` (−10 % je PI Verzug, Boden 40 %), `epicTerminabweichungPis`                   | [lpm-review.ts](../../src/modules/work/domain/lpm-review.ts)                     |
| **Scoring**                  | `buildPortfolioSeries` → Kosten, Nutzen, kumulierter Netto-Cashflow, ROI, **Break-even**            | [portfolio-economics.ts](../../src/modules/work/domain/portfolio-economics.ts)   |
| Plantreue                    | `plannedToDate` / `onTime` / `doneToDate`, `piIndexForDate`                                         | [lpm-review.ts](../../src/modules/work/domain/lpm-review.ts)                     |
| Investitionsbalance          | `epicCapacityBucket`, Horizonte H1/H2/H3, Enabler-Quote                                             | [portfolio-guardrails.ts](../../src/modules/work/domain/portfolio-guardrails.ts) |
| Governance-Regelwerk         | `STAGE_GATES` L0–L5, `isValidTransition`, `isApprovalTransition`, `EpicApproval`                    | [stage-gate.ts](../../src/modules/work/domain/stage-gate.ts)                     |
| **Schwierigkeitsgrad**       | `OPERATING_MODEL_TEMPLATE_DEFS`: `team_level` → `essential_safe` → `portfolio_safe`                 | [operating-model.ts](../../src/modules/core/kernel/domain/operating-model.ts)    |
| **Transformationsmessung**   | `computeStructureGap`, `computePracticeAdoption` (Adoption je Practice als 0..1), `deriveNextSteps` | [transformation.ts](../../src/server/services/transformation.ts)                 |
| Welt aufbauen                | `uid()` (deterministische UUIDs), `ensureTenant`, `wipeDomainData`                                  | [seed-helpers.ts](../../prisma/seed-helpers.ts)                                  |
| Zeitreihen erzeugen          | `simulateSeries` — S-Kurve mit deterministischer Streuung, kein Random                              | [seed-demo.ts](../../prisma/seed-demo.ts)                                        |

Drei dieser Zeilen verdienen Hervorhebung, weil sie das Konzept tragen:

**Die Scorecard ist die App.** `buildPortfolioSeries` liefert bereits genau die Kennzahlen, an denen ein
Planspiel gemessen werden muss: kumulierte Kosten, kumulierter Nutzen, Netto-Cashflow über die Zeit und
den Break-even-Monat. Es muss keine Bewertungslogik erfunden werden.

**Nutzenverfall ist schon modelliert.** `realisierungsfaktor(deltaPis)` ist eine fertige Spielmechanik:
Wer ein Epic um drei PIs verzögert, realisiert nur noch 70 % seines Nutzens. Genau diese Kopplung von
Termintreue an Wert ist der Kern von L1.

**Der Schwierigkeitsgrad ist schon modelliert.** Die drei Operating-Model-Vorlagen sind eine fertige
Leiter: `team_level` schaltet alle Praktiken aus, `portfolio_safe` alle ein. Damit ist L4 nicht nur
messbar (`computePracticeAdoption`), sondern spielbar — der Spieler _entscheidet_, welche Praktik er
wann einführt.

### Was fehlt

| Lücke                           | Bewertung                                                                                                                                                                                             |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Fortschritt existiert nicht** | Ein Feature ist binär: `completedAt` gesetzt oder nicht. Keine Velocity, kein Restaufwand, kein Burndown. Die einzige Größenangabe ist `wsjfJobSize` (Int). → `SimFeatureState.remainingJobSize` (E4) |
| **Keine simulierte Uhr**        | 83 × `new Date()` in `src/`, davon 56 in Server-Services/Views; nur 10 Funktionen nehmen ein injizierbares `now`. → §9                                                                                |
| **Kein Rundenzustand**          | Kein Lauf, keine Runde, kein Seed, kein Ereignisprotokoll. → §6                                                                                                                                       |
| **Kein Ereignis-Deck**          | Risiken existieren als Entität, feuern aber nie. → §5, Schritt 4                                                                                                                                      |
| **Szenarien sind Code**         | Eine Demowelt ist heute 1200 Zeilen TypeScript per CLI. → §7                                                                                                                                          |

---

## 4. Spielablauf

```
   ┌─ Sim-Leiste (persistent über dem Dashboard) ─────────────────────────────┐
   │  PI 3 von 8 · „Konzern-Kadenz" · Runde läuft · Rolle: RTE                │
   │                                              [ PI abschließen ]          │
   └──────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
        Der Spieler entscheidet — in den ganz normalen Screens
   ┌──────────────────────────────────────────────────────────────────────────┐
   │  /portfolio      Epics durch die Stage Gates führen, freigeben           │
   │  /umsetzung      Features in ARTs und PIs planen, WSJF bewerten          │
   │  /controlling    Budget auf Epics und ARTs verteilen                     │
   │  /risks          Risiken ROAMen, bevor sie feuern                        │
   │  /umsetzung      Abhängigkeiten auflösen, Impediments bearbeiten         │
   │  /ziele          Ziele setzen, KPIs verknüpfen                           │
   │  /transformation Praktiken des Zielzustands ein-/ausschalten             │
   └──────────────────────────────────────────────────────────────────────────┘
                                   │  „PI abschließen"
                                   ▼
   ┌─ Ein Tick (rein, seed-deterministisch) ──────────────────────────────────┐
   │  1 Rohkapazität → 2 Modifikatoren → 3 Verbrauch →                        │
   │  4 Ereignisse   → 5 Nutzen       → 6 Ökonomie & Uhr weiterstellen        │
   └──────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
   ┌─ PI-Report ──────────────────────────────────────────────────────────────┐
   │  Was fertig wurde · was rutschte und um wieviel · was feuerte ·          │
   │  und vor allem: WARUM (Narrativ je Effekt, nicht nur Zahlen)             │
   └──────────────────────────────────────────────────────────────────────────┘
                                   │  … nach n Runden
                                   ▼
   ┌─ Debrief ────────────────────────────────────────────────────────────────┐
   │  Scorecard · Verlauf über alle Runden · kontrafaktische Hinweise         │
   └──────────────────────────────────────────────────────────────────────────┘
```

### Was der Spieler pro Runde entscheidet

| Entscheidung                                  | Screen (existiert)             | Lernziel |
| --------------------------------------------- | ------------------------------ | -------- |
| Welche Epics durch welches Gate               | `/portfolio`, Epic-Detail      | L3       |
| Business Case schreiben / Freigabe einholen   | Epic-Detail, `/my-approvals`   | L3       |
| Welche Features in welches PI und welchen ART | `/umsetzung` (Cockpit)         | L2       |
| WSJF bewerten — oder es lassen                | `/umsetzung`, Feature-Detail   | L1       |
| Budget auf Epics und ARTs verteilen           | `/controlling/budgeting`       | L1       |
| Abhängigkeiten sichtbar machen und auflösen   | `/umsetzung` (Netzansicht)     | L2       |
| Impediments bearbeiten oder liegen lassen     | `/umsetzung`, `/impediments`   | L2       |
| Risiken ROAMen, bevor sie feuern              | `/risks`                       | L1, L2   |
| Praktiken einführen oder verschieben          | `/transformation`, Zielzustand | L4       |

**Nichts davon ist neu zu bauen.** Das ist der Punkt.

### Rollenspiel ist gratis

Der Lernwert eines Planspiels entsteht wesentlich daraus, dass der Spieler _nicht alles darf_. Die
Codebase hat dafür bereits zwei Achsen: acht Rollen ([roles.ts](../../src/modules/core/kernel/domain/roles.ts))
und pro Tenant editierbare `RoleCapability`-Zeilen. Ein Szenario legt die Rolle des Spielers fest; wer
als RTE spielt, kann kein Epic freigeben und muss es beim Portfolio Manager beantragen — der in einem
Solo-Lauf von der Engine gespielt wird (mit Latenz und gelegentlicher Ablehnung).

---

## 5. Die Physik eines Ticks

Sechs Schritte, je ART und PI. Jeder Modifikator ist einem Lernziel zugeordnet — Mechaniken ohne
Lernzuordnung gehören nicht in die Engine.

### Schritt 1 — Rohkapazität

```
kapazität_jobsize = ProgramIncrement.capacityJobSize                       (Override)
                  ?? prorateArtBudgetToPi(artBudget, pi) / Tenant.costPerJobSizePoint
```

Beide Wege existieren fertig in `pi-capacity.ts`. Der Override-Fall ist das, was der RTE in der
PI-Planung setzt; der Prorata-Fall koppelt Kapazität an Geld — womit eine Budgetkürzung unmittelbar
Durchsatz kostet (L1).

### Schritt 2 — Modifikatoren

Hier steckt der Lernkern. Alle Faktoren sind multiplikativ auf die Rohkapazität, jeder ist im
Szenario-Pack tunebar.

| Modifikator                                      | Wirkung                                                                                                                                                                                                                                                                             | Lernziel |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| **Überlast / WIP**                               | `auslastung = nachfrage / kapazität`. Über 1 greift ein **konvexer** Abschlag: bei 1,5 bleiben nicht 100 %, sondern deutlich weniger effektiver Durchsatz übrig. Bestraft „alles reinplanen" und macht erfahrbar, dass ein überlastetes System _weniger_ liefert, nicht nur später. | **L2**   |
| **Blockierende Abhängigkeit**                    | Ein Feature, dessen `Dependency`-Blocker im selben PI nicht fertig ist, bekommt **0** Durchsatz. Die dafür reservierte Kapazität verfällt teilweise (Umschaltverlust), fällt also nicht vollständig anderen Features zu.                                                            | **L2**   |
| **Offene Impediments**                           | Je offenem Impediment ein Abzug nach `severity`. Wird es über Runden nicht bearbeitet, **wächst** der Abzug — Vernachlässigung verzinst sich.                                                                                                                                       | **L2**   |
| **Praktik: Stage Gates / Mehrparteien-Freigabe** | Kosten **Vorlaufzeit**: ein Epic braucht Runden, um durch L0→L3 zu kommen. Nutzen: Epics ohne freigegebenen Business Case liefern einen **gedämpften KPI-Ertrag** (Fehlinvestitionsrisiko). Wer Governance abschaltet, ist schneller im Markt und häufiger falsch.                  | **L3**   |
| **Praktik: WSJF**                                | An → Features werden nach `wsjfComputed` abgearbeitet. Aus → nach Erstellungsreihenfolge. Über acht Runden ist der Unterschied im kumulierten Nutzen erheblich — ein sehr direkter A/B-Beweis.                                                                                      | **L1**   |
| **Praktik: Abhängigkeiten**                      | An → Blocker werden vor der Planung sichtbar und teilweise vorab entschärft. Aus → sie schlagen unangekündigt im Tick zu.                                                                                                                                                           | **L2**   |
| **Transformationsreife (J-Kurve)**               | Eine frisch eingeführte Praktik kostet zunächst Kapazität (Lernen, Umstellung) und zahlt erst nach mehreren Runden ein. Messgröße ist die vorhandene Adoptionsrate aus `computePracticeAdoption` (0..1 je Praktik). **Wer alle Praktiken gleichzeitig einführt, bricht ein.**       | **L4**   |

Die J-Kurve ist die wichtigste Mechanik für L4 und zugleich die realitätsnächste: Transformationen
werden erst schlechter, bevor sie besser werden, und genau daran scheitern sie in der Praxis.

### Schritt 3 — Verbrauch

Features des ART im aktuellen PI werden in Prioritätsreihenfolge (WSJF oder Erstellungsreihenfolge,
je nach Praktik) abgearbeitet, bis die effektive Kapazität erschöpft ist. `remainingJobSize` sinkt;
erreicht es 0, wird `completedAt` auf das PI-Ende gesetzt. Was übrig bleibt, rutscht mit seinem
Restaufwand in das nächste PI — sichtbar als „Feature X: 60 % erledigt, rutscht".

### Schritt 4 — Ereignisse

Zwei Quellen:

1. **Risiken** aus dem Register feuern nach ihrer `probability` (5×5 → `LEVEL_VALUE` liefert 1..5) gegen
   den Seed-RNG. Ein geROAMtes Risiko (`mitigated`, `resolved`) feuert seltener oder gar nicht — damit
   zahlt sich Risikoarbeit messbar aus.
2. **Ereignis-Deck** des Szenarios: Ereignisse mit Auslösebedingung (Runde, Weltzustand,
   Wahrscheinlichkeit) und Wirkung.

Wirkungsarten: neue `Impediment`-Zeile, Kapazitätsschock, Scope-Zuwachs auf einem Feature,
Budgetkürzung, Personalabgang, Abhängigkeit entsteht neu.

**Entscheidend:** Ereignisse erzeugen **echte Entitäten**. Ein gefeuertes Risiko wird zu einem
Impediment, das der Spieler im normalen `/umsetzung`-Screen sieht und bearbeitet. Es gibt keine
Sonderoberfläche für Spielereignisse.

### Schritt 5 — Nutzen

Ein Epic, dessen Features vollständig geliefert sind, bewegt seine verknüpften KPIs Richtung Target —
über eine Rampe, nicht als Sprung (`simulateSeries` in `seed-demo.ts` zeigt die Form: S-Kurve mit
deterministischer Streuung). Auf die Bewegung wirken zwei Dämpfungen:

- `realisierungsfaktor(epicTerminabweichungPis(...))` — Verzug frisst Nutzen (−10 % je PI, Boden 40 %).
- Fehlender oder nie freigegebener Business Case — gedämpfter Ertrag (siehe Schritt 2, L3).

`kpiValueContribution` übersetzt die KPI-Bewegung in €. Ziele rollen über den vorhandenen
Goals-Rollup auf.

### Schritt 6 — Ökonomie & Uhr

Budgetverbrauch des PI wird gebucht; `buildPortfolioSeries` liefert die aktualisierten Reihen für
Kosten, Nutzen, Netto-Cashflow und Break-even. Zuletzt wird `SimRun.currentDate` auf das Ende des
nächsten PI gestellt und die Runde hochgezählt.

---

## 6. Domänenmodell der Simulation

Vier neue Tabellen, alle mit Präfix `sim_`, alle tenant-scoped, keine Änderung an bestehenden Modellen.

### `SimRun` — der Lauf

| Feld                         | Zweck                                                           |
| ---------------------------- | --------------------------------------------------------------- |
| `id`, `tenantId`             | Ein Lauf gehört zu genau einem Sim-Tenant                       |
| `scenarioKey`                | Welches Szenario-Pack instanziiert wurde                        |
| `seed`                       | Der RNG-Seed — macht den Lauf reproduzierbar (E3)               |
| `round`, `totalRounds`       | Aktuelle Runde und Länge des Szenarios                          |
| `currentPiId`, `currentDate` | Die simulierte Uhr (§9)                                         |
| `playerRole`                 | Rolle des Spielers — bestimmt, was er darf                      |
| `status`                     | `running` / `finished` / `abandoned`                            |
| `config Json`                | Tuning-Overrides gegenüber dem Szenario (Moderator darf drehen) |
| `startedBy`, `startedAt`     | Wer, wann                                                       |

### `SimFeatureState` — der fehlende Restaufwand

| Feld                       | Zweck                                                              |
| -------------------------- | ------------------------------------------------------------------ |
| `simRunId`, `initiativeId` | Zeigt auf das echte Feature, ohne es zu verändern (E4)             |
| `remainingJobSize`         | **Die eine Größe, die dem Produkt fehlt.** Initial = `wsjfJobSize` |
| `startedInPiId`            | Wann die Arbeit begann — Basis für Durchlaufzeit                   |
| `blockedSince`             | Seit wann durch eine Abhängigkeit blockiert                        |

`@@unique([simRunId, initiativeId])`.

### `SimEvent` — das Protokoll

| Feld                | Zweck                                                                                                                                   |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `simRunId`, `round` | Wann                                                                                                                                    |
| `kind`              | `feature_completed` · `feature_slipped` · `risk_fired` · `impediment_raised` · `capacity_shock` · `budget_cut` · `practice_adopted` · … |
| `payload Json`      | Strukturierte Daten für Auswertung                                                                                                      |
| `narrative`         | Ein Satz in Klartext — **die Grundlage des PI-Reports**                                                                                 |

Der `narrative`-Text ist nicht Zierde: Ein Planspiel lehrt nur, wenn der Spieler die _Kausalkette_
sieht. „Feature ‚Zahlungs-API' hat 0 Fortschritt gemacht, weil ‚Auth-Service' nicht fertig wurde" ist
der Lerneffekt; eine Fortschrittszahl allein ist es nicht.

### `SimSnapshot` — Replay und Vergleich (ab Stufe 2)

`simRunId`, `round`, `payload Json` — der vollständige Weltzustand nach jeder Runde. Ermöglicht
Zeitreise im Debrief, Vergleich zweier Teams im Workshop und Regressionstests der Engine.

### Bewusst **nicht** verändert

`Initiative`, `ProgramIncrement`, `Art`, `Risk`, `Impediment`, `Kpi` bekommen **kein einziges neues
Feld**. Die Simulation liest sie und schreibt sie über die normalen Services; ihren eigenen Zustand
hält sie daneben.

---

## 7. Szenarien als Daten

Ein Szenario ist eine JSON-Datei mit Zod-Schema, kein TypeScript. **Begründung:** Ein Szenario zu
balancieren heißt, Konstanten zwanzigmal zu ändern und neu durchzurechnen. Als Code bedeutet das jedes
Mal einen Rebuild und ein Code-Review; als Daten ist es eine Zahl in einer Datei. Zusätzlich wird ein
Szenario damit für Nicht-Entwickler (Moderatoren, Trainer) zugänglich.

```
{
  "meta":  { Name, Beschreibung, Lernziele [L1..L4], Rundenzahl, Spielerrolle },
  "world": { Wertströme, ARTs, Timeline/PIs, Epics + Features (mit Job Size),
             Budget-Pools, KPIs, Risiken, Startzeitpunkt },
  "operatingModel": { Start-Praktiken, deklarierter Zielzustand, Strukturziele },
  "deck":  [ { Auslösebedingung, Wahrscheinlichkeit, Wirkung, Narrativ } ],
  "config":{ Tuningkonstanten: WIP-Kurve, Impediment-Abzüge, J-Kurven-Länge, … },
  "scoring":{ Gewichte der Scorecard-Achsen }
}
```

Der Loader baut daraus einen Tenant und verwendet dafür die vorhandenen Helfer aus
[seed-helpers.ts](../../prisma/seed-helpers.ts) wieder: `ensureTenant`, `wipeDomainData`, `assignRole`
und vor allem `uid()` für deterministische, quer referenzierbare IDs.

**Nebeneffekt, der es wert ist:** Mittelfristig kann [seed-demo.ts](../../prisma/seed-demo.ts) — heute
1200 Zeilen imperatives TypeScript — auf denselben deklarativen Loader gestellt werden. Aus zwei
Weltgeneratoren wird einer.

---

## 8. Modulzuschnitt & Grenzen

Ein neues Modul **`sim`** als **oberste Schicht**: es darf alle Module lesen, **niemand darf es
importieren.**

```
core ← work ← { drumbeat, budgeting, risks } ← sim
```

Das ist eine neue Schichtposition, folgt aber exakt dem Muster von ADR-0013 und wird mit derselben
Technik erzwungen: eine `no-restricted-imports`-Gruppe in [eslint.config.mjs](../../eslint.config.mjs),
die `@/modules/sim` für alle anderen Modulpfade sperrt. Weil `sim` nach unten importieren darf, kann es
die Services von `work`/`drumbeat` direkt aufrufen — der Umweg über Events (ADR-0015) ist nur für
_seitwärts_ gerichtete Schreibzugriffe nötig.

```
src/modules/sim/
  domain/                  # rein, deterministisch, kein I/O — der eigentliche Kern
    rng.ts                 # Seeded PRNG (mulberry32) — reproduzierbar
    world.ts               # SimWorld: der Datensnapshot, den die Engine sieht
    throughput.ts          # Kapazität + Modifikatoren → erledigte Job-Size
    events.ts              # Ereignis-Deck: Auslösung und Wirkung
    resolve-pi.ts          # DIE Engine
    scoring.ts             # Scorecard — orchestriert vorhandene Kerne
    scenario.ts            # Szenario-Schema (Zod) + Validierung
  scenarios/*.json         # Szenarien als Daten
  server/
    services/sim-run.ts    # Tick ausführen, Welt schreiben (EINE Transaktion)
    services/sim-scenario.ts # Szenario laden, Tenant aufbauen
    views/sim-cockpit.ts   # Page-Model: Rundenkopf, offene Entscheidungen
    views/sim-report.ts    # Page-Model: PI-Report
    views/sim-debrief.ts   # Page-Model: Scorecard
  features/sim/
    actions/sim.ts         # startRun · advancePi · resetRun
    components/            # Sim-Leiste, PI-Report, Debrief
```

### Registry und Entitlement

`sim` wird **nicht** in `MODULE_KEYS` ([modules.ts](../../src/modules/core/kernel/domain/modules.ts))
aufgenommen, solange es internes Werkzeug ist — ein Eintrag dort macht es zu einem verkaufbaren Modul
mit allen Konsequenzen (Nav-Filter, Route-Guard, Action-Gate, Preisliste). Der Zugang läuft stattdessen
über den Tenant-Typ: `Tenant.kind = "simulation"`. Der Aufsatzpunkt für eine spätere
Produktivierung ist damit klar benannt und einzeilig.

### Der Audit-Pfad muss umgangen werden

`withAuditedTransaction` ([mutation.ts](../../src/modules/core/kernel/server/mutation.ts)) schreibt pro
Mutation **eine** `AuditEvent`-Zeile. Ein Tick mutiert hunderte Zeilen. Die Engine darf diesen Pfad
deshalb nicht benutzen; sie schreibt in **einer** Transaktion per Bulk-Operation und protokolliert nach
`SimEvent` statt nach `AuditEvent`. Spieler-Aktionen laufen dagegen ganz normal über
`createServerAction` → Service → Audit — das ist gewollt, denn ihr Audit-Trail ist Teil des Debriefs.

---

## 9. Die simulierte Uhr

**Befund.** 83 × `new Date()` in `src/`, davon **56 in Server-Services und -Views**; 22 × `Date.now()`.
Nur 10 Funktionen nehmen heute ein injizierbares `now`. Die reinen Builder sind meist sauber
(`buildPortfolioOverview(inputs, now)`), aber die unreinen Loader davor rufen `new Date()` direkt auf.

**Vorschlag.** `now` wandert in den `RequestContext`:

```
buildRequestContext()
  → Tenant laden
  → simRun?  ctx.now = simRun.currentDate
     sonst   ctx.now = new Date()
```

Alle Server-Lesepfade nehmen `ctx.now` statt `new Date()`. Abgesichert durch eine
`no-restricted-syntax`-Regel gegen `new Date()` in `src/server/**` und `src/modules/**/server/**`, mit
genau einer Ausnahme für die Clock-Datei selbst — dieselbe Technik, mit der das Repo schon das
Modul-Layering erzwingt.

**Aufwand und Nutzen.** Der Eingriff ist breit, aber mechanisch: 56 Stellen ersetzen, keine
Logikänderung. Der Nebennutzen ist beträchtlich und unabhängig von der Simulation: **alle
zeitabhängigen Views werden deterministisch testbar** — heute sind sie es nicht, weil sie „heute"
selbst bestimmen. Betroffen sind unter anderem `pickCurrentPiIndex` (Cockpit), die Stale-Erkennung im
Portfolio, der LPM-Stichtag und die Fälligkeitshorizonte.

**Wichtig für den Zuschnitt:** In Stufe 0 wird diese Umstellung **nicht** gebraucht. Die Engine bekommt
`now` als Parameter, und solange nichts im App-Code läuft, gibt es keine Uhr zu abstrahieren. Das ist
der Grund, warum Stufe 0 billig ist.

---

## 10. Scoring & Debrief

Die Scorecard setzt sich aus sechs Achsen zusammen. **Für keine davon muss Rechenlogik erfunden
werden** — jede hat eine Quelle im Bestand.

| Achse                          | Was sie misst                                                            | Quelle                                           |
| ------------------------------ | ------------------------------------------------------------------------ | ------------------------------------------------ |
| **Wert & Rendite**             | Kumulierter Nutzen, ROI, Break-even-Monat                                | `buildPortfolioSeries`                           |
| **Plantreue**                  | Anteil termingerecht gelieferter Features (`onTime / plannedToDate`)     | `lpm-review.ts`                                  |
| **Investitionsbalance**        | Einhaltung der Horizonte H1/H2/H3 und der Enabler-Quote                  | `portfolio-guardrails.ts`                        |
| **Zielerreichung**             | Fortschritt der gesetzten Ziele/OKRs                                     | Goals-Rollup                                     |
| **Risikolage**                 | Verbleibende Exposition, Anteil ungeROAMter Risiken                      | `risk-matrix.ts`                                 |
| **Transformationsfortschritt** | Annäherung an den deklarierten Zielzustand (Struktur + Praktik-Adoption) | `computeStructureGap`, `computePracticeAdoption` |

Die Gewichtung der Achsen kommt aus dem Szenario (`scoring`) — ein Szenario mit Schwerpunkt L4 gewichtet
Transformationsfortschritt hoch, eines mit Schwerpunkt L1 die Rendite.

### Debrief

Mehr als eine Zahlenkolonne:

- **Verlauf über alle Runden** — wo kippte es, und was war die Entscheidung davor?
- **Kausalketten** aus `SimEvent.narrative` — die teuersten fünf Ereignisse und ihre Ursache.
- **Kontrafaktische Hinweise** — dank Determinismus (E3) rechenbar: derselbe Lauf mit einer geänderten
  Entscheidung, als Vergleichslinie. „Mit WSJF-Priorisierung hätten Sie 1,4 Mio € mehr realisiert."
  Das ist der stärkste denkbare Lernmoment und nur deshalb möglich, weil die Engine rein ist.

---

## 11. Stufen

Jede Stufe ist für sich abgeschlossen, liefert einen eigenen Erkenntnisgewinn und hat ein explizites
Abbruchkriterium.

### Stufe 0 — Headless-Kern

**Umfang.** `src/modules/sim/domain/**`, das Szenario-Schema, ein Szenario, ein CLI-Runner
(`pnpm sim:run --scenario=… --seed=… --pis=8`). Kein UI, keine Tabellen, **kein Uhr-Refactor** — die
Engine bekommt `now` als Parameter.

**Ergebnis.** Rundenreports und Endscorecard als Text/JSON. Die Physik aller vier Lernziele ist
validiert — oder widerlegt — bevor ein Cent in Oberfläche fließt. Und Balancing wird überhaupt erst
machbar.

**Abbruchkriterium.** Wenn sich nach mehreren Balancing-Runden kein Szenario finden lässt, in dem gute
Entscheidungen zuverlässig gewinnen, ist die Idee an dieser Stelle günstig beerdigt.

### Stufe 1 — Uhr und spielbare Runde

**Umfang.** `ctx.now`-Abstraktion samt ESLint-Guard (§9); `SimRun`, `SimFeatureState`, `SimEvent`;
Sim-Tenant-Typ; Sim-Leiste; Tick-Action; PI-Report.

**Ergebnis.** Ein Szenario ist im Browser durchspielbar. Die bestehenden Screens sind die Spielsteuerung.

**Voraussetzung.** Der laufende Umbau (Team-Entfernung, Portfolio-Overview-Rework — derzeit 68 Dateien
uncommitted) sollte vorher gelandet sein, sonst kollidiert das Uhr-Refactor damit.

### Stufe 2 — Szenario-Packs, Debrief, Replay

**Umfang.** Mehrere Szenarien mit unterschiedlichen Lernschwerpunkten; Scorecard-Screen;
kontrafaktische Hinweise; `SimSnapshot` für Zeitreise und Vergleich.

**Ergebnis.** Der Lernwert ist vollständig — nicht nur spielbar, sondern auswertbar.

### Stufe 3 — Facilitator / Workshop

**Umfang.** `SimSession` mit N parallelen Läufen (je Team ein Tenant); Moderatorkonsole: alle Runden
gemeinsam takten, Ereignis manuell einwerfen, Teams vergleichen, Debrief projizieren.

**Ergebnis.** Moderierte Workshops mit mehreren Teams.

---

## 12. Verifikation

| Prüfung               | Wie                                                                                                                                                                               |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Determinismus**     | `resolvePi` zweimal mit identischer Eingabe und Seed → bitgleiches Ergebnis. Nicht verhandelbar (E3)                                                                              |
| **Kapazitätskanten**  | Auslastung 0 / genau 1 / 1,5 / 3; Kapazität `null`; Blocker liefert exakt 0 Durchsatz                                                                                             |
| **Ereignisauslösung** | Wahrscheinlichkeit 0 feuert nie, 1 feuert immer; geROAMtes Risiko feuert seltener                                                                                                 |
| **Balancing**         | `pnpm sim:run --scenario=default --seed=1..20 --pis=8` → Streuung der Endscores. Ein Szenario taugt, wenn gute Entscheidungen zuverlässig gewinnen und der Zufall nicht dominiert |
| **Regression**        | Snapshot-Test eines vollständigen 8-Runden-Laufs mit festem Seed — jede Engine-Änderung wird sichtbar                                                                             |
| **Ab Stufe 1**        | Integrationstest gegen `DATABASE_URL_TEST` (Vitest-Projekt `integration` existiert): ein Lauf über 3 Ticks, Weltzustand danach konsistent                                         |

Die Domain-Tests laufen im bestehenden Vitest-Projekt `client`, das `src/modules/**/domain` abdeckt —
die Engine fügt sich ohne neue Testinfrastruktur ein.

---

## 13. Risiken & offene Entscheidungen

### R1 — Balancing ist die eigentliche Arbeit

Der Engine-Code ist schätzungsweise 20 % des Aufwands. Ein Szenario, das sich **lehrreich** statt
willkürlich anfühlt, ist die anderen 80 %. Ohne schnellen headless Replay wird das nie gut — das ist
der Hauptgrund für den Zuschnitt von Stufe 0.

### R2 — Audit-Log-Explosion

Siehe §8. Wird der Standard-Mutationspfad benutzt, erzeugt jeder Tick hunderte `AuditEvent`-Zeilen.
Muss beim Design des Schreibpfads von Anfang an berücksichtigt werden.

### R3 — Es gibt keine Migrations

`prisma/migrations/` ist leer; der Workflow ist `prisma db push`. Die `sim_*`-Tabellen sind das erste,
was echte Versionierung verlangen würde. **Offene Entscheidung:** ob dieses Modul der Anlass ist,
Migrations einzuführen, oder ob `db push` weiterhin genügt.

### R4 — Der laufende Umbau

68 Dateien sind uncommitted (Team-Entfernung, Portfolio-Overview-Rework). Stufe 0 ist davon unberührt
und kann parallel laufen; Stufe 1 nicht (§11).

### R5 — Die Spannung „vier Lernziele" vs. „internes Experiment"

Vier Lernziele verlangen hohe Modellgüte; „internes Experiment" verträgt wenig Investment. Der
Stufenzuschnitt löst das auf: **Fidelität steckt in der Engine — rein, billig, testbar — nicht in der
UI, die teuer ist.** Stufe 0 deckt alle vier Achsen vollständig ab und kostet keine Oberfläche.

### R6 — Modellgüte vs. Vorhersageanspruch

Die Simulation ist ein **Lehrmodell**, keine Prognose. Sie soll Wirkzusammenhänge erfahrbar machen, nicht
Termine vorhersagen. Diese Abgrenzung gehört in die Oberfläche selbst, sonst werden Ergebnisse
missverstanden — insbesondere, weil sie im echten Werkzeug und in echter Optik erscheinen.

---

## 14. Bewusst ausgeklammert

| Nicht Teil dieses Konzepts                     | Warum                                                                                                                                                                                       |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Mehrspieler in Echtzeit**                    | Kein Scheduler, keine Queue, kein WebSocket-Layer vorhanden (nur ein Outbox-Cron). Der Workshop-Modus in Stufe 3 taktet rundenweise über den Moderator — das genügt                         |
| **KI-Gegenspieler / autonome Agenten**         | Reizvoll, aber orthogonal. Die Engine spielt nicht besetzte Rollen mit einfachen, deterministischen Heuristiken (Latenz, gelegentliche Ablehnung) — mehr braucht es für den Lernzweck nicht |
| **Zertifizierung, Ranglisten, Punkteverband**  | Setzt eine Produktentscheidung voraus, die nicht getroffen ist                                                                                                                              |
| **Verkauf als Modul**                          | Der Aufsatzpunkt ist benannt (§8: `MODULE_KEYS` + `MODULE_PREREQUISITES`), aber nicht ausgearbeitet. Solange die Produktrolle „internes Werkzeug" ist, wäre das verfrüht                    |
| **Szenario-Editor als Oberfläche**             | Szenarien sind JSON-Dateien im Repo. Ein Editor lohnt erst, wenn Nicht-Entwickler regelmäßig Szenarien schreiben                                                                            |
| **Import echter Portfoliodaten als Startwelt** | Naheliegender nächster Schritt nach Stufe 2, aber er wirft Datenschutz- und Erwartungsfragen auf (siehe R6), die vorher zu klären sind                                                      |
