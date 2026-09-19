# Der ART-Rahmen finanziert auch Arbeit ohne Epic

> Sechste Spec der ART-Budget-Reihe. Sie kommt nach
> [art-budget-process-layout.md](art-budget-process-layout.md) und ändert als
> einzige der Reihe das **Datenmodell**.
>
> Wireframe, Teil B:
> https://claude.ai/code/artifact/c8d4b977-b4b6-4f66-bf9c-8a049f15b2ca

## Anlass

Ein ART-Improvement-Budget bezahlt nicht nur ART-Epics, sondern **alle** Arbeit
des ARTs — auch Features, die an keinem Epic hängen. Die Verteilliste kannte nur
Epics; „Noch zu verteilen" behauptete deshalb mehr Freiheit, als da war.

Die Vorgabe dazu, wörtlich: _„Ich will auf jeden Fall nicht, dass ich jedes
Feature einzeln budgetiere."_

## 1 · Befund — die Lastseite wusste es längst

`domain/art-throughput.ts` sagt für den €-Satz seit jeher:

> „Er verändert den Satz **nicht**: das ART-Budget finanziert alles, was das ART
> tut, also gehört auch alles in den Nenner."

Dazu passt der Rest der Rechnung: `aggregateArtFeatureLoad` zählt für die
Deckung **alle** Features eines ARTs ohne Epic-Filter, und
`standaloneJobSize`/`standaloneFeatureCount` weisen die eigenständige Arbeit
bereits aus. Der Marker ist `parentId === null`.

**Vollständig war damit nur die Lastseite.** Die Zuteilungs-Seite tat so, als
wäre alles Epic — und genau dort entstand die Lücke.

## 2 · Zielbild — eine Zeile, keine Liste

In der Verteilliste steht neben den ART-Epics eine feste Zeile **„ART-eigene
Arbeit (ohne Epic)"**, die der RTE einmal je Halbjahr beziffert. Dieselbe
Mechanik wie eine Epic-Zeile: Richtwert, Eingabefeld, ein gemeinsamer Deckel.

Sie steht auch dann da, wenn **kein** eigenständiges Feature eingeplant ist —
ein RTE darf reservieren, bevor das erste angelegt wird.

**Verworfen: bloßes Umbenennen** von „Noch zu verteilen" in „Verfügbares
Budget". Im Wort ehrlicher, in der Zahl genauso falsch: es behauptet Freiheit,
die durch laufende ART-Arbeit schon gebunden ist.

## 3 · Der Richtwert — und warum er nicht im Feld steht

```
Richtwert = Σ Job Size der eigenständigen, in diesem Halbjahr per PI
            eingeplanten Features  ×  €-Satz dieses ARTs
```

Gerechnet in `domain/art-own-work.ts` (`ownWorkGuide`), gespeist aus
`ArtCoverage.plannedStandalone` — derselbe `aggregateArtFeatureLoad`-Aufruf wie
für die Deckung, nur auf `parentId === null` eingeengt. **Keine zweite
Definition von „eingeplant in diesem Halbjahr".**

**Gemessen für Plant Efficiency (OEE), 2026-H2:** 2 Features · 13 JS ×
13.043 € = **169.559 €** — gegen **58.750 €** offenen Rahmen. Der Satz stammt
aus zwei Halbjahren mit 48 Job-Size-Punkten und schwankt bei jedem einzelnen
Feature erheblich.

**Daraus folgt die Gestaltung:** der Richtwert steht als `geschätzt`-Marke
neben dem Feld, das Feld startet mit dem, was reserviert ist. Als Vorbelegung
wäre er unbrauchbar — 169.559 € in einem Feld mit 58.750 € Deckel. Übersteigt
er den offenen Rahmen, sagt die Fläche das als **Auskunft, nicht als Sperre**.

Ohne €-Satz gibt es keinen Richtwert: dann steht „—", nicht 0 €. Eine Null wäre
eine Aussage, die niemand getroffen hat.

## 4 · Datenmodell

`ArtOwnWorkAllocation` → `art_own_work_allocations`: `tenant_id`, `art_id`,
`cycle_key`, `amount`, `ask`, vier Audit-Spalten, `unique(art_id, cycle_key)`.
**Ein Betrag je ART und Halbjahr.**

**Warum eine eigene Tabelle:** `art_epic_allocations.epic_id` ist NOT NULL mit
Fremdschlüssel und `unique(art_id, epic_id, cycle_key)`. Eine Zeile ohne Epic
bräuchte dort einen nullable Fremdschlüssel **und** einen partiellen
Unique-Index — zwei Sonderfälle in jeder bestehenden Abfrage.

**Kein Eintrag in `budget_allocations`.** Die Epic-Zuteilung schreibt dort die
Zyklus-Karte eines Epics fort; hier gibt es keins. Die Reservierung taucht
deshalb in keiner Epic-Sicht auf — richtig so, sie finanziert Arbeit ohne
Vorhaben.

Angelegt von Hand (kein `prisma db push`), Policy-Block in
`prisma/sql/rls-hardening.sql` ergänzt.

## 5 · Requirements

**REQ-1 · Eine Zeile, kein Feature einzeln.** Ein Betrag je ART und Halbjahr.

**REQ-2 · Ein Deckel für beides.** Epic-Zuteilungen und Reservierung zehren
denselben Rahmen auf; geprüft wird die Summe, in derselben Transaktion — im
Sammel- **und** im Einzelweg. Getrennt geprüft liesse sich der Rahmen zweimal
ausschöpfen.

**REQ-3 · Eine fehlende Angabe überbucht nicht.** Schickt ein Formular die
Reservierung nicht mit, zählt die **bestehende** gegen den Deckel.

**REQ-4 · Der Rahmen weist beide Wege getrennt aus.** `ArtEpicBudget` trägt
`distributedToEpics` und `distributedToOwnWork`; `distributed` ist ihre Summe.
Damit folgen Kachel, Reiter-Badge, Finanzierungskette und Inbox der
Reservierung, ohne dass eine von ihnen etwas davon wissen muss.

**REQ-5 · Der Richtwert ist eine Schätzung.** Gekennzeichnet, nie vorbelegt,
„—" ohne Satz.

**REQ-6 · Keine Doppelzählung.** Nur `parentId === null` **und** per PI in
diesem Halbjahr. Features unter einem Epic hängen an dessen Zuteilung;
Backlog-Features binden dieses Halbjahr nichts.

**REQ-7 · Kein Produkt-Manager-Weg.** Er verantwortet **eine Solution**; die
eigenständige Arbeit eines ARTs ist keine. `mayDistributeToOwnWork` ist
`mayDistributeToEpic` ohne diesen Weg — eine Regel, ein Ort.

**REQ-8 · Der Business Case zerlegt den Rahmen.** „an ART-Epics" und „für
ART-eigene Arbeit" als eigene Zeilen; Σ Veränderung und Σ gesamt ändern sich
**nicht**.

## 6 · Bewusster Verzicht

- **`coverage.allocated` bleibt unverändert.** Die Reservierung geht denselben
  Weg wie die Epic-Zuteilungen aus dem Rahmen — und die zählen dort heute nicht
  (§5(b) von `art-budget-process-layout.md`). Der Versatz wächst damit; das ist
  hier festgehalten und nicht nebenbei geändert.
- **Kein neuer Rechenweg für den €-Satz** (REQ-18 der Prozess-Spec).
- **Keine Aufteilung der Reservierung** auf Themen oder Teams. Wenn sich das als
  nötig erweist, ist es eine eigene Entscheidung.

## 7 · Verifikation

1. `npx tsc --noEmit`, `pnpm lint`, `pnpm test`, `pnpm build`.
2. **Am Bestand gemessen** (Plant Efficiency, 2026-H2, Reservierung 20.000 €):
   Rahmen 135.000 € = 76.250 € an Epics + 20.000 € eigene Arbeit + 38.750 €
   offen.
3. **Σ bleibt Σ:** Business-Case-Probe über 22 Wertströme ✓, alle Summenzeilen
   zeichengleich zum Stand davor; nur die Zerlegung der Rahmen-Zeile ist neu.
4. **Die Deckung rührt sich nicht:** KPI-Probe über 11 Wertströme ✓, Zahlen
   unverändert — wie in §6 festgelegt.
5. Der Leerfall: kein €-Satz, kein eigenständiges Feature.

## 8 · Datenlage-Warnung

Im Bestand hat **jedes** ART exakt zwei eigenständige Features mit zusammen
13 JS — ein Muster der Testdaten. Wie groß der Anteil ART-eigener Arbeit real
ist, sagen diese Daten **nicht**. Der gemessene Richtwert von 169.559 € zeigt
die Mechanik, nicht die Wirklichkeit.

## 9 · Referenzen

- [art-budget-process-layout.md](art-budget-process-layout.md) — der Schnitt
  nach Prozess und Eigentümer; §3 (Business Case) bekommt durch diese Spec eine
  Zeile
- [art-budget-transparency.md](art-budget-transparency.md) — Zustandsstaffel,
  €-Satz, die zwei Ampeln
- [art-budget-consolidation.md](art-budget-consolidation.md) — §2.6: Betriebsgeld
  bleibt aus der Deckung heraus
- ADR-0021 (visuelle Sprache), ADR-0013 (Schichtung)
