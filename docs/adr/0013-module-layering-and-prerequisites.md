# ADR-0013: Modul-Layering mit Prerequisites (Core+Goals ← Work ← {Drumbeat, Budgeting})

- Status: proposed
- Date: 2026-08-09

## Context

Die vorhandenen Funktionen sollen in individuelle Modul-Container gehoben werden. Heute existiert eine
8-Modul-Entitlement-Registry (`src/domain/modules.ts`: `ziele, portfolio, program, controlling, roadmap,
reporting, structure, admin`) als **Nav-/Route-/Action-Gate**, aber ohne Import-Boundary und ohne
Abhängigkeits-/Reihenfolge-Semantik zwischen den Modulen.

Gewünscht ist eine vergröberte, **geschichtete** Modulstruktur mit vier Zielmodulen (Core+Goals, Work,
Drumbeat, Budgeting) und einer klaren Abhängigkeitsregel: „Goals ist Core; darauf kommt Work; nur mit Work
sind Drumbeat und/oder Budgeting aktivierbar."

Die Cross-Modul-Coupling-Analyse bestätigt, dass diese Lizenz-Reihenfolge exakt die **tatsächliche
Code-Abhängigkeitsrichtung** ist:

- Feature-Code (Drumbeat) hängt an Epic-Code (Work): `feature.ts` liest die Epic-Planned-Window und stößt
  den Parent-Epic-Stage-Gate auf L4 an (heute über einen dynamischen `await import` als Zyklus-Brecher).
- Budgeting hängt an Work: `saveBudgetAllocation` schreibt `Initiative.timeline`/`stageGate` und liest
  `epic-economics`.
- Drumbeat und Budgeting haben **keine** direkte Kopplung zueinander.

## Decision

**Layering als Entitlement-Prerequisite UND erzwungene Import-Richtung:**

```
Core (Kernel + Goals + Org-Struktur)  ← Fundament, immer vorhanden
  └─ Work            benötigt Core
       ├─ Drumbeat   benötigt Work
       └─ Budgeting  benötigt Work     (Drumbeat ⊥ Budgeting)
```

1. **Lizenz-Regel**: Drumbeat und/oder Budgeting nur mit aktivem Work; Work implizit auf Core (Core ist
   always-on Free-Basis). `enabledModulesOrDefault` + der Platform-Editor validieren die Prerequisite;
   Bestands-Zustände werden auto-erfüllt (oberes Modul ⇒ Work hinzufügen), nie invalide belassen.
2. **Code-Regel**: Importe zeigen nur abwärts — Budgeting/Drumbeat → Work → Core. Nie aufwärts;
   **Drumbeat ↮ Budgeting**. Modul-übergreifende Sichten sind Shell-Komposition in `src/app`, kein
   Modul-Import.
3. **Seams als Work-owned Ports/Events**: Da nur die oberen Layer koppeln, stellt **Work** die Nähte bereit
   (Read-Ports `EpicSchedule`/`EpicEconomics`/`FeatureBreakdown`, Events `FeatureStarted`/
   `FundedWindowDecided`); Drumbeat/Budgeting konsumieren, nie umgekehrt (siehe
   [ADR-0015](./0015-cross-module-write-through-via-events.md)).

Durchgesetzt via dependency-cruiser + ESLint `no-restricted-imports` (kein Nx/Project-References-Umbau).

## Consequences

- Die 8 Keys werden auf `[core, work, drumbeat, budgeting]` vergröbert; `PERSONAL_DEFAULT_MODULES` = `core`.
  Der Vollständigkeits-Test in `modules.test.ts` erzwingt weiterhin, dass jedes `(dashboard)`-Segment einem
  Key zugeordnet ist; ein **neuer Prerequisite-Invariant-Test** sichert „kein oberes Modul ohne Work".
- Der heutige dynamische `await import` (Drumbeat→Work) entfällt, weil die Kopplung zum Event wird — die
  Richtung wird statisch prüfbar.
- Künftige Architektur-Reviews sollen die Layering-Richtung **nicht** aufweichen: eine Modul-übergreifende
  Abhängigkeit gehört in den `src/app`-Composition-Root oder wird als Work-Port/Event modelliert, nicht als
  Quer-Import.
- Trade-off: Cross-Modul-Seiten (Epic-Seite, Dashboards, Reporting) müssen per Entitlement **degradieren**
  können; das ist gewollt und wird als Degradations-Test-Vorlage etabliert.
- **Composition read-model** ist die benannte Heimat für ein Cross-Modul-Seiten-Komposit (CONTEXT.md): ein
  Page-Model im besitzenden Modul (`server/views/`, z. B. `epic-detail.ts` = Work), das die Daten der oberen
  Module über injizierte **strukturelle Ports** bezieht — der `src/app`-Composition-Root reicht die Adapter
  herein. Die **Entitlement-Degradation ist Teil des Modells** (`enabled` → diskriminierte present/absent-
  Slices); genau das gibt jedem oberen-Modul-Port seinen **echten zweiten Adapter** (Route-Adapter +
  Disabled-Adapter) und macht aus der Single-Adapter-Indirektion einen echten Seam. Referenz:
  `buildEpicDetailModel` (`docs/concepts/epic-detail-model-plan.md`).
