# Der Reiter „Budget-KPIs" — Analyse und Spec

> Status: **Umgesetzt** · Erstellt 2026-09-27 · umgesetzt 2026-09-27 (siehe „Umsetzung“ am Ende)
>
> Folgt auf [art-budget-process-layout.md](art-budget-process-layout.md) §4,
> das den Reiter eingeführt hat. Rechnung und Daten bleiben dieselben
> (`loadBudgetKpis`, `loadPiVelocity`, Budget-Stichtag); diese Spec schneidet
> die **Darstellung** neu.

## Anlass

Der Reiter ist visuell unruhig und zu kompliziert. Bei einem Wertstrom mit
zwei ARTs stehen drei lange Karten untereinander:

- Wertstrom gesamt;
- ART 1;
- ART 2.

Jede Karte trägt:

- ein Urteil;
- drei Zahlenzeilen;
- ein SVG-Diagramm;
- eine PI-Tabelle mit Sparkline;
- eine aufklappbare Herleitung;
- Fliesstext.

Das sind rund 14 Blöcke auf 2.700–3.000 px, also drei bis vier
Bildschirmhöhen. Zwei ARTs vergleicht man nur durch Scrollen.

Entschieden ist:

1. Der Reiter beantwortet **zwei Fragen gleichrangig**:
   - Reicht das Budget für die eingeplante Arbeit? (**Deckung**)
   - Liefern wir, was das Geld kaufen sollte? (**Lieferung**)
2. **Eine Karte je KPI statt je ART.** Jede Karte vergleicht alle ARTs in sich.
3. Herleitungen und Vorbehalte liegen **eingeklappt unter „Wie gerechnet?"**.
4. Die **Velocity** steht als eine Zahl je ART. Die PI-Tabelle gibt es nur im
   aufgeklappten Detail.

---

## Teil A — Was der Reiter heute zeigt

### A1 · Blöcke

| Block            | Inhalt                                                                                                                | Quelle                             | Befund                                                                                                                                                            |
| ---------------- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Urteil           | „Überbucht um X € — … um Y %" · „Gedeckt — … X € unter dem Budget" · „Nichts zugeteilt" · „Deckung nicht berechenbar" | `coverageVerdict`, `StreamKpi.gap` | Die Wertstrom-Karte baut das Urteil inline nach, statt `coverageVerdict` zu nutzen                                                                                |
| Zahlen           | Feature-Last (F · JS × Satz), zugeteiltes Budget, Lücke                                                               | `ArtCoverage`, `StreamKpi`         | Klar. Die Lücke ist bei Überbuchung **negativ** — gegen die Intuition                                                                                             |
| Erklärtext       | „Die Last ist die Summe der ART-Rechnungen — nicht … × einem Satz …" (254 Zeichen), dazu „Ohne Satz …"                | i18n                               | Fliesstext, wo ein Hinweis reicht                                                                                                                                 |
| Satz-Herleitung  | `<details>`: Quelle, Ø Budget ÷ JS, eigenständige Features, Schätzformular, Vorbehalte                                | `JobSizeRate`                      | Steht **nach** der Velocity; die Vorbehalte sind hart deutsche Strings in `art-throughput.ts`, nicht i18n                                                         |
| Job-Size-Verlauf | SVG: Plan, ±20-%-Band, Ist-Treppe, „heute"; Kopfsatz, Meta-Zeile, Legende                                             | `JobSizeBurn`                      | Dreimal dasselbe Diagramm. Es folgt der **geltenden Kachel**, die Zahlen darüber dem **Halbjahr-Umschalter** — die Karte sagt nicht, dass das zwei Zeiträume sind |
| PI-Velocity      | PI-Tabelle (5 Spalten), Sparkline, Ø-Zahl, Fussnote zur Kapazitätseinheit                                             | `PiVelocityModel`                  | Dreimal eine volle Tabelle; `countedCount` bleibt ungenutzt                                                                                                       |
| Fussnote         | „Betrieb zählt in keiner dieser Rechnungen mit …"                                                                     | i18n                               | Richtiger Kontext, zu lang                                                                                                                                        |
| Chrome           | Phasenschiene, Halbjahr-Umschalter, linke Nav mit offenem ART-Rahmen                                                  | Seite                              | Bleibt                                                                                                                                                            |

### A2 · Inhaltliche Befunde

1. **Ein Satz treibt beide KPIs — gegenläufig.**
   - Last = Σ JS × Satz; Plan im Verlauf = Budget ÷ Satz.
   - Ist der Satz zu hoch, wird die Last zu gross **und** der Plan zu klein.
   - Die Seite zeigt dann zugleich „stark überbucht" und „weit über Plan".
     Gemessen am Wertstrom „Produktion" (H2 2026): „Überbucht um 846 %"
     neben „Ist 293 JS · Plan heute 45 JS · +545 %".
   - Heute stehen dort zwei rote Alarme ohne Zusammenhang. Die eigentliche
     Aussage wäre: **den Satz prüfen**.
2. **Zwei Zeiträume auf einer Karte.**
   - Deckung: das gewählte Halbjahr.
   - Verlauf: die geltende Kachel mit eigenen Daten, z. B. 05.07.–30.12.2026.
   - Der Umschalter ändert nur einen Teil der Karte.
3. **Vorhanden, aber nicht gezeigt:**
   - die Satz-Historie je Halbjahr (`JobSizeRate.cycles` — Budget, JS und
     Features je Halbjahr);
   - `countedCount` der Velocity;
   - die Last je Arbeitstyp (`plannedByBucket`, Guardrail 2);
   - `plannedStandalone`, heute nur auf dem ART-Reiter.
4. **Ungetestet:**
   - die Wertstrom-Karte;
   - das Layout der ART-Karte;
   - die Urteilstexte;
   - `CoverageOneLiner`.

### A3 · Wiederverwendung (darf nicht brechen)

| Baustein           | Weitere Nutzer                                                                     |
| ------------------ | ---------------------------------------------------------------------------------- |
| `JobSizeBurnChart` | Portfolio Sync (`BudgetBurnPanel` → `overview-sync.tsx`) mit Auswahl Wertstrom/ART |
| `CoverageOneLiner` | ART-Reiter (`art-budget-tab.tsx`), verlinkt auf `?tab=kpi`                         |
| `loadArtCoverages` | ART-Reiter (`art-budget-detail.ts`), Kapazitätsplan (`capacity-plan.ts`)           |
| `PiVelocityTable`  | nur hier                                                                           |

---

## Teil B — Spec

### B1 · Aufbau

```
┌─ Budget-KPIs ─────────────────────────────────────────────────────────────┐
│ ┌ Deckung · H2 2026 ─────────────────┐ ┌ Lieferung · Kachel H2 2026 ─────┐ │
│ │ [● Überbucht]  fehlen 6,30 Mio €   │ │ [▲ Über Plan]  +545 %            │ │
│ │ Last 7,05 Mio € · Budget 745 T€    │ │ Ist 293 JS · Plan heute 45 JS    │ │
│ │ Σ Wertstrom · 2 ARTs               │ │ 05.07.–30.12.2026                │ │
│ └────────────────────────────────────┘ └──────────────────────────────────┘ │
│ ⚠ Beide Abweichungen hängen am €-Satz je Job Size — prüfe den Satz von     │
│   Materials & Energy.                                           [zum Satz ↓] │
│                                                                             │
│ ┌ Deckung — Last gegen Budget je ART · H2 2026 ─────────────────── #deckung ┐│
│ │ ART               Last        Satz              Last €   Budget  Deckung ││
│ │ Materials & En.   31 F·180 JS 7.953 € [empir.]  1,43 M   126 T   ███▌ 1134 %  fehlen 1,30 Mio € ▸ │
│ │ Plant Eff. (OEE)  65 F·361 JS 15.560 € [empir.][2 ⚠] 5,62 M 619 T ██▌ 908 % fehlen 5,00 Mio € ▸ │
│ │ Σ Wertstrom       96 F·541 JS —               7,05 M  745 T  ██▌ 946 %  fehlen 6,30 Mio €   │
│ │ Σ = Summe der ART-Rechnungen, kein Wertstrom-Satz.                       ││
│ └──────────────────────────────────────────────────────────────────────────┘│
│ ┌ Lieferung — Job Size Plan gegen Ist · Kachel H2 2026 (05.07.–30.12.) ────┐│
│ │ Anzeigen: [Σ Wertstrom ▾]                                                ││
│ │  ╭ Diagramm: Plan · ±20 % · Ist · heute (heutiges JobSizeBurnChart) ╮     ││
│ │ ART               erwartet  Plan heute  Ist   Abweichung                 ││
│ │ Materials & En.   16 JS     8 JS        140   [▲ über Plan +1650 %]      ││
│ │ Plant Eff. (OEE)  40 JS     19 JS       153   [▲ über Plan +705 %]       ││
│ └──────────────────────────────────────────────────────────────────────────┘│
│ ┌ Velocity — JS je Kapazitätseinheit · PIs mit Ende in H2 2025 · H1 2026 ──┐│
│ │ Materials & En.   4,2  ▁▃▅▆  3 PIs gezählt                              ▸ ││
│ │ Plant Eff. (OEE)  3,1  ▂▂▃▄  3 PIs gezählt                              ▸ ││
│ │ Σ Wertstrom       3,5  ▁▂▄▅  6 PIs gezählt  ⓘ gleiche Kapazitätseinheit   ││
│ └──────────────────────────────────────────────────────────────────────────┘│
│ Betrieb zählt hier nicht mit — er bezahlt kein Feature. → Business Case     │
└─────────────────────────────────────────────────────────────────────────────┘
```

Die Σ-Werte der Kacheln stammen vom Wertstrom „Produktion" (H2 2026). Die
ART-Zeilen, Sätze und Velocity-Werte sind **erfunden**, zur Illustration. Die
Zeilen sind breiter als das Raster; auf der Fläche bricht die Tabelle unter
`md` in gestapelte Zeilen um.

### B2 · Anforderungen

**REQ-1 · Zwei KPI-Kacheln, gleichrangig.**

- Oben stehen nebeneinander „Deckung" und „Lieferung"; unter `md`
  untereinander.
- Jede Kachel trägt:
  - ein Urteil als Chip (Wort plus Farbe, nie Farbe allein, ADR-0021);
  - eine Kernzahl;
  - eine Zeile mit den zwei Grössen, aus denen sie entsteht;
  - **ihren Zeitraum** im Titel.
- **Deckung:**
  - Chips `Überbucht` · `Gedeckt` · `Nicht berechenbar` · `Leer`;
  - Kernzahl „fehlen X €" oder „X € frei";
  - Zeile „Last … · Budget …";
  - Zeitraum: das Halbjahr des Umschalters.
- **Lieferung:**
  - Chips `Im Band` · `Über Plan` · `Unter Plan` · `Kein Plan`;
  - Kernzahl ist die Abweichung in %;
  - Zeile „Ist … JS · Plan heute … JS";
  - Zeitraum: die geltende Kachel mit Daten.
  - Ohne geltende Kachel: `Kein Plan`, dazu der heutige Text `keineKachel`,
    einzeilig.
- Mit Wertstrom-Recht rechnen die Kacheln über den Wertstrom („Σ Wertstrom ·
  n ARTs"). Ohne das Recht rechnen sie über die sichtbaren ARTs und nennen sie
  so.

**REQ-2 · Querhinweis „Satz prüfen".**

- Eine reine Regel `rateSuspicion(arts)` in `server/views/budget-kpis.ts`
  (Falter, testbar).
- Sie markiert ein ART, wenn Deckung und Lieferung **gegenläufig** weit
  danebenliegen:
  - überbucht um mehr als 50 % **und** Ist mehr als 50 % über dem Plan
    (Satz vermutlich zu hoch);
  - **oder** mehr als 50 % Budget frei **und** Ist mehr als 50 % unter dem
    Plan (Satz vermutlich zu niedrig).
- Die Schwelle ist eine benannte Konstante.
- Gibt es markierte ARTs, steht zwischen Kacheln und Karten ein Banner:
  - er nennt die ARTs;
  - er verlinkt auf deren „Wie gerechnet?" in der Deckungs-Karte (Anker).
- Keine Markierung, kein Banner.
- In der Deckungstabelle trägt die Satz-Zelle eines markierten ARTs zusätzlich
  den Chip `prüfen`.

**REQ-3 · Karte „Deckung" (Anker `#deckung`).**

- Eine Vergleichstabelle. Zeilen: die sichtbaren ARTs, dann `Σ Wertstrom`, nur
  mit Recht.
- Spalten:
  - ART;
  - Feature-Last „F · JS";
  - €-Satz mit Quellen-Chip `empirisch` · `geschätzt` · `Vorgabe` ·
    `kein Satz`, bei Vorbehalten zusätzlich „n Vorbehalte";
  - Last €;
  - Budget €;
  - Deckung als Balken (Last ÷ Budget, 100-%-Marke; über 100 % gekappt
    gezeichnet, Zahl ungekappt);
  - Lücke als Wort: „fehlen X €" · „X € frei" · „—".
- **Kein negatives Vorzeichen** für die Lücke. Die Richtung trägt das Wort.
- ARTs ohne Satz:
  - Last „—", Deckung „—", Zeile mit Chip `kein Satz`.
  - Die Σ-Zeile trägt „ohne {Namen}". Die heutige Regel `withoutRate` bleibt.
- Unter der Σ-Zeile eine Hinweiszeile statt des Fliesstexts: „Σ = Summe der
  ART-Rechnungen, kein Wertstrom-Satz."
- Jede ART-Zeile hat ein aufklappbares **„Wie gerechnet?"** (REQ-6).

**REQ-4 · Karte „Lieferung".**

- **Ein** Diagramm, das heutige `JobSizeBurnChart`, auf Kartenbreite.
- Eine Auswahl „Σ Wertstrom / {ART}" über `?kpiArt=`. Ohne Recht fehlt
  „Σ Wertstrom", wie im Portfolio Sync (`resolveKpiSelection`).
- Darunter eine Tabelle je ART: erwartet · Plan heute · Ist · Abweichung als
  Chip.
  - Ein Klick auf die Zeile wählt das Diagramm.
  - ARTs ohne Plan stehen mit Grund-Chip (`kein Satz` · `kein Budget`) da,
    statt still zu fehlen.
- Kopfsatz und Meta-Zeile des Diagramms werden eine Zeile. Die Legende bleibt.
- `JobSizeBurnChart` bleibt kompatibel für den Portfolio Sync. Neue Optionen
  nur als optionale Props.

**REQ-5 · Karte „Velocity"** (nur mit Drumbeat).

- Eine Zeile je ART, dazu Σ mit Recht:
  - Ø-Zahl (1 Nachkommastelle);
  - Sparkline;
  - „n PIs gezählt" (`countedCount`).
- Das Fenster steht einmal im Kartenkopf.
- Aufklappbar je Zeile: die heutige PI-Tabelle.
- Die Fussnote „gleiche Kapazitätseinheit" wird ein Info-Hinweis an der
  Σ-Zeile.

**REQ-6 · „Wie gerechnet?" je ART** (in der Deckungs-Karte).

- Eingeklappt. Offen nur, wenn `rate.source === "none"` und der Betrachter
  schätzen darf; so wie heute.
- Inhalt:
  1. ein Satz zur Quelle, die heutigen Texte gekürzt auf eine Zeile;
  2. **neu:** eine Mini-Tabelle der Halbjahre im Fenster (Halbjahr · Budget ·
     fertige JS · Features), aus `JobSizeRate.cycles`;
  3. eigenständige Features, falls > 0;
  4. die Vorbehalte als Liste;
  5. das Schätzformular (`RateEstimateForm`, unverändert, mit denselben
     Rechten).

**REQ-7 · Texte.**

- Alle sichtbaren Texte über i18n, de und en.
- Die sieben Vorbehalte in `art-throughput.ts` werden Schlüssel mit Parametern.
  Die Domain liefert `{ key, params }` statt fertiger deutscher Sätze.
- Hart codiert sind heute auch diese Texte, sie wandern mit:
  - „Wofür · eingeplant";
  - „{Wertstrom} · gesamt";
  - die Reiter-Namen der Seite.
- Die Fussnote „Betrieb zählt nicht mit" wird eine Zeile mit Link zum Business
  Case.

**REQ-8 · Form.**

- SectionCard wie auf den Nachbarreitern.
- Zahlen `tabular-nums`, rechtsbündig.
- Nur `text-label` und `text-meta`, keine freien Grössen.
- Status immer als Wort plus Farbe.
- Ziel: **höchstens 1,5 Bildschirmhöhen** bei 2–5 ARTs, alles eingeklappt.

**REQ-9 · Unverändert.**

- Die Rechnung: `loadBudgetKpis`, `loadArtCoverages`, `loadPiVelocity`,
  Budget-Stichtag.
- Neu im Modell nur:
  - `rateSuspicion` (REQ-2);
  - die Durchreichung von `rate.cycles` und `countedCount`.
- Keine neue Abfrage.
- Der leere Wertstrom (keine ARTs) bleibt ein EmptyState.
- `CoverageOneLiner` auf dem ART-Reiter bleibt und verlinkt auf `#deckung`.

### B3 · Tests

- `rateSuspicion`:
  - überbucht und über Plan;
  - frei und unter Plan;
  - gleichläufig (kein Hinweis);
  - an der Schwelle;
  - ohne Satz / ohne Plan.
- Render — KPI-Kacheln:
  - der Zeitraum im Titel;
  - die Urteils-Chips;
  - „fehlen / frei" ohne Minuszeichen;
  - der Umfang ohne Wertstrom-Recht.
- Render — Deckungstabelle:
  - Σ nur mit Recht;
  - der Chip der Satz-Quelle;
  - `kein Satz` → „—";
  - „Wie gerechnet?" offen ohne Satz und mit Recht;
  - die Halbjahres-Mini-Tabelle.
- Render — Lieferung: Auswahl und Zeilen; ARTs ohne Plan mit Grund-Chip.
- Render — Velocity: Zeilen und `countedCount`; ohne Drumbeat keine Karte.
- Die Vorbehalte als i18n-Schlüssel, abgedeckt durch die Katalog-Parität und
  `art-throughput.test.ts` (Schlüssel und Parameter statt Text).
- Die bestehenden Tests zu Burn-Chart, Schätzformular, Panel und Sync bleiben
  grün.

### B4 · Betroffene Dateien

| Datei                                                                          | Änderung                                                                       |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| `src/app/[locale]/(dashboard)/budgeting/_components/budget-kpi-panel.tsx`      | Neuer Aufbau: Kacheln, Banner, drei KPI-Karten                                 |
| `src/modules/budgeting/features/components/art-budget/coverage-card.tsx`       | Wird zu Kachel + Deckungstabelle + „Wie gerechnet?"; `CoverageOneLiner` bleibt |
| `src/modules/budgeting/features/components/art-budget/job-size-burn-chart.tsx` | Einzeiliger Kopf, optionale Breite; sonst kompatibel                           |
| `src/modules/drumbeat/features/cockpit/components/pi-velocity-table.tsx`       | Zeilen-Ansicht plus aufklappbare Tabelle                                       |
| `src/modules/budgeting/server/views/budget-kpis.ts`                            | `rateSuspicion`, Deckung/Lieferung-Kopf als Falter                             |
| `src/modules/budgeting/domain/art-throughput.ts`                               | Vorbehalte als `{ key, params }`                                               |
| `messages/de.json`, `messages/en.json`                                         | Neue und verlagerte Schlüssel                                                  |

ADR-0013 bleibt gewahrt. Die Velocity kommt aus Drumbeat und wird weiter im
Composition Root (`budget-kpi-panel.tsx`) als Slot hereingereicht; Budgeting
importiert Drumbeat nicht.

### B5 · Nicht in dieser Spec

- **Last je Arbeitstyp** (`plannedByBucket`). Sie gehört zu Guardrail 2 im
  Kapazitätsplan. Denkbar ist später eine vierte Karte, heute nicht.
- **Andere Rechnung des Satzes.** Der Querhinweis macht das Problem sichtbar,
  er ändert die Rechnung nicht. Ob der Satz anders abgeleitet werden soll
  (Fenster, Gewichtung), ist eine eigene Entscheidung.
- **Die übrigen Reiter** der Wertstrom-Seite.

## Offene Fragen

1. **Schwelle des Querhinweises.** Vorschlag: 50 % in beide Richtungen. Soll
   sie tenant-weit einstellbar sein, oder reicht eine Konstante?
2. **Lieferungs-Kachel ohne geltende Kachel.** Vorschlag: `Kein Plan` mit
   einzeiligem Grund. Alternativ die Kachel ganz ausblenden; dann stünde die
   Deckung allein.
3. **Velocity-Σ ohne Wertstrom-Recht.** Heute entfällt sie mit der
   Σ-Zeile. Soll ein Betrachter mit nur einem ART überhaupt eine Velocity-Karte
   mit einer einzigen Zeile sehen, oder stattdessen die Zahl in der
   Deckungstabelle?

## Umsetzung

Umgesetzt in `budget-kpi-overview.tsx` (Kacheln, Hinweis, Deckung, Lieferung),
`pi-velocity-table.tsx` (`PiVelocityRows`), `budget-kpis.ts` (`rateSuspicion`,
`burnStatus`, `coverageRatio`) und `budget-kpi-panel.tsx`. Die offenen Fragen
sind mit den Vorschlägen entschieden: Schwelle als Konstante
(`RATE_SUSPICION_THRESHOLD` = 50 %), „Kein Plan" mit einzeiligem Grund, die
Velocity-Karte auch ohne Σ.

Abweichungen von der Spec:

- **Lieferung ohne Auswahlfeld.** Die Zeilen der Tabelle sind die Auswahl
  (`?kpiArt=`); ein zusätzliches Auswahlfeld hätte dasselbe zweimal angeboten.
- **Unter `md`** stapeln die Spalten der Deckungstabelle; jeder Wert trägt dann
  seine Spaltenüberschrift als Etikett.
- `StreamCoverageCard`, `ArtCoverageCard` und die alte Satz-Herleitung sind
  entfernt; `CoverageOneLiner` bleibt und verlinkt auf `#deckung`.
