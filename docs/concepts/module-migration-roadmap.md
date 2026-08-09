# Modul-Migrations-Roadmap (P0–P7)

- Status: proposed
- Date: 2026-08-09
- Ziel-Bild: [module-architecture.md](./module-architecture.md)

Strangler-Migration, kein Big-Bang. **Jede Phase**: eigenständig grün, per Branch-Revert rücknehmbar, App
bleibt schiffbar. Test-Nähte = Modul-Interfaces/Ports (in-memory-Adapter), Events über Test-Bus. Bestehende
Verhaltensverträge aus `CONTEXT.md` (last-writer-wins beim Funded-Window, Feature-Start→Epic L4,
„realisierter KPI-Wert = eine Quelle") werden zu **Regressionstests an den neuen Nähten**.

Standard-Gate jeder Phase: `tsc`=0, `eslint`=0, `prettier`, `vitest` grün (Integration braucht
`DATABASE_URL_TEST`), plus die phasenspezifischen Tests unten.

## Phase 0.5 — Test-Harness-Voraussetzung

Vor den Degradations-Tests muss existieren (Bestand prüfen, sonst bauen):

- **Principal-mit-Entitlement-Renderer**: Server-Component-Render mit gesetztem `enabledModules`-Set.
- **In-memory Event-Bus** + **Port-Fakes** je Read-Port.
- Fixtures für die Entitlement-Sets `core` / `core+work` / `+drumbeat` / `+budgeting` / `+beide`.

Gate: Harness rendert die Epic-Seite in allen fünf Sets ohne Fehler (noch ohne Gating-Logik).

## P0 — Entitlement-Re-Modularisierung (kein File-Move)

**Ziel**: Registry auf 4 Keys, direkter Cutover.
**Änderungen**: `modules.ts` → `[core, work, drumbeat, budgeting]` + Prerequisite-Validierung
(Drumbeat/Budgeting ⇒ Work); Gates (`layout`, `server-action`, `mutation-handler`, `query-handler`),
`principal`, `landing`, `ziele/page`-String-Derivation, Zod-Enums (`api/v1/admin/tenants`, `tenant-actions`),
Provisioning-Defaults; **Demo-Tenants neu seeden** auf die 4 Keys (nur Demo-Tenants vorhanden → kein
Prod-Backfill, kein Flag, kein Reverse-Backfill).
**Tests**: `modules.test.ts` neu (Vollständigkeit / No-Dup / Path / Action / Default / first-home) + neuer
**Prerequisite-Invariant-Test** (kein oberes Modul ohne Work); die 3 HTTP-Gate-Tests + seed-fixtures +
`ziele-module-gating` grün.
**Gate**: Smoke der Entitlement-Sets — Nav/Route/Action korrekt gated je Set.

## P1 — Boundary-Tooling + Modul-Skelett

**Ziel**: Grenzen messbar, noch nicht scharf.
**Änderungen**: `src/modules/{core,work,drumbeat,budgeting}` anlegen; dependency-cruiser + ESLint
`no-restricted-imports` mit dem Layering-Graph im **Report-Modus** (Ist-Verletzungen als Baseline/Allowlist).
**Tests**: dep-cruiser-CI-Job grün (Report); Baseline-Snapshot als „known-violations"-Liste eingecheckt.
**Gate**: keine Verhaltensänderung; Baseline dokumentiert.

## P2 — Core-Kernel + Org + Goals → `modules/core`

**Ziel**: Fundament isoliert.
**Änderungen**: Substrat, KPI, Org (VS/ART/Team), Goals (+ Contribution-Port-Interface) nach `modules/core`;
Pfade aktualisieren.
**Tests**: bestehende Domain-/Goals-Tests mitgezogen; **Port-Kontrakt-Test** (in-memory Adapter für
`Goals.ScopeResolver`/Contribution); dep-cruiser-Regel „**core** hat keine Aufwärts-Imports" scharf.
**Gate**: grün; Core importiert nichts von work/drumbeat/budgeting.

## P3 — Work-Ports + Events (noch im Monolith)

**Ziel**: Schreib-Kopplungen invertieren.
**Änderungen**: Read-Ports `EpicSchedule.plannedWindow` / `FeatureBreakdown` / `EpicEconomics`; Events
`FeatureStarted` / `FundedWindowDecided` + **Work-Handler**; heutige Direktaufrufe umstellen —
`feature.ts:786` dynamischer `await import`→L4 wird `FeatureStarted`; `budgeting.ts` `saveBudgetAllocation`
→`timeline`/`stageGate` wird `FundedWindowDecided`.
**Tests**: **Event-Handler-Unit-Tests** (Work wendet Schedule/StageGate an); Read-Port-Contract-Tests;
**Regression** „Feature-Start hebt Epic auf L4" & „Funded-Window schreibt nur Backlog/Impl-Estimates,
Owner-Actuals überleben"; dep-cruiser: kein Drumbeat→Work-Service-Import, kein `await import`-Zyklus.
**Gate**: grün; Zyklus weg.

## P4 — Work-Container + Composition-Root

**Ziel**: Work isoliert, Epic-Seite gated.
**Änderungen**: Epic-Def/BC/Hypothese/Approval/Stage-Gate/Epic-Timeline/Ökonomie + Feature-Breakdown-Facette
→ `modules/work`; Epic-Seite in `src/app` komponiert per Entitlement (Drumbeat/Budgeting-Teile konditional).
**Tests**: Work-Interface-Tests; **Degradations-Integrationstest Epic-Seite Work-only** (Drumbeat/Budgeting
aus → Teile ausgeblendet, Ökonomie-Fallback rendert, keine Fehler) — nutzt den P0.5-Harness; dep-cruiser
`work → nur core`.
**Gate**: grün; Epic-Seite Work-only verifiziert.

## P5 — Drumbeat-Container

**Ziel**: Planung/Ausführung isoliert.
**Änderungen**: umsetzung/pi/art-planung/team/Feature-Planungs-Facette/dependencies/impediments/capacity/
roadmap/timelines → `modules/drumbeat`; konsumiert Work-Read-Ports + Core-Org.
**Tests**: Drumbeat-Interface-Tests; **Facetten-Trennungstest** (Work schreibt Breakdown-Spalten, Drumbeat
Planungs-Spalten — kein Überlapp); dep-cruiser `drumbeat → {work, core}`, `↮ budgeting`.
**Gate**: grün.

## P6 — Budgeting-Container

**Ziel**: Budgetvergabe isoliert.
**Änderungen**: budgeting/controlling/art-budget → `modules/budgeting`; Epic-Fenster nur via
`FundedWindowDecided`; `BudgetAllocation`-Ownership.
**Tests**: Budgeting-Interface-Tests; **„Budgeting schreibt Initiative-Spalten nie direkt"** (dep-cruiser +
Laufzeit-Contract); „Budgeting ohne Drumbeat funktioniert"; dep-cruiser `budgeting → {work, core}`,
`↮ drumbeat`.
**Gate**: grün.

## P7 — Enforcement scharf

**Ziel**: Grenzen sind CI-Blocker.
**Änderungen**: dep-cruiser/ESLint von Report → **error**, „known-violations"-Allowlist geleert; Regel „nur
`src/app` darf mehrere Module importieren".
**Tests**: Boundary-Suite als **CI-Blocker**; **Matrix-Smoke** aller Entitlement-Kombinationen;
Degradations-Tests je Cross-Modul-Seite (Epic, Portfolio-Dashboard, Reporting). Kein DB-Schema-Move außer
Seed (`prisma db push`, keine Migrations).
**Gate**: jede Grenzverletzung bricht CI.

## Querschnitt

- **Violation-Burn-down**: die „known-violations"-Allowlist (P1) darf nur **schrumpfen**; neue Verletzungen
  brechen sofort — verhindert Regress während der Wanderung.
- **Risiko/Rollback**: jede Phase ist ein eigener Branch/PR, per Revert rücknehmbar; P0 direkter Cutover
  (nur Demo-Tenants).
- **Sizing / Critical-Path** (grob): P0 S · P0.5 S · P1 S · P2 L · P3 M · P4 M · P5 L · P6 M · P7 S. Kritischer
  Pfad P0→P1→P2→P3→P4; P5 und P6 sind nach P4 **parallelisierbar** (Drumbeat ⊥ Budgeting), P7 schließt ab.
