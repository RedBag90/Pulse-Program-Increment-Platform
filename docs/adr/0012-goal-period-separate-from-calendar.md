# ADR-0012: `goal-period.ts` bleibt getrennt von `calendar.ts` (Quartals-Achse vs. Budget-Kalender)

Status: Accepted
Date: 2026-08-07

## Context

Es gibt zwei reine Datums-Module:

- **`src/domain/calendar.ts`** — laut CONTEXT.md „die einzige Quelle der UTC-Datums-
  arithmetik": Tag/Monat/**Halbjahr**-Primitive plus die zwei Perioden-Achsen der
  Portfolio-Ökonomie (`MonthAxis` inklusiv, `GanttMonthSpan` end-exklusiv). Kennt
  **kein Quartal**; die Halbjahre sind **Business-Case-Kostenscheiben** (`YYYY-H1`/`H2`).
- **`src/domain/goal-period.ts`** — die Zeitraum-Mathematik des **Ziele-Moduls**:
  Quartal/Halbjahr/Ganzjahr-Buckets (`YYYY-Qn`/`YYYY-Hn`/`YYYY`), Labels, `goalTimeframe`
  (Bucket vs. individueller Range), Sortier-/Filter-Helfer.

Eine Architektur-Review hat echte **Duplizierung** zwischen beiden gefunden:

1. Zwei parallele Monatsnamen-Tabellen: `MONTHS_DE` (deutsch, „Mär/Mai/Okt/Dez") in
   goal-period vs. `MONTH_LABELS` (englisch) in calendar.
2. Das `new Date(Date.UTC(y, m, 1))`-Monatsgrenzen-Idiom in `goalPeriodRange`
   statt calendars `monthStart`/`addMonths`.
3. Eine **byte-identische** Halbjahres-Regex `/^(\d{4})-H([12])$/` in beiden Modulen.

## Decision

**Die beiden Module bleiben getrennt.** goal-period baut **nicht** generell auf calendar
auf. Gründe:

- **Verschiedene Domänen-Sprachen.** calendars `H1/H2` sind Budget-Kostenscheiben eines
  Business Case; goal-periods `H1/H2` sind OKR-Zeitfenster, die zusätzlich in **Quartale**
  zerfallen (`anchorQuarterKey`, Quartals-Achse der Roadmap). calendar hat bewusst kein
  Quartalskonzept — es unterscheidet nur Monat/Halbjahr für die Ökonomie.
- **Verschiedene Anzeige-Anforderungen.** Ziel-Labels sind deutsch und tagesgenau
  („1. Mär – 30. Jun 2026"); die Ökonomie-Achsen sind sprachneutrale Monats-Spans.
- **Kein gemeinsamer Änderungsgrund.** Ein neues Quartals-Feature am Ziel fasst calendar
  nie an; eine neue Budget-Achse fasst goal-period nie an. Ein Zusammenlegen würde ein
  Modul erzeugen, das beide Änderungsgründe trägt (schlechtere Lokalität), um eine
  12-Zeilen-Tabelle und eine Regex zu sparen.

Die verbleibende Duplizierung ist **bewusst akzeptiert**, nicht übersehen. Sie ist klein,
stabil (Monatsnamen und die H-Grammatik ändern sich nie) und die Namen tragen die
Semantik (`MONTHS_DE` deutsch-tagesgenau vs. `MONTH_LABELS` neutral-Achse).

## Consequences

- Künftige Architektur-Reviews sollen das Zusammenlegen von `goal-period.ts` und
  `calendar.ts` **nicht erneut vorschlagen** — die Trennung ist eine getroffene
  Entscheidung, kein Versehen.
- **Wenn** sich dennoch ein Bug durch die doppelte H-Grammatik zeigt (z. B. eine der
  beiden Regexes wird geändert, die andere nicht), ist der minimal-invasive Schritt, nur
  die **Halbjahres-Parsing-Primitive** aus calendar in goal-period wiederzuverwenden
  (`parseHalfYearKey`), ohne die Quartals-/Label-Logik zu verschieben. Das bleibt ein
  optionaler Folge-Schritt, kein Teil dieser Entscheidung.
- Der Modul-Header von `goal-period.ts` benennt die Trennung bereits („getrennt von
  `calendar.ts`"); dieser ADR ist die dazugehörige, auffindbare Begründung.
