# ART-Epics — Guardrail 3 und der ART-Epic-Budget

> Status: **Spec / zur Umsetzung** · Erstellt 2026-09-02 · Entscheidungen
> eingearbeitet 2026-09-02
>
> Wireframes: <https://claude.ai/code/artifact/9ae8ecef-d56b-4df4-80c4-d821a333f901>
>
> Heute ist jedes Epic ein Portfolio-Epic: es kommt auf die PB-Liste einer
> Budget-Kachel und wird dort finanziert — unabhängig davon, ob es 40.000 € oder
> 4 Mio. € kostet. **Guardrail 3 („welche Vorhaben braucht eine
> Portfolio-Entscheidung") existiert im Code nicht.**
>
> Ziel: Ein **Portfolio-Limit** trennt die Epics. Darüber entscheidet das
> Portfolio wie bisher. Darunter ist es ein **ART-Epic** und wird aus dem Topf
> des ARTs finanziert — den der ART selbst auf seine Epics verteilt.
>
> Baut auf [art-budget-transparency.md](art-budget-transparency.md) auf und
> ändert dort eine Festlegung (§9).

---

## 1 Ausgangslage

### 1.1 Guardrail 3 gibt es nicht

`Tenant.guardrailTargets` kennt drei Gruppen: `horizon`, `capacity`,
`engagement`. Es gibt im gesamten Code **keine Schwelle**, ab der ein Vorhaben
eine Portfolio-Entscheidung braucht — weder tenant-weit noch je Wertstrom.

### 1.2 Die PB-Liste kennt keine Größe

`loadRoundPB-Liste` filtert auf Tenant, `level = EPIC`, `stagedForBudgeting` und
„Hypothese **oder** Business Case freigegeben". Kein Betrag, kein Wertstrom, kein
ART. Ein 40.000-€-Epic steht auf demselben PB-Liste wie ein 4-Mio.-€-Epic und
konkurriert in denselben Verteilrunden.

### 1.3 Es gibt genau eine Geldquelle

`BudgetAllocation[cycleKey]` wird **ausschließlich** von `finalizePeriodRound`
geschrieben. Und genau diese Summe ist das blockierende Kriterium des
Reifegrad-Schritts **L3.1 → L3.2**:

```ts
satisfied: (f) => f.budgetAllocationSum > 0;
```

Wer kein Kachel-Budget bekommt, kommt nicht in die Umsetzung. Für ein
20.000-€-Vorhaben ist das ein halbes Jahr Wartezeit auf eine Entscheidung, die
niemand auf Portfolio-Ebene treffen müsste.

### 1.4 Der Run-the-Business-Topf existiert, ist aber blind für ARTs

`RunTheBusinessItem` hängt am Wertstrom (`valueStreamId`, optional
`solutionId`). Beim Start jeder Runde materialisiert
`materializeRtbCandidates` die aktiven Positionen als Kandidaten — mit
`artId: null`, ausdrücklich gesetzt. Der Topf ist damit heute **nicht** einem ART
zurechenbar.

---

## 2 Die Regel: was ist ein ART-Epic

**Allein die Kostengröße entscheidet.** Kein Schalter, kein Feld, keine manuelle
Einstufung:

```
Business Case freigegeben?
  ├─ nein  →  keine Klasse. Bleibt Portfolio-Sache.
  └─ ja    →  Kosten = Σ costSlices
                Kosten  >  Portfolio-Limit  →  Portfolio-Epic
                Kosten  ≤  Portfolio-Limit  →  ART-Epic
```

**Nur ein freigegebener Lean Business Case begründet eine Klasse.** Wer nur eine
Hypothese hat, trägt keine Kostenschätzung, sondern den tenant-weiten
Default-Aufwand — und der liegt unter jedem sinnvollen Limit. Würde er
klassifizieren, träfe die Regel eine Aussage über die **Reife** des Artefakts und
gäbe sie als Aussage über die **Größe** aus. Die Messung in §12 zeigt genau
das.

Das Portfolio-Limit ist **Guardrail 3**, Vorschlagswert 100.000 €.

Die Klasse ist **abgeleitet, nicht gespeichert** — dieselbe Entscheidung wie beim
Investitionshorizont, der aus der Primär-Solution kommt, und beim Richtwert, der
aus dem Artefakt kommt. Eine gespeicherte Klasse würde als zweite Wahrheit neben
den Kosten stehen und auseinanderlaufen.

### 2.1 Drei Randfälle, die die Regel beantworten muss

| Fall                                    | Verhalten                                                                                                                                               |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Weder Hypothese noch Business Case frei | **Keine Klasse.** Das Epic ist weder ballot- noch verteilfähig — wie heute.                                                                             |
| Nur Hypothese freigegeben               | **Keine Klasse.** Das Epic bleibt Portfolio-Sache, bis sein Business Case freigegeben ist — die Konkretisierung wird weiter über die Kachel finanziert. |
| Kosten ändern sich über die Grenze      | Siehe §6 — die Klasse folgt den Kosten, die **Finanzierung** eines laufenden Zyklus nicht.                                                              |

Damit entsteht die Klasse **genau dann**, wenn zum ersten Mal eine belastbare
Zahl vorliegt — mit der Freigabe des Business Case an L3.1. Vorher ist ein Epic
weder ART- noch Portfolio-Epic, sondern schlicht noch nicht eingeordnet.

---

## 3 Was gleich bleibt

Ein ART-Epic ist ein ganz normales Epic: dieselben Reifegrade und Stempel,
dieselbe Hypothese, derselbe Business Case, dieselben KPIs und Ziel-Verknüpfungen,
dieselbe Timeline, dieselben Features, dieselbe Darstellung in Portfolio-Review,
Guardrails und Reporting.

**Genau eine Sache ist anders: woher das Geld kommt.**

---

## 4 Was sich ändert: eine Zielgröße, zwei Quellen

```
Portfolio-Epic   PB-Liste → Gruppen verteilen → finalAmount ─┐
                                                            ├→ BudgetAllocation[cycleKey]
ART-Epic         ART-Epic-Budget → der ART verteilt ──────────────┘        │
                                                                     ▼
                                                        L3.1 → L3.2 „Budget alloziert"
```

Beide Wege münden in **dieselbe** `BudgetAllocation`. Das ist die tragende
Entscheidung dieses Konzepts: Der Reifegrad, das Portfolio-Dashboard, die
Kostenkurve, die Budget-Plan-Revision und die Zustandsstaffel aus der
Budget-Transparenz-Spec funktionieren dadurch **unverändert weiter**. Sie fragen
nach dem Betrag, nicht nach seiner Herkunft.

Was neu unterschieden werden muss, unterscheidet ein eigenes Ledger (§7), nicht
eine zweite Zielgröße.

---

## 5 Der ART-Epic-Budget

### 5.1 Das Problem mit „Run the Business"

Der Topf soll aus den Run-the-Business-Mitteln des Wertstroms bzw. ARTs kommen.
Damit würde **Veränderungsarbeit aus dem Betriebstopf bezahlt** — und genau
diese Trennung tragen heute mehrere Flächen: die Grow-/Run-Kacheln der Solution,
der Run-Anteil im Wertstrom, die Gliederung der PB-Liste in „Run the Business" und
„Grow the Business", und Guardrail 2.

Deshalb: **der ART-Epic-Budget ist eine eigene Position im selben Mechanismus**, kein
Anteil am Betrieb. `RunTheBusinessItem` bekommt eine Art:

| Art             | Bedeutung                                          | Zählt als |
| --------------- | -------------------------------------------------- | --------- |
| `run` (Default) | Betrieb — heutiges Verhalten, unverändert          | Run       |
| `art_change`    | **ART-Epic-Budget eines ARTs** für seine ART-Epics | Grow      |

Beide gehen wie bisher als Kandidaten auf die PB-Liste, werden dort mitverteilt und
bekommen ihren `finalAmount`. Das Verfahren bleibt: Der Wertstrom entscheidet in
der Kachel, **wie groß** der Rahmen des ARTs ist; der ART entscheidet danach,
**wofür**. Der Betrieb bleibt Betrieb.

### 5.2 Der Topf eines ARTs

```
ART-Epic-Budget(art, cycle) = Σ finalAmount der Kandidaten
                       mit kind = "rtb", art = <art>, Art = "art_change",
                       aus Kacheln mit cycleKey = <cycle>
```

Voraussetzung ist `RunTheBusinessItem.artId` — die Spalte, die bereits in
[art-budget-transparency.md](art-budget-transparency.md) §3 vorgesehen ist. Sie
wird hier von „nice to have" zu **tragend**. Ebenso muss
`materializeRtbCandidates` das bisher fest auf `null` gesetzte `artId` künftig
aus der Position übernehmen.

---

## 6 Klassenwechsel und Doppelfinanzierung

**Zwei Regeln verhindern, dass Geld doppelt oder gar nicht fließt:**

**R1 · Die Klasse steuert die Quelle.** Der PB-Liste zeigt ausschließlich
Portfolio-Epics; die ART-Verteilung ausschließlich ART-Epics desselben ARTs. Ein
Epic kann pro Zyklus aus genau einer Quelle Geld bekommen — geprüft beim
Schreiben, nicht nur in der Anzeige.

**R2 · Finanzierung schlägt Klassenwechsel — innerhalb des Zyklus.** Steigen die
Kosten eines ART-finanzierten Epics über das Limit, behält es sein Geld für den
laufenden Zyklus und wird als **gewechselt** markiert; ab dem nächsten Zyklus
gehört es auf den PB-Liste. Umgekehrt genauso. Ohne diese Regel würde
zugeteiltes Geld unsichtbar, sobald jemand eine Kostenscheibe ändert.

Beide Richtungen brauchen einen sichtbaren Hinweis — auf der ART-Fläche
(„verlässt den ART-Epic-Budget zum nächsten Zyklus") und in der PB-Liste-Setup („kommt neu
dazu").

**R3 · Ohne Rahmen kein Weg — und ein Ventil dagegen.** Hat ein ART für den
Zyklus keinen ART-Epic-Budget, oder trägt ein Epic gar keinen ART, dann ist
es nach der Trennung **weder über die PB-Liste noch über einen Topf finanzierbar**.
Das wird ausgewiesen, nicht verschwiegen: das Epic trägt den Zustand **„kein
Finanzierungsweg"** — auf der ART-Fläche, in der Epic-Liste und am Epic selbst.

Das Ventil dazu ist die **Ausnahme**: ein Epic kann mit Pflicht-Begründung
bewusst aufs PB-Liste gehoben werden — für ein kleines, aber strategisch
heikles oder ART-übergreifendes Vorhaben, und als Ausweg aus der Sackgasse. Die
Klasse bleibt abgeleitet; der Override ist ein eigenes, auditiertes Feld, das in
die Ableitung eingeht:

```
Klasse = f(Kosten, Limit, Override)
```

Ohne dieses Ventil wäre die Sackgasse eine Falle. Mit ihm ist sie ein sichtbarer
Zustand mit einem benannten Ausweg.

---

## 7 Datenmodell

| Änderung                                                                                                                                                                             | Warum                                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Guardrail-Ziele um `approval: { portfolioThreshold: number }` erweitern — im Tenant-JSON und in der Wertstrom-Tabelle aus der Budget-Transparenz-Spec                                | Guardrail 3, mit derselben Vererbung wie Guardrail 2                                                                                                                                         |
| `RunTheBusinessItem.kind String @default("run")`                                                                                                                                     | Betrieb vs. ART-ART-Epic-Budget (§5.1)                                                                                                                                                       |
| `RunTheBusinessItem.artId String? @db.Uuid` + FK + Index                                                                                                                             | bereits in der Budget-Transparenz-Spec; hier tragend                                                                                                                                         |
| Neue Tabelle **`ArtEpicAllocation`** (`tenantId`, `artId`, `epicId`, `cycleKey`, `amount`, **`ask`** = eingefrorener Richtwert, Audit-Felder, `@@unique([artId, epicId, cycleKey])`) | Das Ledger der ART-Verteilung                                                                                                                                                                |
| Override-Feld am Epic (`portfolioOverride` + Pflicht-Begründung), auditiert                                                                                                          | Die Ausnahme aus §6                                                                                                                                                                          |
| `BudgetPlanSnapshot`-Payload trägt je Epic die **Quelle**                                                                                                                            | Sonst vermischt der eingefrorene Beleg beide Wege und kann sie später nicht mehr trennen. Alte Revisionen tragen das Feld nicht — der Leser zeigt „unbekannt", statt „Portfolio" zu raten.   |
| ~~RLS-Policies für alle Budgeting-Tabellen~~ — **gestrichen**, siehe §16                                                                                                             | In dieser Datenbank hat **keine** Tabelle RLS aktiv, auch keine der 14 aus `rls.sql`. Die Mandantentrennung liegt bewusst in der Anwendung; RLS scharf zu schalten ist ein eigenes Vorhaben. |

`ArtEpicAllocation` ist bewusst eine eigene Tabelle und nicht ein Feld in der
`BudgetAllocation`-JSON-Karte:

- Die JSON-Karte ist eine **Fortschreibung** ohne Historie; die ART-Verteilung
  braucht Herkunft, Zeitpunkt und Urheber.
- Sie hätte sonst zwei Schreiber mit unterschiedlicher Semantik auf demselben
  Feld — genau das Muster, das der Budgeting-Refactor gerade beseitigt hat.
- Aus dem Vorhandensein einer Zeile ist die **Quelle** ablesbar, ohne die
  Klassifikation neu zu rechnen (§6, R2).

Die Spalte `ask` friert den Richtwert beim **ersten Zuteilen** ein — genau wie
`BudgetCandidate.ask` es beim Kuratieren tut. Ohne sie folgte der Richtwert eines
ART-Epics live seinem Business Case, und die Verteilliste verschöbe sich zwischen
zwei Besuchen, ohne dass jemand etwas getan hätte. Weicht der aktuelle Business
Case später ab, ist das ein sichtbarer Hinweis, keine stille Neuberechnung.

`BudgetAllocation` bleibt die eine app-weite Tatsache für Reifegrad und
Reporting. Die ART-Verteilung schreibt sie fort, wie es die Finalisierung tut.

---

## 8 Die Verteilfläche — wer verteilt, wann und wonach

Ein neuer Abschnitt im Budget-Reiter des ARTs, direkt unter „Was sich verschieben
ließe".

**Verteilt wird der Rahmen nicht vom ART selbst.** Zuständig sind
Wertstrom-Owner, Portfolio-Management und die Finance-Partei des Wertstroms —
dieselbe Runde wie bei den Run-the-Business-Positionen, samt
`financeApproverId`-Bypass. Der RTE hat heute keinerlei Schreibrecht auf seiner
eigenen ART-Seite (`art.update` ist `TENANT_ADMIN`-only) und bekommt hier auch
keines. Genauer gesagt: **der Wertstrom verteilt den Rahmen _für_ den ART**. Die
Fläche liegt beim ART, weil dort der Zusammenhang sichtbar wird — die
Entscheidung liegt es nicht.

```
ART-Epics finanzieren · H1 2026                    Topf 240.000 €
Verteilt 180.000 €  ·  Rest 60.000 €
────────────────────────────────────────────────────────────────────
Epic                          Reifegrad   Richtwert     Zuteilung
Kartenlimit-Widget            L3.1         80.000 €    [ 80.000 ]
SEPA-Fehlercode-Mapping       L3.1         60.000 €    [ 60.000 ]
Self-Service Adressänderung   L3.1         45.000 €    [ 40.000 ]
Token-Vault Ablösung          L1           50.000 €    [      0 ]
────────────────────────────────────────────────────────────────────
                                          235.000 €     180.000 €
                                             [ Speichern ]
```

Regeln der Fläche:

- **Fenster:** verteilt wird für den **laufenden und den nächsten** Zyklus —
  letzteres, sobald dessen Kachel finalisiert ist. Vergangene Zyklen sind
  gesperrt, damit die Zuteilungshistorie unbeweglich bleibt und Kostenkurve wie
  eingefrorener Budget-Plan belastbar sind. Eigene Guard-Funktion, analog zu
  `windowClosedReason` der Gruppen-Verteilung.
- Gelistet werden **ART-Epics dieses ARTs**, die **vorgemerkt** und
  budgeting-reif sind (`stagedForBudgeting` **und** `isPbEligible`). Die
  Vormerkung bleibt der aktive Schritt des Owners — sie meldet für ein ART-Epic
  allerdings keine Portfolio-Runde an, sondern die Verteilung durch den
  Wertstrom; die Beschriftung ist entsprechend zu differenzieren.
- Nichts ist vorbelegt; jede Zuteilung ist eine Entscheidung.
- Sortiert nach Richtwert, nicht nach Eingabe — beim Tippen springt nichts.
- Σ darf den Topf nicht überschreiten. Die Prüfung sitzt **in derselben
  Transaktion** wie der Schreibvorgang, nicht nur im Client — sonst überschreiten
  zwei gleichzeitig Verteilende den Deckel.
- **Der nicht verteilte Rest verfällt nicht und wandert nicht.** Er wird als
  ungenutzter Rahmen ausgewiesen und ist die Grundlage für das Gespräch über den
  nächsten — beim nächsten Rahmen zählt er nicht mit.
- **Ein nachträglich geschrumpfter Topf ist erlaubt.** Wird eine Kachel
  zurückgenommen und mit kleinerem Rahmen neu festgeschrieben, bleiben die
  Zuteilungen stehen; die Fläche weist den Topf als überschritten aus **und nennt
  den Grund**. Die Korrektur ist ein Gespräch, keine Systemsperre auf der
  Finalisierung.
- Gespeichert wird je Zeile eine `ArtEpicAllocation`, danach wird
  `BudgetAllocation[cycleKey]` fortgeschrieben. Betrag 0 löscht die Zeile und den
  Kartenwert.
- Der Reifegrad bewegt sich dadurch **nicht**. Die Zuteilung erfüllt nur das
  blockierende Kriterium für L3.2; beantragt und abgenommen wird wie bisher.

---

## 9 Auswirkung auf die Budget-Transparenz-Spec

[art-budget-transparency.md](art-budget-transparency.md) legt in **REQ-R2**
fest: _„Die Fläche schreibt keine Beträge."_ Das gilt nach diesem Konzept nur
noch **gegenüber dem Portfolio-Budget**. Präziser Ersatz:

> **REQ-R2 (neu)** Die ART-Fläche schreibt keine Beträge des Portfolio-Budgets.
> Sie verteilt ausschließlich den ART-Epic-Budget auf ART-Epics (§8) und merkt Epics
> fürs nächste Budget vor.

Weitere Berührungen, alle additiv:

- Die **Zustandsstaffel** und der **Verlauf** unterscheiden nicht nach Quelle —
  sie lesen `BudgetAllocation`. Nichts zu tun.
- Die **Kopfzahlen** des ARTs zeigen künftig zwei Töpfe: Portfolio-Zuteilung und
  ART-Epic-Budget. Sie dürfen nicht addiert dargestellt werden, ohne beschriftet zu sein.
- Die **Reallokations-Sicht** gewinnt an Bedeutung: nicht finanzierte ART-Epics
  sind jetzt tatsächlich vom ART selbst finanzierbar — sie stehen nicht mehr nur
  da.
- **Guardrail 2** zählt ART-Epics wie alle anderen; der ART-ART-Epic-Budget
  zählt als Grow (§5.1).

---

## 10 Requirements (testbar)

### Klassifikation

- **REQ-K1** Die Klasse eines Epics wird aus `derivePbInfo(...).cost` gegen das
  aufgelöste Portfolio-Limit berechnet und **nirgends gespeichert**.
- **REQ-K2** Ohne **freigegebenen Business Case** hat ein Epic keine Klasse; es
  bleibt Portfolio-Sache und erscheint nicht in der ART-Verteilliste.
- **REQ-K5** Ein gesetzter Override hebt das Epic unabhängig von seinen Kosten
  auf den PB-Liste; die Begründung ist Pflicht und wird auditiert.
- **REQ-K3** Genau `Kosten > Limit` ist ein Portfolio-Epic; Gleichstand ist ein
  ART-Epic.
- **REQ-K4** Das Limit wird wie Guardrail 2 aufgelöst: Wertstrom-Zeile vor
  Tenant-Default vor Code-Default; die Herkunft wird angezeigt.

### Trennung der Quellen

- **REQ-Q1** `loadRoundPB-Liste` liefert ausschließlich Portfolio-Epics.
- **REQ-Q2** Die ART-Verteilfläche listet ausschließlich ART-Epics des eigenen
  ARTs.
- **REQ-Q3** Ein Epic hat je Zyklus höchstens eine Quelle; der Schreibpfad prüft
  das und lehnt ab, statt zu überschreiben.
- **REQ-Q4** Wechselt ein Epic nach der Zuteilung die Klasse, bleibt die
  Zuteilung des laufenden Zyklus bestehen und wird auf beiden Flächen als
  Wechsel ausgewiesen.
- **REQ-Q5** Ein ART-Epic ohne Rahmen — oder ohne ART — trägt den sichtbaren
  Zustand „kein Finanzierungsweg", mit Verweis auf die Ausnahme nach §6.

### Topf und Verteilung

- **REQ-T1** Der ART-Epic-Budget eines Zyklus ist Σ `finalAmount` der
  `art_change`-Positionen dieses ARTs aus Kacheln dieses Zyklus.
- **REQ-T2** Σ der Zuteilungen darf den Topf nicht überschreiten; die Prüfung
  läuft in derselben Transaktion wie der Schreibvorgang.
- **REQ-T6** Verteilt wird nur für den laufenden und den nächsten Zyklus;
  vergangene sind gesperrt.
- **REQ-T7** Der nicht verteilte Rest wird ausgewiesen, verfällt nicht und wird
  nicht übertragen.
- **REQ-T8** Ein nachträglich geschrumpfter Topf wird als Überschreitung mit
  Grund gezeigt und blockiert die Finalisierung nicht.
- **REQ-T3** Jede Zuteilung erzeugt eine `ArtEpicAllocation`-Zeile und schreibt
  `BudgetAllocation[cycleKey]` fort; 0 entfernt beides.
- **REQ-T4** Die Verteilung ist auditiert (Urheber, Zeitpunkt, Vorher/Nachher).
- **REQ-T5** `materializeRtbCandidates` übernimmt `artId` und `kind` aus der
  Position, statt `artId` auf `null` zu setzen.

### Berechtigungen

- **REQ-B1** Den ART-Epic-Budget verteilt der RTE des ARTs (`Art.rteId`), der
  Wertstrom-Owner und das Portfolio-Management — über einen Service-Seam für den
  RTE, wie ihn Finance über `ValueStream.financeApproverId` hat.
- **REQ-B2** Das Portfolio-Limit pflegt, wer `target.manage` für den Wertstrom
  bzw. den Tenant hält.
- **REQ-B3** Alle Budgeting-Tabellen — die bestehenden wie die neuen — tragen
  RLS-Policies nach dem Muster der 14 bereits abgesicherten.

---

## 11 Offene Entscheidungen

### E1 · Der Abnahmeweg bleibt unverändert — entschieden

Die Vorgabe lautet: ART-Epics funktionieren wie bisher, nur die Geldquelle
unterscheidet sich. Damit braucht ein 40.000-€-Vorhaben weiterhin **an L3.1 die
Zeichnung von fünf Parteien** (MGMT, Business Owner, Finance, IRT-Owner,
LACE/VMO) und **an L3.2 die von VMO und Finance**.

Das ist genau der Aufwand, den Guardrail 3 eigentlich abschaffen soll — der Sinn
einer Genehmigungsschwelle ist, dass unterhalb davon **niemand aus dem Portfolio
zeichnen muss**.

> **Entschieden: es bleibt dabei.** Guardrail 3 entlastet beim Geld, nicht beim
> Verfahren. Zeigt der Pilotbetrieb, dass das bremst, ist der Nachtrag ein
> einzelner PR — `StageGateApproverRule` und `resolveGatePolicy` lösen Regeln
> bereits je Wertstrom und Gate auf; es käme die Dimension „Klasse" hinzu.

Ebenfalls unverändert bleibt der **Nutzen-Apparat**: Benefit-Hypothese,
KPI-Kette, Zwei-Achsen-Auswertung und Zielbeitrag gelten für ART-Epics wie für
jedes andere. Bei kleinen Vorhaben ändert sich weder Verfahren noch
Nutzenmessung — nur die Geldquelle.

### E2 · Der ART-Epic-Budget als eigene Position — oder doch aus dem Betrieb?

§5.1 schlägt `kind = "art_change"` vor, damit Betrieb Betrieb bleibt.

> **Empfehlung:** So umsetzen. Die Alternative — ART-Epics direkt aus den
> Betriebspositionen zu bezahlen — macht vier bestehende Flächen unwahr
> (Grow/Run-Kacheln, Wertstrom-Run-Anteil, PB-Liste-Gliederung, Guardrail 2) und
> spart nur eine Spalte.

### E3 · Ein Limit für alle oder je Wertstrom?

Die Vorgabe nennt ein Limit: 100.000 €.

> **Empfehlung:** Tenant-Default 100.000 €, Überschreibung je Wertstrom möglich —
> dieselbe Tabelle und dieselbe Auflösung wie bei Guardrail 2, also praktisch
> ohne Zusatzaufwand. Ein Wertstrom mit deutlich anderer Vorhabengröße kann sich
> so korrigieren, ohne dass jemand eine zweite Mechanik bauen muss.

---

## 12 Umsetzung in Stufen

0. **Messen** — wie verteilen sich die Kosten der Epics gegen ein Limit, und
   trägt die Datenlage die Ableitungen? Ergebnis siehe §15.
1. **Guardrail 3 als Zahl** — Ziel-Erweiterung, Auflösung, Anzeige auf der
   Guardrails- und der Wertstrom-Fläche. Noch ohne Wirkung.
2. **Klassifikation sichtbar machen** — abgeleitete Klasse am Epic, in der
   Epic-Liste und in der PB-Liste-Setup anzeigen. Immer noch ohne Wirkung auf das Geld;
   erlaubt aber, die Verteilung der Bestands-Epics zu prüfen, **bevor** sie greift.
3. **Der ART-Epic-Budget** — `kind` und `artId` an `RunTheBusinessItem`,
   Materialisierung anpassen, Topf je ART und Zyklus ableiten und anzeigen.
4. **Die Verteilfläche** — `ArtEpicAllocation`, Schreibpfad, Fortschreibung,
   Audit, Berechtigungen.
5. **Die Trennung scharf schalten** — PB-Liste filtert Portfolio-Epics, die
   Verteilfläche ART-Epics, Wechsel-Hinweise auf beiden Seiten.
6. **Optional (E1)** — eigener Gate-Policy-Default für ART-Epics.

Stufe 2 ist der Prüfpunkt: Erst wenn sichtbar ist, wie viele Bestands-Epics
unter das Limit fallen und wie viele davon bereits Kachel-Geld haben, ist
entscheidbar, ob Stufe 5 in einem Schritt oder zum Zyklusbeginn scharf geschaltet
wird.

---

## 13 Wie es scharf geschaltet wird

Der brechende Teil hängt an einer neuen **Practice** `artEpics`
(`operating-model.ts`) — dem Hauptschalter für Komplexität je Mandant. Damit ist
die Trennung je Mandant an- und abschaltbar statt für alle gleichzeitig.

Eine bewusste Abweichung von der Konvention: `DEFAULT_PRACTICES` heißt sonst
„alles an, wenn kein Zielbild definiert ist". `artEpics` steht dort auf `false` —
ein Schalter, der Geldflüsse umleitet, darf nicht stillschweigend angehen. Das
Template **Portfolio SAFe** schaltet ihn dagegen ausdrücklich ein: wer es wählt,
entscheidet sich für das volle Modell.

Solange die Practice aus ist, verhält sich alles wie zuvor: die PB-Liste filtert
nicht, es gibt keine Verteilfläche und keine Klassen-Anzeige.

## 14 Messung (M0) — Befund vom 2026-09-02

Vor der Umsetzung gemessen, lesend, Skript danach gelöscht. **Alle vorhandenen
Daten sind Seed-Daten** — von vier Mandanten tragen zwei Epics. Es gibt keine
echte Nutzung, gegen die sich das Limit kalibrieren ließe; es bleibt eine
Setzung.

### Das Limit hätte nach Reife statt nach Größe getrennt

Pulse Demo Corp, 18 budgeting-reife Epics gegen ein Limit von 100.000 €:

|         | Anzahl    | Σ Richtwert |
| ------- | --------- | ----------- |
| ≤ Limit | 7 (39 %)  | 420.000 €   |
| > Limit | 11 (61 %) | 3.210.000 € |
| Median  |           | 230.000 €   |

Die sieben unter dem Limit waren **exakt die sieben ohne freigegebenen Business
Case** — ihr Richtwert war 7 × 60.000 €, der Tenant-Default-Aufwand. Jedes Epic
mit echtem Business Case lag darüber.

Verschärfend: dieselben sieben tragen bereits **1.660.000 €** an Zuteilungen, im
Schnitt rund 237.000 € — das Vierfache ihres Richtwerts.

**Daraus folgt die Regel in §2:** Nur ein freigegebener Business Case begründet
eine Klasse. Ohne diese Korrektur wäre die Klassifikation eine Reifegrad-Aussage
im Gewand einer Größen-Aussage gewesen, und große, bereits finanzierte Vorhaben
wären in den ART-Epic-Budget gewandert.

### Der empirische €-Satz trägt vorerst nicht

11 abgeschlossene Features mit Σ 58 Job Size im größten Mandanten, **null** im
zweiten. Die Datenqualität ist gut — kein fehlendes Abschlussdatum, 9 %
Platzhalter-Job-Size —, aber der Nenner ist zu klein: ein Satz aus 58 Punkten
schwankt bei jedem einzelnen Feature erheblich.

Die Aggregation wird trotzdem gebaut; der Satz wird als **nicht belastbar**
gekennzeichnet und fällt auf `Tenant.costPerJobSizePoint` zurück, bis genug
Abschlüsse vorliegen.

### Die Erfolgsmessung hat keinen Ausgangswert

Kein Epic unter dem Limit trägt sowohl `businessCaseApprovedAt` als auch
`approvedAt`. Die Wartezeit L3.1 → L3.2, die Guardrail 3 verkürzen soll, ist
heute nicht messbar — direkte Folge des Befunds oben. Sie ist erneut zu messen,
sobald echte Nutzung vorliegt und die korrigierte Regel greift.

## 15 Bewusster Verzicht

- **Keine gespeicherte Klasse.** Sie wäre eine zweite Wahrheit neben den Kosten.
- **Keine zweite Zielgröße neben `BudgetAllocation`.** Zwei Quellen, ein Ziel —
  sonst müsste jede Reporting-Fläche beide addieren und irgendwann eine davon
  vergessen.
- **Keine rückwirkende Umklassifizierung** bereits finanzierter Zyklen.
- **Keine ART-eigene Kachel.** Der ART verteilt seinen Rahmen, er führt kein
  eigenes Beteiligungsverfahren; der Rahmen selbst wird im Wertstrom entschieden.

---

## 16 Row-Level Security — warum sie hier nicht dazugehört

Ursprünglich war vorgesehen, mit den neuen Tabellen auch RLS für das gesamte
Budgeting nachzuziehen. Am Datenbestand geprüft (2026-09-03) hält diese Idee
nicht:

- **Keine Tabelle hat RLS aktiv** — `initiatives` eingeschlossen:
  `relrowsecurity = false`, null Policies. `prisma/sql/rls.sql` existiert, ist in
  dieser Datenbank aber nie angewandt worden.
- Die Anwendung verbindet als **Table Owner** und umginge nicht erzwungene
  Policies ohnehin.
- `src/server/db/prisma.ts` hält das ausdrücklich fest: die Mandantentrennung
  liegt in der Anwendungsschicht, und der Mechanismus, der den JWT-Claim je
  Request setzte, wurde **wegen der Ladezeit entfernt** — er machte aus jeder
  Leseoperation eine Mehrfach-Transaktion und schlug das Pooling tot.
- Dieselbe Datei warnt: wird RLS je gehärtet (`FORCE` plus Nicht-Owner-Rolle),
  **muss** der Claim-Mechanismus zurück, sonst liefert jede Leseoperation leer.

Policies auf die neuen Tabellen zu legen wäre damit Theater: sie gaten nichts.
Sie scharf zu schalten verlangt eine neue Datenbankrolle und die Rückkehr eines
bewusst entfernten Mechanismus — mit seiner Leistungsfrage. Das ist ein eigenes
Vorhaben und gehört nicht in dieses.

## 17 Referenzen

| Aussage                                   | Fundstelle                                                   |
| ----------------------------------------- | ------------------------------------------------------------ |
| Guardrail-Ziele, Validierung, Defaults    | `src/modules/work/domain/portfolio-guardrails.ts`            |
| Vererbung je Wertstrom                    | `src/modules/work/domain/gate-policy.ts`                     |
| Kosten und PB-Liste-Fähigkeit eines Epics | `src/modules/work/domain/pb-submission.ts`                   |
| PB-Liste-Pool                             | `src/modules/budgeting/server/services/ballot.ts`            |
| RtB-Materialisierung (`artId: null`)      | `src/modules/budgeting/server/services/candidate-service.ts` |
| Betrag je Kachel aus der Periode          | `src/modules/budgeting/domain/rtb-interval.ts`               |
| Einziger Schreiber von `BudgetAllocation` | `src/modules/budgeting/server/services/finalize-service.ts`  |
| Kriterium „Budget alloziert"              | `src/modules/work/domain/gate-readiness.ts`                  |
| Gate-Fakt `budgetAllocationSum`           | `src/modules/work/server/services/stage-gate-transition.ts`  |
| Run-the-Business-Positionen               | `src/modules/budgeting/server/services/rtb-item-service.ts`  |
| Was welche Rolle darf                     | `src/server/auth/policies/index.ts`                          |
