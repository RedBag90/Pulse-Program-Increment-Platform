# Backlog: Pulse als Zielzustand-Begleiter (Soll/Ist-Transformationssteuerung)

**Status:** 🟡 Vorschlag / Geplant — noch nicht umgesetzt.

## Kontext & Vision

Pulse positioniert sich laut technischem Konzept als Plattform „for managing
large-scale agile **transformations**", ist aber heute als **SAFe-Steady-State-
Betriebssystem** gebaut: die volle Hierarchie (Wertstrom → ART → Team → PI →
Epic) plus WSJF, Stage Gates und Mehrparteien-Freigabe sind ab Tag 1 Pflicht,
„not optional configurations — they are the schema".

Die eigentliche Vorgabe ist breiter: **Pulse ist ein Werkzeug, um einen vom
Management definierten Zielzustand der Organisation zu erreichen.** SAFe ist nur
_eine mögliche_ Ausprägung dieses Ziels, nicht das Ziel selbst. Den Zielzustand
zu definieren ist ein **verpflichtender erster Schritt** des Managements — ohne
ihn hat das Werkzeug keinen Maßstab.

Der Konstruktionsfehler heute: Es _gibt_ bereits einen Zielzustand — aber einen
**hartkodierten, impliziten** im „Struktur-Lücken"-Panel
([structure-overview.tsx](../../src/features/structure/components/structure-overview.tsx))
(„jeder Wertstrom braucht VMO+Finance, jedes ART einen RTE …"). Das Soll setzt
der Code, nicht das Management — und es ist immer Voll-SAFe.

**Zielbild dieses Backlogs:** den Zustand explizit machen und das Tool um die
Schleife **Soll → Ist → Lücke → Steuern → Ankunft** herum bauen.

## Leitprinzipien

- **Zielzustand ist ein erstklassiges, management-eigenes Artefakt.** Struktur-
  Ziele + aktivierte Praktiken + Outcomes/OKRs + Zieltermin.
- **SAFe ist Vokabular & Vorlage, kein Zwang.** Vorlagen als Startpunkt, danach frei.
- **Der Zielzustand ist der Master-Schalter für Komplexität.** Nur die Konzepte/
  Navigation/Struktur, die das deklarierte Ziel enthält, erscheinen je. Komplexitäts-
  reduktion entsteht so als _Nebenprodukt_ des Zwecks (vgl. die Rollen- und
  Transformations-Analysen).
- **Den Wandel messen, nicht nur die Lieferung.** Heutiges Reporting
  (`pi-velocity`, `portfolio-health`, `wsjf-leaderboard`) misst Output; hier
  kommt die Soll/Ist-Annäherung über Zeit dazu.
- **Wiederverwenden statt neu bauen.** „Struktur-Lücken" + `getStructureMetrics`
  ([structure.ts](../../src/server/services/structure.ts)) sind das halbfertige
  Ist-Ende; `PermissionGate` + `authorize()` liefern das Gating.

## Architektur-Entscheidung (Annahme)

**Hybrid:** Das Management wählt eine **Vorlage** („Team-Level", „Essential SAFe",
„Portfolio SAFe") als Startpunkt und **konfiguriert sie dann frei** (Bausteine
ein/aus, Zielwerte, Outcomes). Vorlagen senken die Aktivierungsenergie; die
Konfigurierbarkeit erfüllt „vom Management definiert". Falls das Management
stattdessen reine Vorlagen ohne Konfiguration will, entfällt Feature A2b.

---

## Roadmap

| Phase                   | Meilenstein                             | Inhalt                                                                                                           | Epics      |
| ----------------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ---------- |
| **0 — Fundament**       | _Zielzustand existiert & wird gemessen_ | Zielzustand-Artefakt + Vorlagen/Konfigurator; Soll/Ist-Berechnung; Lücken-Panel auf deklariertes Soll umgestellt | A, B1, B3  |
| **1 — Sichtbarkeit**    | _Management sieht den Fortschritt_      | Transformations-Cockpit; Management-Rolle & Landing; Outcomes/OKRs                                               | B2, E1, A3 |
| **2 — Steuerung**       | _Das Ziel steuert die App & führt_      | Zielzustand schaltet Navigation/Konzepte; Transformations-Backlog + Assistenten                                  | C, D       |
| **3 — Reise über Zeit** | _Der Wandel wird über Zeit sichtbar_    | Snapshots/Trends Richtung Ziel; Transformations-Zeitstrahl                                                       | E2, E3     |

Phase 0 ist der Schlussstein — ohne deklarierten Zielzustand hat nichts einen
Maßstab. Reihenfolge ist abhängigkeitsgetrieben; Phasen 1–3 sind danach
weitgehend parallelisierbar.

---

## Epic A — Zielzustand-Artefakt (Target Operating Model)

Das management-eigene Soll: Ziel-Struktur, aktivierte Praktiken, Outcomes, Termin.

### Feature A1 — Datenmodell & Service für den Zielzustand

#### TGT-001 — Prisma-Modell `TargetOperatingModel`

**As a** Mandanten-Architekt,
**I want** einen mandantenweiten Zielzustand zu speichern,
**so that** alle Soll/Ist-Vergleiche einen Maßstab haben.
**Acceptance Criteria:**

- `TargetOperatingModel` (1 aktiver je Tenant): `tenantId`, `status` (`draft`/`active`/`archived`), `targetDate?`, `createdBy`/`updatedBy`.
- Struktur-Ziele: `targetValueStreams`, `targetArtsTotal`, `targetTeamsTotal`, `targetPiCadenceWeeks?` (nullable = nicht im Ziel).
- Praktik-Flags (Bool): `stageGates`, `wsjf`, `multiPartyApproval`, `featureQs`, `dependencies`, `piObjectives`, `portfolioLevel`, `programLevel`.
- Migration via `prisma db push` gegen Supabase; Client regeneriert.
  **Estimate:** 5 · **Dependencies:** – · **Module:** `prisma/schema.prisma`, `src/server/services/target-model.ts`

#### TGT-002 — Service: Zielzustand lesen/schreiben (audited)

**As a** Management-Nutzer,
**I want** den Zielzustand anzulegen und zu bearbeiten,
**so that** er versioniert und nachvollziehbar ist.
**Acceptance Criteria:**

- `getActiveTargetModel(db, tenantId)`, `upsertTargetModel(ctx, input)` über `withAuditedTransaction`/`createServerAction`.
- Aktivieren eines Entwurfs archiviert das vorige aktive Modell; jede Änderung erzeugt ein Audit-Event.
- Berechtigung: neue Capability `target.manage` (s. TGT-021).
  **Estimate:** 5 · **Dependencies:** TGT-001, TGT-021 · **Module:** `src/server/services/target-model.ts`, `src/features/transformation/actions/`

### Feature A2 — Vorlagen-Wähler & Konfigurator (Management-UI)

#### TGT-003 — Vorlagen-Bibliothek

**As a** Management-Nutzer,
**I want** aus Vorlagen („Team-Level", „Essential SAFe", „Portfolio SAFe") zu starten,
**so that** ich nicht bei Null konfiguriere.
**Acceptance Criteria:**

- Reine Daten: `OPERATING_MODEL_TEMPLATES` (Praktik-Flags + sinnvolle Struktur-Defaults je Vorlage).
- „Team-Level": nur `programLevel=false`, `portfolioLevel=false`, Stage Gates/WSJF/Approval aus. „Essential SAFe": Programm an, Portfolio aus. „Portfolio SAFe": alles an.
- Auswahl füllt einen Entwurf vor.
  **Estimate:** 3 · **Dependencies:** TGT-001 · **Module:** `src/domain/operating-model.ts`

#### TGT-004 — Konfigurator-Seite `/transformation/ziel`

**As a** Management-Nutzer,
**I want** die Vorlage frei anzupassen und Zielwerte zu setzen,
**so that** der Zielzustand unsere Organisation abbildet.
**Acceptance Criteria:**

- Formular: Vorlage wählen → Praktik-Toggles → Struktur-Zielwerte → Zieltermin.
- Inline-Erklärung je Praktik (nutzt das Glossar, s. UX-Plan).
- „Als aktiv setzen" mit Bestätigung; Entwurf speicherbar.
- Nur sichtbar/aktiv für `target.manage`.
  **Estimate:** 8 · **Dependencies:** TGT-002, TGT-003 · **Module:** `src/app/[locale]/(dashboard)/transformation/ziel/page.tsx`, `src/features/transformation/components/`

### Feature A3 — Outcomes / OKRs am Zielzustand (Phase 1)

#### TGT-005 — Org-Outcome-Modell

**As a** Management-Nutzer,
**I want** organisationsweite Ziel-Outcomes (OKRs/KPIs) zu hinterlegen,
**so that** der Zielzustand ein Geschäfts- und nicht nur ein Strukturziel ist.
**Acceptance Criteria:**

- `TargetOutcome`: `title`, `metricUnit?`, `baseline?`, `target`, `current?`, `dueDate?`, verknüpft mit `TargetOperatingModel`.
- CRUD über audited Action; Capability `target.manage`.
- Abgrenzung dokumentiert: org-weit (vs. Epic-`KPI`, vs. PI-`Objective`).
  **Estimate:** 5 · **Dependencies:** TGT-001 · **Module:** `prisma/schema.prisma`, `src/server/services/target-outcome.ts`

---

## Epic B — Soll/Ist-Cockpit (Transformations-Status)

### Feature B1 — Soll/Ist-Berechnung

#### TGT-006 — Gap-Service Struktur

**As a** System,
**I want** den Ist-Zustand gegen das deklarierte Soll zu rechnen,
**so that** die Lücke quantifiziert ist.
**Acceptance Criteria:**

- `computeStructureGap(db, tenantId)` nutzt `getStructureTree`/`getStructureMetrics` und das aktive `TargetOperatingModel`.
- Liefert je Dimension Ist/Soll/Δ + Fortschritt % (Wertströme, ARTs, Teams, Kadenz, Rollenbesetzung).
- Fallback ohne aktives Zielmodell: klare „noch kein Ziel definiert"-Antwort.
  **Estimate:** 5 · **Dependencies:** TGT-001 · **Module:** `src/server/services/transformation.ts`

#### TGT-007 — Gap-Service Praktiken & Outcomes

**As a** System,
**I want** Adoptions- und Outcome-Lücken zu rechnen,
**so that** auch Verhalten/Wirkung gemessen wird, nicht nur Struktur.
**Acceptance Criteria:**

- Praxis-Adoption: für jede _aktivierte_ Praktik ein Ist-Signal (z. B. `piObjectives` → Anteil Teams mit Objectives im aktiven PI; `dependencies` → genutzt ja/nein; `featureQs` → Anteil Features durch QS).
- Outcome-Gap: je `TargetOutcome` `current` vs `target`.
- Deaktivierte Praktiken erscheinen **nicht** als Lücke.
  **Estimate:** 8 · **Dependencies:** TGT-005, TGT-006 · **Module:** `src/server/services/transformation.ts`

### Feature B2 — Cockpit-Seite (Phase 1)

#### TGT-008 — `/transformation` Cockpit

**As a** Management-Nutzer,
**I want** Struktur-, Praxis- und Outcome-Lücke auf einen Blick,
**so that** ich den Stand der Transformation kenne.
**Acceptance Criteria:**

- Gesamtfortschritt % + drei Panels (Struktur / Praktiken / Outcomes) mit Ist/Soll/Δ.
- Jede Lücke verlinkt auf die behebende Stelle (ART anlegen, RTE zuweisen, Outcome pflegen).
- Leerer Zustand verlinkt auf den Konfigurator (TGT-004).
  **Estimate:** 8 · **Dependencies:** TGT-006, TGT-007 · **Module:** `src/app/[locale]/(dashboard)/transformation/page.tsx`, `src/features/transformation/components/`

### Feature B3 — „Struktur-Lücken" auf deklariertes Soll umstellen (Phase 0)

#### TGT-009 — Lücken-Panel gegen Zielmodell rechnen

**As a** Nutzer der Struktur-Übersicht,
**I want** dass angezeigte Lücken dem _definierten_ Ziel entsprechen,
**so that** keine „Lücken" für bewusst nicht gewählte Praktiken erscheinen.
**Acceptance Criteria:**

- `structure-overview.tsx` ersetzt die hartkodierten Soll-Annahmen durch das aktive `TargetOperatingModel`.
- Ohne Portfolio-Level im Ziel: keine VMO/Finance-Lücken. Ohne Programm-Level: keine RTE-Lücken usw.
- Verhalten ohne aktives Zielmodell: heutige Defaults (Rückwärtskompatibilität).
  **Estimate:** 5 · **Dependencies:** TGT-006 · **Module:** `src/features/structure/components/structure-overview.tsx`, `src/app/[locale]/(dashboard)/structure/page.tsx`

---

## Epic C — Zielzustand steuert die Oberfläche (Komplexitäts-Schalter)

### Feature C1 — Praktik-Flags als Sichtbarkeitsquelle

#### TGT-010 — `useOperatingModel` / Server-Helfer

**As a** Entwickler,
**I want** eine zentrale Quelle „welche Praktik ist im Ziel an",
**so that** UI und Routen konsistent gaten.
**Acceptance Criteria:**

- Server: `isPracticeEnabled(tenantId, practice)`; Client: Context-Provider im Dashboard-Layout, gespeist aus dem aktiven Modell.
- Default (kein Modell) = alles an (heutiges Verhalten).
  **Estimate:** 3 · **Dependencies:** TGT-001 · **Module:** `src/domain/operating-model.ts`, `src/app/[locale]/(dashboard)/layout.tsx`

### Feature C2 — Navigation nach Zielzustand filtern

#### TGT-011 — Sidebar/Nav nach aktivierten Ebenen

**As a** Nutzer,
**I want** nur Navigation für Praktiken in unserem Ziel,
**so that** die App nicht mit ungenutztem SAFe überfrachtet ist.
**Acceptance Criteria:**

- Ohne `portfolioLevel`: Portfolio-Gruppe (Epics/Roadmap) ausgeblendet. Ohne `programLevel`: PI-Planung/ARTs reduziert.
- Kombiniert mit der rollenbasierten Filterung aus dem UX-Plan (Ziel **und** Rolle).
  **Estimate:** 5 · **Dependencies:** TGT-010 · **Module:** `src/components/nav/sidebar.tsx`, `src/app/[locale]/(dashboard)/layout.tsx`

### Feature C3 — Konzepte/Tabs nach Zielzustand ausblenden

#### TGT-012 — Epic-Maschinerie an Praktik-Flags koppeln

**As a** Nutzer einer Organisation ohne formale Governance,
**I want** keine Stage-Gate-/Mehrparteien-Freigabe-UI,
**so that** die Epic-Seite nur zeigt, was wir tatsächlich nutzen.
**Acceptance Criteria:**

- `stageGates=false` blendet Stage-Gate-Aktionen/Anzeige aus; `multiPartyApproval=false` blendet den „Freigaben"-Tab + Hypothese/Business-Case-Workflow aus; `wsjf=false` blendet WSJF-Scoring aus.
- Routen sind zusätzlich serverseitig hart geschützt (nicht nur UI), wenn die Praktik aus ist.
  **Estimate:** 8 · **Dependencies:** TGT-010 · **Module:** `src/features/portfolio/components/`, `src/features/art/components/`

---

## Epic D — Transformations-Backlog (geführte Maßnahmen)

### Feature D1 — Maßnahmen aus der Lücke ableiten

#### TGT-013 — Empfohlene nächste Schritte

**As a** Coach/Management,
**I want** aus der Soll/Ist-Lücke konkrete nächste Schritte,
**so that** klar ist, was als Nächstes zur Zielerreichung zu tun ist.
**Acceptance Criteria:**

- Regeln leiten Maßnahmen ab („+1 ART bis Ziel", „3 ARTs ohne RTE", „kein PI fürs nächste Quartal", „Epic seit 30 T in hypothesis_review").
- Priorisiert nach Hebel/Blockade; jede Maßnahme verlinkt auf die Aktion.
  **Estimate:** 8 · **Dependencies:** TGT-006, TGT-007 · **Module:** `src/server/services/transformation.ts`

### Feature D2 — Maßnahmen-Backlog

#### TGT-014 — Maßnahmen verfolgen (Owner/Status/Termin)

**As a** Transformations-Verantwortliche:r,
**I want** Maßnahmen zuweisen und ihren Status verfolgen,
**so that** die Transformation wie ein Backlog gesteuert wird.
**Acceptance Criteria:**

- `TransformationAction`: `title`, `source` (abgeleitet/manuell), `ownerId?`, `status` (`open`/`in_progress`/`done`), `dueDate?`; audited.
- Liste im Cockpit; abgeleitete schließen automatisch, wenn die Lücke verschwindet.
  **Estimate:** 8 · **Dependencies:** TGT-013 · **Module:** `prisma/schema.prisma`, `src/features/transformation/`

### Feature D3 — Geführte Assistenten

#### TGT-015 — „ART starten"-Assistent

**As a** Management/RTE,
**I want** in einem Flow ein ART anzulegen, RTE zuzuweisen, Kadenz zu setzen und das erste PI zu planen,
**so that** ich nicht vier Einzeldialoge durchklicke.
**Acceptance Criteria:**

- Mehrschrittiger Assistent erstellt ART → setzt `piCadenceWeeks` → weist RTE → legt erstes PI an, in einer Transaktion-Kette mit Audit.
- Erreichbar aus Cockpit-Maßnahme und `/structure`.
  **Estimate:** 8 · **Dependencies:** TGT-010 · **Module:** `src/features/transformation/components/`, bestehende `art`/`pi`-Services

---

## Epic E — Management-Rolle & Reise über Zeit

### Feature E1 — Management-Rolle & Cockpit-Landing (Phase 1)

#### TGT-016 — Rolle `transformation_lead`

**As a** Mandanten-Admin,
**I want** eine Rolle für Transformations-Verantwortliche,
**so that** Coach/Sponsor das Cockpit ohne vollen Admin nutzen.
**Acceptance Criteria:**

- Neue Rolle in `roles.ts`; Capabilities `target.manage`, `transformation.read` in den Policies; Persona ergänzt.
- `viewer` (Sponsor) erhält `transformation.read` (nur lesen).
  **Estimate:** 5 · **Dependencies:** TGT-021 · **Module:** `src/domain/roles.ts`, `src/server/auth/policies/index.ts`, `docs/personas.md`

#### TGT-017 — Rollenbasierte Landing-Page

**As a** Nutzer,
**I want** nach dem Login dort zu landen, wo meine Arbeit ist,
**so that** ich nicht im Portfolio-Kanban stranden, das mich nicht betrifft.
**Acceptance Criteria:**

- `transformation_lead`/Sponsor → `/transformation`; `task_owner`/`story_owner` → `/sprint`; RTE/`feature_owner` → ihr ART; Portfolio-Rollen → `/portfolio`.
- Umsetzung in Middleware/Layout-Redirect.
  **Estimate:** 3 · **Dependencies:** TGT-016 · **Module:** `src/middleware.ts`, `src/app/[locale]/(dashboard)/layout.tsx`

### Feature E2 — Snapshots & Trends (Phase 3)

#### TGT-018 — Periodische Kennzahl-Snapshots

**As a** System,
**I want** die Transformations-Kennzahlen regelmäßig festzuhalten,
**so that** Annäherung ans Ziel über Zeit darstellbar ist.
**Acceptance Criteria:**

- `TransformationSnapshot` (Datum + Struktur/Praxis/Outcome-Werte + Fortschritt %), via Cron/Outbox-Prozessor (vorhandene Infrastruktur).
- Idempotent je Periode; erster Zeitreihen-Service der App.
  **Estimate:** 5 · **Dependencies:** TGT-006, TGT-007 · **Module:** `src/server/services/transformation.ts`, Cron

#### TGT-019 — Fortschritts-Trend im Cockpit

**As a** Management-Nutzer,
**I want** den Verlauf Richtung Ziel sehen,
**so that** ich Tempo und ETA einschätzen kann.
**Acceptance Criteria:**

- Trendlinie Fortschritt % über Zeit + projizierte Zielerreichung gegen `targetDate`.
- Nutzt vorhandene Roadmap-/Charting-Bausteine wo möglich.
  **Estimate:** 5 · **Dependencies:** TGT-018 · **Module:** `src/features/transformation/components/`

### Feature E3 — Transformations-Zeitstrahl

#### TGT-020 — Meilensteine & Reise

**As a** Management-Nutzer,
**I want** Meilensteine („erstes ART gestartet", „PIs synchronisiert", „Ziel erreicht"),
**so that** die Reise erzählbar ist.
**Acceptance Criteria:**

- Automatische Meilensteine aus Snapshots + manuelle Marker; „ihr seid hier" relativ zum Ziel.
  **Estimate:** 5 · **Dependencies:** TGT-018 · **Module:** `src/features/transformation/components/`

---

## Querschnitt

#### TGT-021 — Capabilities & Policies für die Zielzustand-Domäne

**As a** Entwickler,
**I want** `target.manage` / `transformation.read` in der Policy-Registry,
**so that** Zugriff einheitlich über `authorize()` läuft (CONTEXT.md: Seiten fragen Capability, nicht Rolle).
**Acceptance Criteria:**

- Actions ergänzt; Grants: `target.manage` → `tenant_admin`/`transformation_lead`; `transformation.read` → zusätzlich `portfolio_manager`/`viewer`.
- Rollen-Funktions-Matrix aktualisiert.
  **Estimate:** 3 · **Dependencies:** – · **Module:** `src/server/auth/policies/index.ts`, `docs/role-function-matrix.md`

---

## Wiederverwendung vorhandener Bausteine

- `getStructureTree` / `getStructureMetrics` ([structure.ts](../../src/server/services/structure.ts)) — Ist-Werte.
- „Struktur-Lücken"-Panel ([structure-overview.tsx](../../src/features/structure/components/structure-overview.tsx)) — halbfertiges Ist-Ende → auf Soll umstellen (TGT-009).
- `authorize()` / `PermissionGate` / Policy-Registry — Gating (TGT-021).
- `createServerAction` / `withAuditedTransaction` — alle Mutationen + Audit.
- Cron/Outbox-Prozessor — Snapshots (TGT-018).
- Glossar/Tooltips & rollenbasierte Sidebar aus dem UX-Plan — kombinieren mit Ziel-Filter (TGT-011).

## Risiken & Nicht im Umfang

- **Risiko:** Praxis-Flags ausblenden ≠ absichern — Routen serverseitig schützen, nicht nur UI (TGT-012).
- **Risiko:** Rückwärtskompatibilität — ohne aktives Zielmodell muss alles wie heute funktionieren (Defaults „alles an").
- **Risiko:** Adoptions-Signale (TGT-007) können fehlinterpretiert werden — bewusst einfach halten, iterieren.
- **Nicht im Umfang:** Mandantenübergreifende Transformations-Vergleiche; KI-Empfehlungen; Import bestehender OKR-Tools; die im UX-Plan separat geführten Themen (Detailseiten-Merge, Mobile-Nav).

## Verifikation

- `pnpm typecheck` · `pnpm lint` · `pnpm test`; Integrationstests für `target-model`/`transformation`-Services (deletion-/gap-Berechnung) gegen lokale Supabase.
- Manuell: Management definiert Ziel (Vorlage → Konfig → aktiv) → Cockpit zeigt Lücke → Struktur-Lücken folgen dem Soll → deaktivierte Praktik verschwindet aus Nav/Tabs → Maßnahme schließt sich beim Beheben → Login-Landing je Rolle.
