# ADR-0016: Risk-Register ist tenant-level; ROAM ist seine Status-Achse; getrennt von Impediment-ROAM

- Status: accepted
- Date: 2026-08-09

## Context

Pulse hatte keine erstklassige **Risk**-Entität. SAFe's **ROAM**-Technik war halb umgesetzt: das
Vokabular (`open|resolved|owned|accepted|mitigated`) hing am **Impediment** (Drumbeat), und
`pi-workspace.riskCount` war ein `"Platzhalter bis Risk-Register"`-Stub. Ein neues `risks`-Modul
([ADR-0013](./0013-module-layering-and-prerequisites.md)) füllt das Substantiv nach. Die Spezifikation:
`docs/concepts/risk-management-module.md`.

## Decision

1. **Tenant-level Register.** Ein Risk ist portfolio-weit und mit der Org nur über seine n:m-Epic-Links
   verbunden (`RiskEpicLink`, referenziell, hard FK, **kein** Wert-Rollup — im Gegensatz zu
   `GoalEpicLink`). Das Modul hängt nur von **Work + Core** ab; keine Drumbeat/ART/PI-Kopplung → sauberer
   Sibling zu Drumbeat/Budgeting.

2. **ROAM als geteiltes Core-Primitive.** `RoamStatus`/`ROAM_STATUSES`/`ROAM_COLORS` leben in
   `src/modules/core/kernel/domain/roam.ts`; sowohl das Drumbeat-Impediment als auch das Risks-Modul
   konsumieren sie abwärts (löst die frühere Doppel-Definition ab). ROAM ist die **einzige** Status-Achse
   eines Risks (kein separater Workflow-Status wie beim Impediment). **Impediment-ROAM bleibt getrennt**
   in Drumbeat — Blocker (Impediments) und Risiken sind unterschiedliche Konzepte; eine Konsolidierung
   ist bewusst zurückgestellt.

3. **Autorenschaft: Epic Owner dokumentiert, alle schlagen vor.** Eine Review-Achse
   `reviewStatus ∈ suggested|documented|rejected` (unabhängig von ROAM). `risk.suggest` für alle;
   `risk.document`/`risk.review` sind **value-stream-scoped** (ADR-0002) — die Autorität leitet sich aus
   den **verknüpften Epics** ab (deren value_streams), nicht aus einer einzelnen Owner-Spalte; das ist,
   wie „per Epic"-Ownership trotz tenant-level + n:m funktioniert. Unverknüpfte Risiken sind Manager-only.
   Die **Nummer** wird erst beim `→ documented`-Übergang vergeben (per-Tenant gapless, Advisory-Lock;
   Präfix admin-konfigurierbar via `RiskSettings`) — Vorschläge verbrauchen keine Nummer.

4. **Reassessment-Trail statt Einzel-Residual.** Jede Neubewertung hängt eine `RiskAssessment`-Zeile an;
   die Matrix zeichnet einen **mehrstufigen** Mitigations-Vektor (current = letzter Punkt, inherent = #0).
   Exposure ist ein **5×5** `probability·impact` (1–25), Bänder `≤4/5–9/10–15/16–25` — die eine reine
   Berechnung (`riskExposure`), Single-Source-of-Truth für Listen-Badge und Matrix-Zelle.

5. **Reads sind Epic/VS-scoped** (`riskReadFilter`): Manager sehen alle; sonst nur Risiken, die an Epics
   im eigenen value_stream-Scope hängen (plus eigene owned/raised). Der Notification-Weg ist v1 **Queue-
   only** (kein Event/Inbox).

## Consequences

- Cross-Modul-Sichten bleiben Composition-Root: die Epic-Detail-Seite bekommt einen **Risks-Tab** als
  vierten entitlement-gegateten Slice auf dem Epic-Detail-Composition-Read-Model — Work importiert
  `@/modules/risks` **nie** (struktureller Port, ADR-0013).
- Künftige Reviews sollen Impediment-ROAM und Risk-ROAM **nicht** beiläufig zusammenführen; falls doch,
  ist das eine bewusste eigene Entscheidung mit Migration.
- Zurückgestellt: PI-Planning-Surfacing (`riskCount`), Reporting-Rollup, Impediment↔Risk / Goal↔Risk-
  Links, REST-API, strukturierte Mitigation-Aktivitäten (Owner/Fälligkeit/Status).
