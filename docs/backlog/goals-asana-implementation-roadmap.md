# Implementation Roadmap — Ziele-Adaption nach Asana

> Umsetzungs-Sequenzierung des Backlogs [`goals-asana-adoption.md`](./goals-asana-adoption.md).
> Technisch (Schema → Service → Action → View → UI) **und** zeitlich (Iterationen → Milestones)
> geordnet, mit echten Datei-/Modell-Bezügen aus dem Code.

## Standard-Umsetzungskadenz (gilt für jeden Epic)

Jeder Datenschritt folgt derselben Kadenz und denselben Projektregeln — hier einmal, unten nicht wiederholt:

1. **Schema** — `prisma/schema.prisma` ändern → `pnpm prisma db push` (kein Migrations-Ordner) → Client nach `src/generated/prisma` regeneriert. **Danach Dev-Server neu starten** (sonst hält der Prozess den alten Client → Runtime-Fehler). Wo Bestandsdaten remappt werden müssen: Backfill-Script über `src/generated/prisma`.
2. **Domain** — reine Logik/Typen unter `src/domain/` (testbar, ohne I/O).
3. **Service** — `src/server/services/ziele.ts` via `withAuditedTransaction` + `recordedUpdate`; neue Audit-Actions in `src/server/audit/emit.ts` (`AuditAction`-Union) registrieren.
4. **Action** — `src/features/ziele/actions/ziele.ts` mit `createServerAction`, zod-Schema, Gate `target.manage` (später feiner, s. Epic 6), `revalidate: "ziele"`.
5. **View** — `src/server/views/ziele-view.ts` (`loadStrategyTree` für Listen, `loadGoalDetail` für den Drawer) + ggf. `portfolio-overview.ts`.
6. **UI** — `src/features/ziele/components/` (Drawer `ziele-edit-drawer.tsx`, Liste `strategy-table-view.tsx`, Detail `goal-status/goal-detail-panel.tsx`, Feed `goal-activity-feed.tsx`).
7. **Verify** — `pnpm tsc --noEmit` + `pnpm lint` grün; DB-Smoke via `src/generated/prisma`; Browser auf `/de/strategy` + `/de/ziele`. Commit-Scope `portfolio`, lowercase, prettier/eslint-Pre-commit.

**Schätzung = Engineering-Tage** (1 Person), abhängigkeits-geordnet, direkt auf Sprints/PIs abbildbar.

---

## Iterationsplan (Zeit-Sequenzierung)

| Iteration | Thema                       | Epics   | ~Tage | Milestone (DoD)                                                                                                                       |
| --------- | --------------------------- | ------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **1**     | Metrik-Fundament            | 1, 2    | ~3    | **M1**: KRs tragen Einheit (%/€/Zahl); Objective-Fortschritt aggregiert korrekt und in Liste = Detail = Portfolio-Overview identisch. |
| **2**     | Kommunikation & Verknüpfung | 4, 5, 3 | ~4    | **M2**: Strukturierte Status-Updates im Feed; Related Work verknüpfbar; gewichtete Rollups.                                           |
| **3**     | Governance                  | 6, 7    | ~7    | **M3**: Optionale VS/ART-Zuordnung (n:m) + Filter; Editor/Viewer-Rechte; Custom Fields an Zielen.                                     |
| **4**     | Visualisierung              | 8       | ~3–4  | **M4**: Ziel-zentrierte Strategy Map (Status/Fortschritt, Expand/Collapse, Side-Pane).                                                |
| —         | _(zurückgestellt)_          | 9       | ~2    | Reminder & Grading (braucht Scheduler).                                                                                               |

**Gesamt aktiv: ~17–18 Tage.** Iterationen sind schnittfest — nach jeder ist der Stand tsc/lint-grün und auslieferbar.

---

## Iteration 1 — Metrik-Fundament (M1)

### Epic 1 · Metriktypen % & Währung — ~1–1.5 Tage

1. **Schema** (`prisma/schema.prisma`, `KeyResult`): `unit String @default("number")`, `precision Int @default(0)`, `currencyCode String?`. Defaults ⇒ kein Backfill.
2. **Domain** (neu `src/domain/goal-metric.ts`): `type MetricUnit = "number"|"percent"|"currency"` + `formatMetricValue(value, unit, precision, currencyCode)`. Wiederverwendbar in Dialog/Karte/Chart.
3. **Service/Action**: `updateKeyResult`/`createKeyResult` (`ziele.ts`) um `unit/precision/currencyCode` in den `recordedUpdate`-Feldern; Action-zod: `unit: z.enum([...])`, `precision: 0..6`, `currencyCode` optional (`.or(z.literal(""))`).
4. **View** (`ziele-view.ts`): `ZieleTreeKeyResult` += `unit/precision/currencyCode`, in `loadStrategyTree` durchreichen.
5. **UI**: `ziele-edit-drawer.tsx` Metriktyp-Select + precision + Währung; `goal-detail-panel.tsx` `currentValueLabel` und Chart-Tooltip über `formatMetricValue`; bei `percent` baseline 0/target 100 vorbelegen.
6. **Verify**: KR je Einheit anlegen, Progress-Update → Chart-Achse/Tooltip zeigt Einheit; DB-Smoke.

### Epic 2 · Objective-Rollup (Ø/Summe) — ~1.5–2 Tage · _hängt an Epic 1_

1. **Domain** (`src/domain/goals-rollup.ts`): `rollupObjectiveProgress(krs)` — Prozent → Ø, Zahl/Währung → Summe, gemischt → normalisierter Ø (0..1). **Unit-Tests** für Ø/Summe/gemischt/leer.
2. **View**: `ziele-view.ts` Objective-Fortschritt aus `rollupObjectiveProgress` (neben €-Trio, das fürs Money-Sheet bleibt); `ZieleTreeTheme` += `progress`. `portfolio-overview.ts` `themeProgress` auf denselben Rollup umstellen.
3. **UI**: `strategy-table-view.tsx` Theme-Progress-Spalte + `goal-detail-panel.tsx` „Goal completion" nutzen den Rollup.
4. **Verify**: Werte Liste = Detail = Portfolio-Overview; keine Money-Sheet-Regression.

---

## Iteration 2 — Kommunikation & Verknüpfung (M2)

### Epic 4 · Status-Update-Composer — ~1.5 Tage

1. **Schema** (`GoalCheckin`): `sections Json?` **neben** `note` (rückwärtskompatibel). db push.
2. **Service/Action**: `recordGoalCheckin` nimmt `sections`; Audit unverändert (`goal.checkin`).
3. **View**: `loadGoalDetail` / `GoalCheckinEntry` / `GoalActivityEntry` reichen `sections` durch.
4. **UI**: Composer im Check-in-Flow (`goal-detail-panel.tsx`, Sektionen add/remove); `goal-activity-feed.tsx` rendert Sektionen (Titel + Text); alte Notes = ein Abschnitt.
5. **Verify**: alte Notes laden; neue Sektionen im Feed.

### Epic 5 · Related Work — ~1.5 Tage

1. **Schema** (neu `GoalRelatedWork`): `objectiveId? / keyResultId?`, `kind ("feature"|"epic"|"pi")`, `refId`, `createdBy`, Indizes. db push.
2. **Service/Action**: `addGoalRelatedWork` / `removeGoalRelatedWork`; Audit `goal.related_work.added/removed` in `emit.ts`.
3. **View**: `loadGoalDetail` += `relatedWork` (Titel/Status via Join zu `Initiative`/`ProgramIncrement`).
4. **UI**: „Related work"-Sektion im Drawer (Add/Remove + Deeplink). Kein Fortschrittsbeitrag.
5. **Verify**: verknüpfen, Navigation, Progress unverändert.

### Epic 3 · Gewichtete Rollups — ~1 Tag · _hängt an Epic 2_

1. **Schema** (`KeyResult`): `rollupWeight Decimal? @db.Decimal(6,4)`. db push.
2. **Domain**: `rollupObjectiveProgress` um optionalen Gewichtsvektor; gleiche Gewichte ⇒ Epic-2-Ergebnis (Test).
3. **UI**: Gewicht im KR-Edit + Anzeige „trägt X % bei".
4. **Verify**: Test gleiche Gewichte = ungewichtet.

---

## Iteration 3 — Governance (M3)

### Epic 6 · Verantwortung + Zugriffsstufen — ~3–4 Tage

**Feature A — VS/ART-Zuordnung (n:m):**

1. **Schema**: `goal_value_streams` + `goal_arts` (Join: `objectiveId` + `valueStreamId`/`artId`). db push.
2. **Service/Action**: Zuordnungen setzen/ersetzen; Audit-Actions.
3. **View + UI**: durchreichen; Multi-Select + Chips im Drawer; **Filter** nach VS/ART in `ziele-shell`/`strategy-table-view`.

**Feature B — Access Levels:** 4. **Schema**: `goal_access { objectiveId, userId, level ("admin"|"editor"|"viewer") }`. db push. 5. **Service/Authorize**: `canEdit` aus Access-Level statt nur `target.manage`; **Migration = bestehende Rechte** (kein Rechteverlust). 6. **UI**: Rechte-Verwaltung im Drawer. 7. **Verify**: Migrationssicherheit, Filter, Editor/Viewer-Gating.

### Epic 7 · Custom Fields an Zielen — ~3 Tage

1. **Schema**: `goal_custom_field_def { tenantId, name, type }` + `goal_custom_field_value { defId, objectiveId, value }`. db push.
2. **Service/Action**: Def-CRUD (Admin) + Wert-Set.
3. **View + UI**: durchreichen; Admin-Verwaltung; Werte im Drawer; „Felder ein-/ausblenden" pro Nutzer (via `useUrlState`/Preferences) in der Liste.
4. **Verify**: Typvalidierung; Sicht persistiert.

---

## Iteration 4 — Visualisierung (M4)

### Epic 8 · Strategy Map (ziel-zentriert) — ~3–4 Tage · _hängt an Epic 2 (·6)_

1. **View**: `strategy-network-view` (ReactFlow) Knotendaten um Status + Fortschritt (aus Rollup/`goal-status`).
2. **UI**: `GoalStatusPill`/Progress im Knoten; Expand/Collapse + Count-Badge (nur bei Beiträgen); Side-Pane (Reuse Drawer).
3. **Verify**: große Map, Interaktion, Statusfarben aus `goal-status`.

---

## Zurückgestellt

### Epic 9 · Reminder & Grading — ~2 Tage (nach Bedarf)

Braucht einen **Scheduler** (Cron/Job). Owner-Kadenz-Erinnerungen + End-of-Period-„bewerten & schließen". ⚠ Kadenz-Details vorab an Asana-Quelle verifizieren. Nicht Teil der aktuellen Iterationen.

---

## Cross-Cutting-Kapitel (gilt für jeden Epic)

> Querschnittliche Konventionen, die **jeder** Epic erbt. Einmal hier, nicht pro Epic wiederholt.

### C1 · Datenmodell-Konventionen (neue Tabellen)

Für `goal_related_work`, `goal_value_streams`, `goal_arts`, `goal_access`, `goal_custom_field_def/_value`, `GoalCheckin.sections`:

- **Tenant-Scoping + RLS**: jede Tabelle trägt `tenantId @db.Uuid` und bekommt eine **RLS-Policy** (Pulse ist RLS-tenant-scoped). Ohne Policy sind Zeilen tenant-übergreifend sichtbar.
- **Cascade**: FKs auf `Objective`/`KeyResult` mit `onDelete: Cascade` (wie `GoalCheckin`/`GoalComment`).
- **Indizes**: `(tenantId, objectiveId)` bzw. `(tenantId, keyResultId)`; Join-Tabellen zusätzlich eindeutiger Composite-Index.
- **Migration**: `pnpm prisma db push` → Client-Regen → **Dev-Server neu starten** (Stale-Client-Falle). Kein Migrations-Ordner.

### C2 · Backfill-Katalog (je Epic)

- **E1**: Defaults (`unit="number"`, `precision=0`) ⇒ kein Backfill. **E2**: kein Backfill, aber Sichtprüfung plausibler Bestandswerte. **E3**: `rollupWeight` NULL = gleichgewichtet. **E4**: `sections` NULL, `note` bleibt Quelle. **E6/7**: leere Defaults; Access-Migration = heutiges `target.manage`-Verhalten. Scripts über `src/generated/prisma`.

### C3 · i18n (next-intl, de/en)

Alle neuen Strings über `messages/de.json` + `messages/en.json` (kein Hartkodieren). Betrifft Status-/Sektions-/Einheiten-Labels, „Related work", Custom-Field-UI, Filter, Map-Controls. Domain-Labels (`GOAL_STATUS_LABELS`) bleiben zentral.

### C4 · Teststrategie

- **Domain-Unit-Tests** (Pflicht): `rollupObjectiveProgress`, `formatMetricValue`, `normalizeKrValue`, `suggestOpenStatus`.
- **Service-Tests**: Wert-Einfrieren, Progress-Update (auto abgelehnt), Access-Gating.
- **DB-Smoke** je Epic (mit Cleanup); **Browser-Verify** auf `/de/strategy` + `/de/ziele`.
- **Seed** (`prisma/seed.ts`): manuelles KR mit %-Einheit + Ziel mit VS/ART-Zuordnung.

### C5 · Audit

Neue `AuditAction`-Werte in `src/server/audit/emit.ts`: `goal.related_work.added/removed`, `goal.access.granted/revoked`, `goal.custom_field.*` (vorhanden: `goal.checkin`, `goal.progress.updated`, `goal.comment.added`). Payload `{ feld: { before, after } }`.

### C6 · Downstream-Wirkung

**Epic 2 ist breaking**: `loadStrategyTree` speist auch `portfolio-overview.ts`. Regressions-Check vor Merge: `/de/portfolio` (alle Views), Money-Sheet (€-Trio unverändert), `strategy-table-view`, `okr-board-view`. **€-Trio bleibt Geld-Sicht; Metrik-Rollup ist Fortschritts-Sicht** — im Code klar trennen.

### C7 · Performance

- `loadGoalDetail` Related Work: Titel/Status per **einer** gebündelten Query (kein N+1).
- „Letzter Check-in pro Entity" bei Skalierung auf `DISTINCT ON`/Fenster-Query.
- Rollup pro Load (kein Persist); bei großen Bäumen memoisieren.

### C8 · Delivery-Vorbedingungen

- **Vorbedingung**: Ziele-Basis (Status-Rework + Check-in/Progress) liegt **uncommittet auf `develop`** → zuerst committen (Scope `portfolio`).
- Commit-Scope `portfolio`, lowercase, prettier/eslint-Pre-commit, nie `--no-verify`.
- Optional: Epics 6/7/8 hinter Feature-Gate.

### C9 · A11y & Responsive

Neue Komponenten (Status-Composer, breiter Drawer `max-w-3xl`, Strategy Map): Fokus-States, Tastatur, `prefers-reduced-motion`; Map ggf. horizontal scrollbar im eigenen Container.

---

## Entscheidungen (Decision-Log)

Getroffene und offene Entscheidungen. Tragende sind als ADR festgehalten (`docs/adr/`).

- **D1 · Zugriffsstufen** _(Epic 6)_ — **✅ additiv** (ADR-0007): `target.manage` bleibt oberste Ebene, `goal_access` verfeinert nur nach unten, neue Capability `goal.share`. Migration = heutiges Verhalten.
- **D2 · Objective-Rollup gemischte Einheiten** _(Epic 2)_ — **✅ normalisierter Ø** (ADR-0008): Completion = (gewichteter) Ø der KR-Fortschritte 0..1; kein Objective-Rohwert.
- **D3 · Mehr-Währung** — kein Cross-Currency-Summieren (folgt aus D2); Objective zeigt nur Completion-%.
- **D4 · Gewichts-Normalisierung** _(Epic 3)_ — relativ, intern normalisiert (`weight_i / Σ weight`); fehlend ⇒ 1; alle gleich ⇒ ungewichteter Ø.
- **D5 · Related-Work-Umfang** _(Epic 5)_ — Feature · Epic · PI; an Objective- **und** KR-Ebene; rein referenziell; `kind`-Enum erweiterbar.
- **D6 · Zeitperioden** — `Objective.period` behalten, Format validieren + Helper; custom periods späterer Mini-Epic.
- **D7 · Member-Benachrichtigungen** — eigener kleiner Epic (getrennt von deferred Remindern); MVP Status-/Owner-Wechsel → Members.

---

## Konsolidiertes Ziel-Datenmodell (Zielbild nach allen Epics)

```
StrategicTheme (versteckter Anker)
  └─ Objective  ("Theme" in UI)
        fields: title, narrative, period, confidence, ownerId,
                status?, dueDate?, closedAt?, closingNote?
        [E6] n:m → goal_value_streams (objectiveId, valueStreamId)
        [E6] n:m → goal_arts          (objectiveId, artId)
        [E6] 1:n → goal_access        (objectiveId, userId, level: admin|editor|viewer)
        [E7] 1:n → goal_custom_field_value (objectiveId, defId, value)
        [E5] 1:n → goal_related_work  (objectiveId?, kind: feature|epic|pi, refId)
        └─ KeyResult
              fields: title, metricName,
                      [E1] unit(number|percent|currency), precision, currencyCode?,
                      baseline, target, current, formula(manual|auto_from_kpi),
                      [E3] rollupWeight?, status?, dueDate?, ownerId
              [E5] 1:n → goal_related_work (keyResultId?, …)
              └─ KrKpiContribution (weight) → Kpi (measurements)

GoalCheckin (Objective? | KeyResult?)   status? · value? · progress? · [E4] sections? · note? · createdBy
GoalComment (Objective? | KeyResult?)   body · createdBy
goal_custom_field_def (tenantId, name, type: text|number|select)   [E7]
```

Alle neuen Tabellen: `tenantId` + RLS-Policy + `onDelete: Cascade`. Genau eine polymorphe FK (objectiveId/keyResultId) gesetzt.

---

## Definition of Done

**Generisches Gate (jeder Epic):** `tsc`+`lint` grün · Domain-Unit-Tests · DB-Smoke mit Cleanup · Browser-Verify `/de/strategy`+`/de/ziele` · i18n de+en · A11y (Fokus/Tastatur/reduced-motion) · Audit-Actions registriert · RLS-Policy · kein `portfolio-overview`-Regress · CONTEXT.md bei neuem Konzept · Commit-Scope `portfolio`.

**Epic-Zusatz (Auszug):**

- **E1**: KR je Einheit; Chart/Karte formatieren korrekt.
- **E2**: Wert Liste=Detail=Portfolio-Overview; Money-Sheet unverändert; **ADR-0008**.
- **E3**: Test „gleiche Gewichte = ungewichtet".
- **E4**: alte Notes laden; Sektionen im Feed.
- **E5**: Verknüpfen/Entfernen + Deeplink; kein Fortschritts-Einfluss.
- **E6**: kein Rechteverlust; Viewer read-only; Filter; **ADR-0007**.
- **E7**: Typvalidierung; „Felder ein/aus" persistiert.
- **E8**: Statusfarben aus `goal-status`; Expand/Collapse + Side-Pane; Machbarkeits-Spike vorab.

---

## Risiken (Kurz)

- **Stale-Client-Falle**: nach jedem `db push` Dev-Server neu starten.
- **Epic 2 breaking** für `portfolio-overview`/Reporting — Regressions-Check.
- **Rechte-Migration** (Epic 6): Default = heutiges `target.manage`-Verhalten.
- **Offene Asana-Verify-Punkte** (Item-Limits, Kadenzen, Custom-Weights) vor Epic 3/5/9 gegenprüfen.
