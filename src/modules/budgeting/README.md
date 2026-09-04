# Module: `budgeting`

Budgetvergabe: Participatory Budgeting, Wertstrom- und ART-Budgets, Budget-Plan-Revisionen,
Controlling-Übersicht. Benötigt `work`.

- **Darf importieren von:** work, core.
- **Darf NICHT importieren von:** drumbeat, risks, onboarding (Schwester-Schichten —
  `drumbeat ⊥ budgeting`).
- **Wird importiert von:** `src/app` (Composition-Root). Work importiert Budgeting **nie**; die
  Epic-Allokation erreicht das Epic-Detail über einen strukturell typisierten Port
  ([ADR-0013](../../../docs/adr/0013-module-layering-and-prerequisites.md)).
- **Schreibt ausschliesslich** in eigene Tabellen (`BudgetAllocation`, `BudgetRound`,
  `BudgetCandidate`, `RunTheBusinessItem`, `RtbItemAward`, `ArtEpicAllocation`,
  `BudgetPlanRevision`). Gegenüber Work ist das Modul **vollständig read-only** — siehe
  [ADR-0019](../../../docs/adr/0019-epic-window-follows-the-maturity-plan.md).

Fachliche Spec und Befundliste: [budgeting-module-deepening.md](../../../docs/concepts/budgeting-module-deepening.md).

## Die drei Ebenen

Alles rechnet auf einer **Halbjahres-Achse** (`"YYYY-H1"` / `"YYYY-H2"`), weil das Halbjahr eine
6-Monats-Kostenscheibe des Business Case ist.

| Ebene     | Frage                                                       | Entscheider                                                                                    | Persistenz                                      |
| --------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Portfolio | Wie viel Geld je Halbjahr, welches Epic bekommt wie viel?   | Portfolio-Manager / Tenant-Admin                                                               | `Tenant.budgetPoolByPeriod`, `BudgetAllocation` |
| Wertstrom | Wie viel Budget hat ein Wertstrom?                          | _niemand_ — **abgeleitet** aus den Epic-Zuteilungen                                            | keine (Read-Model)                              |
| ART       | Wie verteilt der Wertstrom auf seine ARTs?                  | _niemand_ — **abgeleitet** aus den Epic-Zuteilungen                                            | keine (Read-Model)                              |
| ART-Epic  | Wie verteilt ein ART sein ART-Epic-Budget auf kleine Epics? | RTE des ARTs, Finance-Partei, Wertstrom-Owner, Portfolio-Manager, Produkt-Manager der Solution | `RtbItemAward` → `ArtEpicAllocation`            |

## Dateien

| Datei                                                     | Rolle                                                                                                                     |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `domain/period-map.ts`                                    | Die Rechnungen auf `{ Halbjahr → Betrag }`: `sumPeriods`, `addPeriod`, `remainingByPeriod`                                |
| `domain/period-window.ts`                                 | **Welche** Halbjahre eine Sicht zeigt: `forecastAxis`, `budgetPlusLoadPeriods`, `occupiedWindow`, `computeDisplayPeriods` |
| `domain/budgeting.ts`                                     | Bedarf je Periode, Wertstrom-Roll-up, Chart-Pivot, `poolRemaining`                                                        |
| `domain/art-budget.ts`                                    | Feature-Last je ART (PI-Halbjahr + Backlog), `unassignedToArts`                                                           |
| `domain/art-pot-window.ts`                                | Welches Halbjahr beschreibbar ist: das laufende und das nächste                                                           |
| `domain/art-pot-access.ts`                                | Die vier Wege zum Verteilen eines ART-Epic-Budgets                                                                        |
| `domain/art-throughput.ts`                                | €-Satz je Job-Size-Punkt aus der Historie, samt seiner Vorbehalte                                                         |
| `domain/rtb-kind.ts` / `rtb-interval.ts` / `rtb-award.ts` | Art, Periode und anteilige Vorbelegung der Run-the-Business-Positionen                                                    |
| `domain/budget-plan-snapshot.ts`                          | Die eingefrorene Revisions-Form + ihre Faltung                                                                            |
| `server/services/budgeting.ts`                            | Board laden, Zuteilung + Topf schreiben, Wertstrom-Budgets ableiten                                                       |
| `server/services/art-budget.ts`                           | ART-Breakdown lesen (**rein lesend**)                                                                                     |
| `server/services/art-pot.ts`                              | Das zugesprochene ART-Epic-Budget und seine Verteilung auf ART-Epics                                                      |
| `server/services/art-coverage.ts`                         | Last gegen Deckung eines ARTs                                                                                             |
| `server/services/rtb-item-service.ts`                     | Run-the-Business-Positionen pflegen (Betrieb und ART-Epic-Budget)                                                         |
| `server/services/rtb-award-service.ts`                    | Den Zuspruch des Wertstroms auf seine Positionen aufteilen                                                                |
| `server/services/rtb-authz.ts`                            | Das gemeinsame Recht der beiden RtB-Services (Capability + Finance-Bypass)                                                |
| `server/services/pb-list.ts`                              | Die PB-Liste einer Runde laden                                                                                            |
| `server/services/budget-plan-revision.ts`                 | Capture + die drei Lesewege auf `BudgetPlanRevision`                                                                      |
| `server/services/epic-allocation.ts`                      | Der Read-Port für Works Epic-Detail (`{ allocatedSum }`)                                                                  |
| `server/views/*.ts`                                       | Page-Models: impurer Loader + **reiner** Builder je Sicht                                                                 |
| `features/actions/*.ts`                                   | Neun Action-Dateien je Vorgang (Runde, Setup, Verteilung, Finalisierung, RtB, ART-Verteilung, …)                          |
| `features/components/{period,art-budget,rtb,revision}/`   | Die Oberflächen; sie halten nur Editier-State und rufen die Page-Model-Builder                                            |

Die Client-Komponenten rufen **dieselben** reinen Builder wie der Server, damit beim Tippen keine
zweite Ableitungsregel entsteht.

Status: produktiv. Der Modul-Container ist vollständig befüllt (die frühere
„Skelett (Phase P1)"-Notiz war veraltet).
