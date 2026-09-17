# ADR-0011: Fortschrittsquelle pro Ziel + ein Erstellungspfad + ein UI-Begriff „Ziel"

Status: Accepted
Date: 2026-07-24

## Context

Nach ADR-0010 ist `Objective` der eine rekursive Goal-Knoten und `nodeKind`
(`"objective" | "key_result"`) „nur ein Label". Trotzdem gab es in der UI **zwei**
Erstellen-Buttons („＋Ziel" / „＋KR") mit zwei getrennten Formularen — der Nutzer musste
O-vs-KR **vorab** entscheiden, obwohl oft unklar ist, ob eine Ebene selbst das messbare
Blatt ist oder noch ein Unterlevel bekommt.

Zweitens konnte der **Fortschritt** eines Ziels nur aus der eigenen `current`-Spalte
(Blatt) oder dem Kinder-Rollup kommen. Verknüpfte Epics/KPIs trieben **nur den €-Trio**
(`nodeTrio`), nicht den normalisierten 0..1-Fortschritt (`nodeProgress`). Der Wunsch:
einen Zielwert setzen, Epics anknüpfen, und der Fortschritt soll steigen, wenn deren KPIs
(gleiche Einheit) besser werden — Asanas „progress source".

## Decision

**Die Fortschrittsquelle ist ein explizites Feld pro Ziel** (`Objective.progressMode`,
`src/domain/goal-progress-mode.ts`):

- `manual` — Ist-Wert von Hand (`keyResultProgress` über `current`); auf **jeder** Ebene,
  auch als Override bei einem Knoten mit Kindern.
- `rollup` — gewichteter Durchschnitt der Kind-Fortschritte.
- `auto_kpi` — Ist-Wert = **Summe** der Ist-Werte aller KPIs mit **passender Einheit** aus
  den verknüpften Epics (`GoalEpicLink`); dann `keyResultProgress` gegen baseline/target.

`progressMode = null` ⇒ **abgeleitet** (`hasChildren ? "rollup" : "manual"`) = exakt das
Verhalten vor diesem ADR (kein Backfill, additive, nullable Spalte).

`nodeProgress` (`goals-rollup.ts`) respektiert den Modus: `rollup` mittelt die Kinder,
`manual`/`auto_kpi` nutzen den eigenen `progressLeaf` — **auch wenn Kinder existieren**.
Die **Geld-Achse** (`formula`, `KrKpiContribution`, €-Trio, Money-Sheet) bleibt
unverändert; Fall 3 liest die Epic-Link-KPIs nur zusätzlich für die Fortschritts-Achse, die
Count-once-Geldzählung (ADR-0009) ändert sich nicht.

**Ein Erstellungs-/Bearbeitungspfad:** ein `createGoalNodeAction`/`updateGoalNodeAction`
(die bisherigen Objective/KR-Actions vereinheitlicht), ein `GoalPane` im Drawer mit
optionalem Metrik-Block + Fortschrittsquelle-Selektor. In der UI heißt jeder Knoten „Ziel"
(Top-Level bleibt „Theme (OKR)"); `nodeKind` wird nur noch best-effort
(`target != null ? "key_result" : "objective"`) geschrieben und behavioral nicht mehr
gelesen. Messbarkeit leitet sich aus `isMeasurableGoal` (Metrik/Modus) ab.

## Consequences

- Kein Vorab-O-vs-KR; ein Knoten wird messbar, sobald er eine Metrik trägt, und wird zum
  Container, sobald er Kinder bekommt (Rollup gewinnt) — es sei denn, der Modus ist explizit
  `manual`/`auto_kpi` (Override).
- Neuer, einheitengleicher „Fortschritt aus KPI"-Pfad; Einheiten-Match über das freie
  Einheit-Label bzw. den Währungscode.
- `nodeKind` ist jetzt vestigial (Legacy-Spalte). Alte Deeplinks `entity=theme|kr` werden
  als Alias auf `entity=goal` weiter akzeptiert.
- Additiv: nur `progressMode String?` neu; keine Migration, keine RLS (Modul-Konvention:
  Tenant-Scoping im Service).

---

## Nachtrag 2026-09-17: eine vierte Quelle — und zwei Korrekturen am Text oben

**Korrektur zuerst.** Dieser ADR beschreibt die Dreiheit `manual | rollup |
auto_kpi`. `auto_kpi` ist seit dem Backfill vom 2026-08-29 zurückgebaut
(`prisma/scripts/2026-08-29-auto-kpi-to-kpi-tree.ts`); an seiner Stelle steht
`kpi_tree`, das zusätzlich den **Ast**-Fall kennt (kaskadierte Unterziel-Werte,
wert-basierte Erfüllung). `effectiveProgressMode` mappt Altwerte defensiv.

**Neu: `confidence`** — die SAFe-Faust-zu-Fünf.

### Warum das eine Fortschrittsquelle sein darf

Die drei vorhandenen Quellen beantworten „woher kommt der Ist-Wert?". Die
Zuversicht beantwortet „wie sicher sind wir?" — das ist **nicht dasselbe**: ein
Ziel kann zu 80 % erledigt sein und trotzdem wackeln, weil die schweren 20 %
noch kommen.

Für Ziele **ohne Metrik** gibt es die erste Frage aber gar nicht. Im Bestand
standen elf solche Ziele auf `manual` und trugen einen von Hand gesetzten
Prozentwert — eine erfundene Zahl. Eine Fünfer-Zuversicht ist ehrlicher als die,
und genau dort ist `confidence` gedacht.

### Die Entscheidung: eine Einschränkung, kein Rechenweg

`confidence` **ist `manual` mit fester Skala.** Beim Speichern schreibt der
Service `baseline = 1`, `target = 5`, `precision = 0`,
`metricName = "Zuversicht"` auf die Zeile (`confidenceScaleFields`). Danach
rechnet die vorhandene Maschinerie ohne einen einzigen Sonderfall weiter:
`keyResultProgress` macht aus einer 3 genau 0,5, `nodeProgress` rollt sie wie
jedes andere Blatt, die Check-in-Historie und der Verlaufsgraf tragen unverändert.

Verlässt ein Ziel `confidence`, werden `baseline`/`target` wieder **freigegeben**
— sie stehen zu lassen hieße, dem Ziel eine Skala zu vererben, die niemand
gesetzt hat.

Das Prädikat `acceptsDirectValue(mode)` (`manual` ∪ `confidence`) ersetzt die
verstreuten `mode === "manual"`-Vergleiche in Fläche, Lesepfad und Service-Guard.

### Was bewusst nicht entstanden ist

**Der eigentliche Vote.** Was hier steht, ist das _Ergebnis_-Feld: eine Person
trägt ein, was der Raum gezeigt hat — so, wie es das 2026-08 gedroppte
`PiObjective.confidence Int?` auch tat. Es gibt keine Zeile je Person, keinen
Teilnehmerkreis, keine Verteilung.

Das ist eine Einschränkung mit Folgen: **5·5·1·1 und 3·3·3·3 haben denselben
Mittelwert und bedeuten das Gegenteil.** Ein späterer echter Vote müsste die
Streuung zeigen. Wiederverwendbar wären dann `approval-primitives.ts` (Zeile je
Person, „die Zeile _ist_ die Berechtigung") und das
Regel→Auflösung→**Einfrieren**-Muster aus `gate-policy.ts`; neu zu bauen wäre ein
Schwellen-Quorum — `Quorum` kennt heute nur `all | any`.

### Anzeige

Die Fortschrittsleiste bleibt, bekommt aber eine Beschriftung: **„3 / 5"** statt
nur „50 %". Eine 3 ist nicht „halb fertig", sondern „mittlere Zuversicht", und
die Zahl allein sagt das Falsche.
