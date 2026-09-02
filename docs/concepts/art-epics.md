# ART-Epics — Guardrail 3 und der ART-Topf

> Status: **Konzept / zur Abstimmung** · Erstellt 2026-09-02
>
> Heute ist jedes Epic ein Portfolio-Epic: es kommt auf den Ballot einer
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

### 1.2 Der Ballot kennt keine Größe

`loadRoundBallot` filtert auf Tenant, `level = EPIC`, `stagedForBudgeting` und
„Hypothese **oder** Business Case freigegeben". Kein Betrag, kein Wertstrom, kein
ART. Ein 40.000-€-Epic steht auf demselben Ballot wie ein 4-Mio.-€-Epic und
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
Kosten = derivePbInfo(epic, defaultEffort).cost
         ├─ Business Case freigegeben  → Σ costSlices
         └─ nur Hypothese freigegeben  → Tenant-Default-Aufwand

Kosten  >  Portfolio-Limit   →  Portfolio-Epic
Kosten  ≤  Portfolio-Limit   →  ART-Epic
```

Das Portfolio-Limit ist **Guardrail 3**, Vorschlagswert 100.000 €.

Die Klasse ist **abgeleitet, nicht gespeichert** — dieselbe Entscheidung wie beim
Investitionshorizont, der aus der Primär-Solution kommt, und beim Richtwert, der
aus dem Artefakt kommt. Eine gespeicherte Klasse würde als zweite Wahrheit neben
den Kosten stehen und auseinanderlaufen.

### 2.1 Drei Randfälle, die die Regel beantworten muss

| Fall                                    | Verhalten                                                                                                                         |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Weder Hypothese noch Business Case frei | **Keine Klasse.** Das Epic ist weder ballot- noch verteilfähig — wie heute.                                                       |
| Nur Hypothese freigegeben               | Der Tenant-Default-Aufwand entscheidet. Bei Default 50.000 € und Limit 100.000 € ist **jedes hypothesen-only Epic ein ART-Epic**. |
| Kosten ändern sich über die Grenze      | Siehe §6 — die Klasse folgt den Kosten, die **Finanzierung** eines laufenden Zyklus nicht.                                        |

Der zweite Fall ist eine Konsequenz, keine Nebensache: Epics wandern auf dem Weg
durch die Reifegrade typischerweise **von ART nach Portfolio** — erst
hypothesen-klein, dann mit ausgearbeitetem Business Case groß. Die Fläche muss
das anzeigen, nicht verstecken.

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
Portfolio-Epic   Ballot → Gruppen verteilen → finalAmount ─┐
                                                            ├→ BudgetAllocation[cycleKey]
ART-Epic         ART-Topf → der ART verteilt ──────────────┘        │
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

## 5 Der ART-Topf

### 5.1 Das Problem mit „Run the Business"

Der Topf soll aus den Run-the-Business-Mitteln des Wertstroms bzw. ARTs kommen.
Damit würde **Veränderungsarbeit aus dem Betriebstopf bezahlt** — und genau
diese Trennung tragen heute mehrere Flächen: die Grow-/Run-Kacheln der Solution,
der Run-Anteil im Wertstrom, die Gliederung des Ballots in „Run the Business" und
„Grow the Business", und Guardrail 2.

Deshalb: **der ART-Topf ist eine eigene Position im selben Mechanismus**, kein
Anteil am Betrieb. `RunTheBusinessItem` bekommt eine Art:

| Art             | Bedeutung                                             | Zählt als |
| --------------- | ----------------------------------------------------- | --------- |
| `run` (Default) | Betrieb — heutiges Verhalten, unverändert             | Run       |
| `art_change`    | **Veränderungsrahmen eines ARTs** für seine ART-Epics | Grow      |

Beide gehen wie bisher als Kandidaten auf den Ballot, werden dort mitverteilt und
bekommen ihren `finalAmount`. Das Verfahren bleibt: Der Wertstrom entscheidet in
der Kachel, **wie groß** der Rahmen des ARTs ist; der ART entscheidet danach,
**wofür**. Der Betrieb bleibt Betrieb.

### 5.2 Der Topf eines ARTs

```
ART-Topf(art, cycle) = Σ finalAmount der Kandidaten
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

**R1 · Die Klasse steuert die Quelle.** Der Portfolio-Ballot zeigt ausschließlich
Portfolio-Epics; die ART-Verteilung ausschließlich ART-Epics desselben ARTs. Ein
Epic kann pro Zyklus aus genau einer Quelle Geld bekommen — geprüft beim
Schreiben, nicht nur in der Anzeige.

**R2 · Finanzierung schlägt Klassenwechsel — innerhalb des Zyklus.** Steigen die
Kosten eines ART-finanzierten Epics über das Limit, behält es sein Geld für den
laufenden Zyklus und wird als **gewechselt** markiert; ab dem nächsten Zyklus
gehört es auf den Portfolio-Ballot. Umgekehrt genauso. Ohne diese Regel würde
zugeteiltes Geld unsichtbar, sobald jemand eine Kostenscheibe ändert.

Beide Richtungen brauchen einen sichtbaren Hinweis — auf der ART-Fläche
(„verlässt den ART-Topf zum nächsten Zyklus") und im Ballot-Setup („kommt neu
dazu").

---

## 7 Datenmodell

| Änderung                                                                                                                                              | Warum                                                |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Guardrail-Ziele um `approval: { portfolioThreshold: number }` erweitern — im Tenant-JSON und in der Wertstrom-Tabelle aus der Budget-Transparenz-Spec | Guardrail 3, mit derselben Vererbung wie Guardrail 2 |
| `RunTheBusinessItem.kind String @default("run")`                                                                                                      | Betrieb vs. ART-Veränderungsrahmen (§5.1)            |
| `RunTheBusinessItem.artId String? @db.Uuid` + FK + Index                                                                                              | bereits in der Budget-Transparenz-Spec; hier tragend |
| Neue Tabelle **`ArtEpicAllocation`** (`tenantId`, `artId`, `epicId`, `cycleKey`, `amount`, Audit-Felder, `@@unique([artId, epicId, cycleKey])`)       | Das Ledger der ART-Verteilung                        |

`ArtEpicAllocation` ist bewusst eine eigene Tabelle und nicht ein Feld in der
`BudgetAllocation`-JSON-Karte:

- Die JSON-Karte ist eine **Fortschreibung** ohne Historie; die ART-Verteilung
  braucht Herkunft, Zeitpunkt und Urheber.
- Sie hätte sonst zwei Schreiber mit unterschiedlicher Semantik auf demselben
  Feld — genau das Muster, das der Budgeting-Refactor gerade beseitigt hat.
- Aus dem Vorhandensein einer Zeile ist die **Quelle** ablesbar, ohne die
  Klassifikation neu zu rechnen (§6, R2).

`BudgetAllocation` bleibt die eine app-weite Tatsache für Reifegrad und
Reporting. Die ART-Verteilung schreibt sie fort, wie es die Finalisierung tut.

---

## 8 Die Verteilfläche des ARTs

Ein neuer Abschnitt im Budget-Reiter des ARTs, direkt unter „Was sich verschieben
ließe":

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

- Gelistet werden **ART-Epics dieses ARTs**, die budgeting-reif sind
  (`isPbEligible`) — dieselbe Reifeprüfung wie beim Ballot.
- Nichts ist vorbelegt; jede Zuteilung ist eine Entscheidung.
- Sortiert nach Richtwert, nicht nach Eingabe — beim Tippen springt nichts.
- Σ darf den Topf nicht überschreiten; darüber wird gewarnt und nicht gespeichert.
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
> Sie verteilt ausschließlich den ART-Topf auf ART-Epics (§8) und merkt Epics
> fürs nächste Budget vor.

Weitere Berührungen, alle additiv:

- Die **Zustandsstaffel** und der **Verlauf** unterscheiden nicht nach Quelle —
  sie lesen `BudgetAllocation`. Nichts zu tun.
- Die **Kopfzahlen** des ARTs zeigen künftig zwei Töpfe: Portfolio-Zuteilung und
  ART-Topf. Sie dürfen nicht addiert dargestellt werden, ohne beschriftet zu sein.
- Die **Reallokations-Sicht** gewinnt an Bedeutung: nicht finanzierte ART-Epics
  sind jetzt tatsächlich vom ART selbst finanzierbar — sie stehen nicht mehr nur
  da.
- **Guardrail 2** zählt ART-Epics wie alle anderen; der ART-Veränderungsrahmen
  zählt als Grow (§5.1).

---

## 10 Requirements (testbar)

### Klassifikation

- **REQ-K1** Die Klasse eines Epics wird aus `derivePbInfo(...).cost` gegen das
  aufgelöste Portfolio-Limit berechnet und **nirgends gespeichert**.
- **REQ-K2** Ohne freigegebene Hypothese und ohne freigegebenen Business Case hat
  ein Epic keine Klasse und erscheint in keiner der beiden Finanzierungslisten.
- **REQ-K3** Genau `Kosten > Limit` ist ein Portfolio-Epic; Gleichstand ist ein
  ART-Epic.
- **REQ-K4** Das Limit wird wie Guardrail 2 aufgelöst: Wertstrom-Zeile vor
  Tenant-Default vor Code-Default; die Herkunft wird angezeigt.

### Trennung der Quellen

- **REQ-Q1** `loadRoundBallot` liefert ausschließlich Portfolio-Epics.
- **REQ-Q2** Die ART-Verteilfläche listet ausschließlich ART-Epics des eigenen
  ARTs.
- **REQ-Q3** Ein Epic hat je Zyklus höchstens eine Quelle; der Schreibpfad prüft
  das und lehnt ab, statt zu überschreiben.
- **REQ-Q4** Wechselt ein Epic nach der Zuteilung die Klasse, bleibt die
  Zuteilung des laufenden Zyklus bestehen und wird auf beiden Flächen als
  Wechsel ausgewiesen.

### Topf und Verteilung

- **REQ-T1** Der ART-Topf eines Zyklus ist Σ `finalAmount` der
  `art_change`-Positionen dieses ARTs aus Kacheln dieses Zyklus.
- **REQ-T2** Σ der Zuteilungen darf den Topf nicht überschreiten.
- **REQ-T3** Jede Zuteilung erzeugt eine `ArtEpicAllocation`-Zeile und schreibt
  `BudgetAllocation[cycleKey]` fort; 0 entfernt beides.
- **REQ-T4** Die Verteilung ist auditiert (Urheber, Zeitpunkt, Vorher/Nachher).
- **REQ-T5** `materializeRtbCandidates` übernimmt `artId` und `kind` aus der
  Position, statt `artId` auf `null` zu setzen.

### Berechtigungen

- **REQ-B1** Den ART-Topf verteilt der RTE des ARTs (`Art.rteId`), der
  Wertstrom-Owner und das Portfolio-Management — über einen Service-Seam für den
  RTE, wie ihn Finance über `ValueStream.financeApproverId` hat.
- **REQ-B2** Das Portfolio-Limit pflegt, wer `target.manage` für den Wertstrom
  bzw. den Tenant hält.

---

## 11 Offene Entscheidungen

### E1 · Bleibt der Abnahmeweg für ART-Epics wirklich unverändert?

Die Vorgabe lautet: ART-Epics funktionieren wie bisher, nur die Geldquelle
unterscheidet sich. Damit braucht ein 40.000-€-Vorhaben weiterhin **an L3.1 die
Zeichnung von fünf Parteien** (MGMT, Business Owner, Finance, IRT-Owner,
LACE/VMO) und **an L3.2 die von VMO und Finance**.

Das ist genau der Aufwand, den Guardrail 3 eigentlich abschaffen soll — der Sinn
einer Genehmigungsschwelle ist, dass unterhalb davon **niemand aus dem Portfolio
zeichnen muss**.

> **Empfehlung:** Für ART-Epics einen eigenen Gate-Policy-Default hinterlegen —
> L3.1 und L3.2 zeichnen Wertstrom-Owner und RTE statt der fünf Parteien. Der
> Mechanismus dafür existiert vollständig: `StageGateApproverRule` und
> `resolveGatePolicy` lösen Regeln bereits je Wertstrom und Gate auf; es käme
> eine Dimension „Klasse" hinzu. Wird das nicht gewollt, bleibt es wie
> beschrieben — dann trägt das Konzept aber nur die halbe Entlastung.

### E2 · Der Veränderungsrahmen als eigene Position — oder doch aus dem Betrieb?

§5.1 schlägt `kind = "art_change"` vor, damit Betrieb Betrieb bleibt.

> **Empfehlung:** So umsetzen. Die Alternative — ART-Epics direkt aus den
> Betriebspositionen zu bezahlen — macht vier bestehende Flächen unwahr
> (Grow/Run-Kacheln, Wertstrom-Run-Anteil, Ballot-Gliederung, Guardrail 2) und
> spart nur eine Spalte.

### E3 · Ein Limit für alle oder je Wertstrom?

Die Vorgabe nennt ein Limit: 100.000 €.

> **Empfehlung:** Tenant-Default 100.000 €, Überschreibung je Wertstrom möglich —
> dieselbe Tabelle und dieselbe Auflösung wie bei Guardrail 2, also praktisch
> ohne Zusatzaufwand. Ein Wertstrom mit deutlich anderer Vorhabengröße kann sich
> so korrigieren, ohne dass jemand eine zweite Mechanik bauen muss.

---

## 12 Umsetzung in Stufen

1. **Guardrail 3 als Zahl** — Ziel-Erweiterung, Auflösung, Anzeige auf der
   Guardrails- und der Wertstrom-Fläche. Noch ohne Wirkung.
2. **Klassifikation sichtbar machen** — abgeleitete Klasse am Epic, in der
   Epic-Liste und im Ballot-Setup anzeigen. Immer noch ohne Wirkung auf das Geld;
   erlaubt aber, die Verteilung der Bestands-Epics zu prüfen, **bevor** sie greift.
3. **Der ART-Topf** — `kind` und `artId` an `RunTheBusinessItem`,
   Materialisierung anpassen, Topf je ART und Zyklus ableiten und anzeigen.
4. **Die Verteilfläche** — `ArtEpicAllocation`, Schreibpfad, Fortschreibung,
   Audit, Berechtigungen.
5. **Die Trennung scharf schalten** — Ballot filtert Portfolio-Epics, die
   Verteilfläche ART-Epics, Wechsel-Hinweise auf beiden Seiten.
6. **Optional (E1)** — eigener Gate-Policy-Default für ART-Epics.

Stufe 2 ist der Prüfpunkt: Erst wenn sichtbar ist, wie viele Bestands-Epics
unter das Limit fallen und wie viele davon bereits Kachel-Geld haben, ist
entscheidbar, ob Stufe 5 in einem Schritt oder zum Zyklusbeginn scharf geschaltet
wird.

---

## 13 Bewusster Verzicht

- **Keine gespeicherte Klasse.** Sie wäre eine zweite Wahrheit neben den Kosten.
- **Keine zweite Zielgröße neben `BudgetAllocation`.** Zwei Quellen, ein Ziel —
  sonst müsste jede Reporting-Fläche beide addieren und irgendwann eine davon
  vergessen.
- **Keine rückwirkende Umklassifizierung** bereits finanzierter Zyklen.
- **Keine ART-eigene Kachel.** Der ART verteilt seinen Rahmen, er führt kein
  eigenes Beteiligungsverfahren; der Rahmen selbst wird im Wertstrom entschieden.

---

## 14 Referenzen

| Aussage                                   | Fundstelle                                                   |
| ----------------------------------------- | ------------------------------------------------------------ |
| Guardrail-Ziele, Validierung, Defaults    | `src/modules/work/domain/portfolio-guardrails.ts`            |
| Vererbung je Wertstrom                    | `src/modules/work/domain/gate-policy.ts`                     |
| Kosten und Ballot-Fähigkeit eines Epics   | `src/modules/work/domain/pb-submission.ts`                   |
| Ballot-Pool                               | `src/modules/budgeting/server/services/ballot.ts`            |
| RtB-Materialisierung (`artId: null`)      | `src/modules/budgeting/server/services/candidate-service.ts` |
| Betrag je Kachel aus der Periode          | `src/modules/budgeting/domain/rtb-interval.ts`               |
| Einziger Schreiber von `BudgetAllocation` | `src/modules/budgeting/server/services/finalize-service.ts`  |
| Kriterium „Budget alloziert"              | `src/modules/work/domain/gate-readiness.ts`                  |
| Gate-Fakt `budgetAllocationSum`           | `src/modules/work/server/services/stage-gate-transition.ts`  |
| Run-the-Business-Positionen               | `src/modules/budgeting/server/services/rtb-item-service.ts`  |
| Was welche Rolle darf                     | `src/server/auth/policies/index.ts`                          |
