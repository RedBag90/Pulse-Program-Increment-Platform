# Module: `budgeting`

Budgetvergabe: Participatory Budgeting, Wertstrom- und ART-Budgets, Budget-Plan-Revisionen,
Controlling-Übersicht. Benötigt `work`.

- **Darf importieren von:** work, core.
- **Darf NICHT importieren von:** drumbeat, risks, onboarding (Schwester-Schichten —
  `drumbeat ⊥ budgeting`).
- **Wird importiert von:** `src/app` (Composition-Root). Work importiert Budgeting **nie**; die
  Epic-Allokation erreicht das Epic-Detail über einen strukturell typisierten Port
  ([ADR-0013](../../../docs/adr/0013-module-layering-and-prerequisites.md)).
- **Schreibt ausschliesslich** in eigene Tabellen (`BudgetAllocation`, `ArtBudget`,
  `BudgetPlanRevision`) plus `Tenant.budgetPoolByPeriod`. Gegenüber Work ist das Modul
  **vollständig read-only** — siehe
  [ADR-0019](../../../docs/adr/0019-epic-window-follows-the-maturity-plan.md).

Fachliche Spec und Befundliste: [budgeting-module-deepening.md](../../../docs/concepts/budgeting-module-deepening.md).

## Die drei Ebenen

Alles rechnet auf einer **Halbjahres-Achse** (`"YYYY-H1"` / `"YYYY-H2"`), weil das Halbjahr eine
6-Monats-Kostenscheibe des Business Case ist.

| Ebene     | Frage                                                     | Entscheider                                                                | Persistenz                                      |
| --------- | --------------------------------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------- |
| Portfolio | Wie viel Geld je Halbjahr, welches Epic bekommt wie viel? | Portfolio-Manager / Tenant-Admin                                           | `Tenant.budgetPoolByPeriod`, `BudgetAllocation` |
| Wertstrom | Wie viel Budget hat ein Wertstrom?                        | _niemand_ — **abgeleitet** aus den Epic-Zuteilungen                        | keine (Read-Model)                              |
| ART       | Wie verteilt der Wertstrom auf seine ARTs?                | Finance-Approver des Wertstroms, Wertstrom-Owner, Portfolio-Manager, Admin | `ArtBudget`                                     |

## Dateien

| Datei                                              | Rolle                                                                                                                     |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `domain/period-map.ts`                             | Die Rechnungen auf `{ Halbjahr → Betrag }`: `sumPeriods`, `addPeriod`, `remainingByPeriod`                                |
| `domain/period-window.ts`                          | **Welche** Halbjahre eine Sicht zeigt: `forecastAxis`, `budgetPlusLoadPeriods`, `occupiedWindow`, `computeDisplayPeriods` |
| `domain/budgeting.ts`                              | Bedarf je Periode, Wertstrom-Roll-up, Chart-Pivot, `poolRemaining`                                                        |
| `domain/art-budget.ts`                             | Feature-Last je ART (PI-Halbjahr + Backlog), `artBudgetRemaining`                                                         |
| `domain/budget-plan-snapshot.ts`                   | Die eingefrorene Revisions-Form + ihre Faltung                                                                            |
| `server/services/budgeting.ts`                     | Board laden, Zuteilung + Topf schreiben, Wertstrom-Budgets ableiten                                                       |
| `server/services/art-budget.ts`                    | ART-Breakdown lesen, ART-Budget schreiben (Autorisierung am Seam)                                                         |
| `server/services/budget-plan-revision.ts`          | Capture + die drei Lesewege auf `BudgetPlanRevision`                                                                      |
| `server/services/epic-allocation.ts`               | Der Read-Port für Works Epic-Detail (`{ allocatedSum }`)                                                                  |
| `server/views/*.ts`                                | Page-Models: impurer Loader + **reiner** Builder je Sicht                                                                 |
| `features/actions/budgeting.ts`                    | Alle vier Schreib-Aktionen (Topf, Zuteilung, ART-Budget, Capture)                                                         |
| `features/components/{board,art-budget,revision}/` | Die drei Oberflächen; sie halten nur Editier-State und rufen die Page-Model-Builder                                       |

Die Client-Komponenten rufen **dieselben** reinen Builder wie der Server, damit beim Tippen keine
zweite Ableitungsregel entsteht.

Status: produktiv. Der Modul-Container ist vollständig befüllt (die frühere
„Skelett (Phase P1)"-Notiz war veraltet).
