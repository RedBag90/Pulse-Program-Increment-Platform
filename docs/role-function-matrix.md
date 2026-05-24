# Pulse — Funktions-Übersicht & Rollen-Funktions-Matrix

Dieses Dokument listet **alle Funktionen** der Anwendung und ordnet ihnen die
**Rollen** zu, die sie ausführen dürfen. Es ist **kaskadiert nach SAFe-Ebenen**
gegliedert (Portfolio → Wertstrom → Epic → ART → Feature → Team → Story → Task).

Quelle der Wahrheit ist die Policy-Registry
[`src/server/auth/policies/index.ts`](../src/server/auth/policies/index.ts);
die Rollen stammen aus [`src/domain/roles.ts`](../src/domain/roles.ts).
Bei Abweichungen gilt der Code — dieses Dokument ist daran abzugleichen.

## Grundprinzipien

- **Funktionen** sind die 48 zustandsändernden Aktionen der `Action`-Union.
  Reine Lesezugriffe sind hier nicht gelistet — sie werden mandantenweit über
  Row-Level Security (RLS) gesteuert.
- **Admin-Bypass:** `platform_admin` und `tenant_admin` dürfen jede Funktion;
  das ist direkt in `authorize()` verdrahtet, nicht über Grants.
- **Scopes:** Ein Grant kann zusätzlich verlangen, dass die Rolle den Scope der
  Ressource trifft — `value_stream`, `art`, `team` oder `own` (eigene Ressource).
  Ein leerer Scope der Rolle bedeutet „alle in Reichweite".
- **Keine Vererbung:** Die Kaskade ist die _Gliederung_ — jede Rolle hat gezielt
  zugeschnittene Rechte, übergeordnete Rollen erben nicht automatisch.
- **Zwei getrennte Achsen für Epics:**
  - **Stage Gates L0–L5** (`epic.approve`) — der Investment-Funnel.
  - **Freigabe-Workflow** (`approvalPhase`, `epic.hypothesis.*` / `epic.approval.*`
    / `epic.section.signoff`) — die mehrstufige Mehrparteien-Freigabe (siehe unten).
    Beide sind unabhängig. Die alte Ein-Schritt-Epic-QS (`epic.review.*`) wurde
    entfernt; nur Features nutzen noch die QS (`feature.review.*`).

## Rollen

| Rolle                 | Persona (Kurzform)                                                                 |
| --------------------- | ---------------------------------------------------------------------------------- |
| `platform_admin`      | Plattform-Betreiber — betreibt Pulse mandantenübergreifend                         |
| `tenant_admin`        | Mandanten-Administrator — Benutzer, Rollen, ARTs, Integrationen                    |
| `transformation_lead` | Transformations-Lead (Coach / SPC) — definiert den Zielzustand, steuert den Wandel |
| `portfolio_manager`   | Portfolio-Lead / LPM — Portfolio-Backlog & Wertstrom-Finanzierung                  |
| `value_stream_owner`  | Wertstrom-Verantwortlicher (~Business Owner) — steuert seinen Wertstrom            |
| `epic_owner`          | Epic-Verantwortlicher — formuliert/pflegt Epics, reicht zur QS ein                 |
| `vmo`                 | Value Management Office — Epic-QS & Stage-Gate-Governance                          |
| `rte`                 | Release Train Engineer — ART-Orchestrierung, PI-Planung, Feature-QS                |
| `feature_owner`       | Feature-Verantwortlicher / Product Manager — Feature-Backlog & WSJF                |
| `team_editor`         | Scrum Master / Product Owner — Team-Backlog & Sprints                              |
| `story_owner`         | Tech Lead — Stories end-to-end                                                     |
| `task_owner`          | Entwickler — eigene Tasks                                                          |
| `viewer`              | nur Lesen (über RLS)                                                               |

---

## 1 — Funktions-Übersicht (46 Aktionen)

### Governance

| Funktion               | Beschreibung                                                                                                                       |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `tenant.create`        | Neuen Mandanten anlegen (nur `platform_admin`)                                                                                     |
| `tenant.users.manage`  | Benutzer, Rollen und Sichtbarkeits-Scopes verwalten                                                                                |
| `integration.manage`   | Integrationen (Jira / Azure DevOps) konfigurieren                                                                                  |
| `admin.audit-log.read` | Audit-Log einsehen                                                                                                                 |
| `admin.users.read`     | Benutzerliste einsehen                                                                                                             |
| `target.manage`        | Zielzustand (Target Operating Model) + Outcomes definieren/aktivieren (`tenant_admin`, `transformation_lead`, `portfolio_manager`) |

### Portfolio

| Funktion              | Beschreibung                     |
| --------------------- | -------------------------------- |
| `value_stream.create` | Wertstrom anlegen                |
| `epic.delete`         | Epic löschen                     |
| `epic.approve`        | Epic-Stage-Gate (L0–L5) schalten |

### Wertstrom

| Funktion              | Beschreibung         |
| --------------------- | -------------------- |
| `value_stream.update` | Wertstrom bearbeiten |
| `epic.create`         | Epic anlegen         |
| `epic.update`         | Epic bearbeiten      |

### Epic-Freigabe-Workflow (mehrstufig, Mehrparteien)

Sequenzieller Workflow über `initiative.approvalPhase`
(`draft → hypothesis_review → business_case → stakeholder_review → approved`),
unabhängig von den Stage Gates. Jede Entscheidung wird mit Datum in der
Historie geloggt.

| Funktion                   | Beschreibung                                                        |
| -------------------------- | ------------------------------------------------------------------- |
| `epic.hypothesis.submit`   | Benefit Hypothese zur QS einreichen (`draft → hypothesis_review`)   |
| `epic.hypothesis.decide`   | VMO gibt Hypothese frei (→ `business_case`) oder zurück (→ `draft`) |
| `epic.approval.configure`  | Pflicht-Approver je Partei festlegen (mehrere User möglich)         |
| `epic.businesscase.submit` | Business Case zur Stakeholder-Freigabe einreichen                   |
| `epic.approval.decide`     | Zugewiesene:r Approver erteilt/lehnt die eigene Freigabe ab         |
| `epic.section.signoff`     | Breakdown / KPIs explizit abnehmen                                  |

### ART / Programm

| Funktion                                      | Beschreibung                                        |
| --------------------------------------------- | --------------------------------------------------- |
| `art.create` / `art.update` / `art.delete`    | ART anlegen / bearbeiten / löschen                  |
| `pi.create`                                   | Programm-Inkrement anlegen                          |
| `pi.update`                                   | PI bearbeiten                                       |
| `pi.start`                                    | PI starten                                          |
| `pi.complete`                                 | PI abschließen                                      |
| `pi.delete`                                   | PI löschen                                          |
| `pi_objective.create` / `pi_objective.update` | PI-Ziel anlegen / bearbeiten                        |
| `team.create` / `team.update` / `team.delete` | Team anlegen / bearbeiten / löschen                 |
| `feature.delete`                              | Feature löschen                                     |
| `feature.review.decide`                       | Feature-QS entscheiden — freigeben oder zurückgeben |

### Feature

| Funktion                | Beschreibung                    |
| ----------------------- | ------------------------------- |
| `feature.create`        | Feature anlegen                 |
| `feature.update`        | Feature bearbeiten              |
| `feature.wsjf.set`      | WSJF-Wert eines Features setzen |
| `feature.review.submit` | Feature zur QS einreichen       |

### Story

| Funktion                                         | Beschreibung                         |
| ------------------------------------------------ | ------------------------------------ |
| `story.create` / `story.update` / `story.delete` | Story anlegen / bearbeiten / löschen |

### Task

| Funktion      | Beschreibung    |
| ------------- | --------------- |
| `task.create` | Task anlegen    |
| `task.edit`   | Task bearbeiten |

### Abhängigkeiten

| Funktion            | Beschreibung            |
| ------------------- | ----------------------- |
| `dependency.link`   | Abhängigkeit verknüpfen |
| `dependency.unlink` | Abhängigkeit lösen      |

### Impediments

| Funktion              | Beschreibung          |
| --------------------- | --------------------- |
| `impediment.create`   | Impediment melden     |
| `impediment.escalate` | Impediment eskalieren |
| `impediment.resolve`  | Impediment auflösen   |

---

## 2 — Rollen-Funktions-Matrix (kaskadiert nach Ebenen)

Pro Rolle die **vollständige** Liste ihrer Funktionen, inklusive Funktionen
unterer Ebenen. `(art)` / `(team)` / `(value_stream)` / `(own)` kennzeichnet
einen Scope.

### Ebene 0 — Governance

#### `platform_admin` — Plattform-Betreiber

- **Alle** Funktionen, mandantenübergreifend. Einzige Rolle mit `tenant.create`.
- Bypass in `authorize()` — erscheint in keinem Grant.

#### `tenant_admin` — Mandanten-Administrator

- **Alle** Funktionen innerhalb des eigenen Mandanten (Bypass in `authorize()`).
- Explizit zugeordnete Governance-Funktionen: `tenant.users.manage`,
  `integration.manage`, `admin.audit-log.read`, `admin.users.read`,
  `art.create/update/delete`, `team.create/delete`, `epic.delete`,
  `feature.delete`, `story.delete`.

### Ebene 1 — Portfolio

#### `portfolio_manager` — Portfolio-Lead / LPM

- **Portfolio:** `value_stream.create`, `value_stream.update`, `epic.create`,
  `epic.update`, `epic.delete`, `epic.approve` (Stage Gates), `epic.hypothesis.submit`.
- **Feature:** `feature.create`, `feature.update`, `feature.wsjf.set`,
  `feature.delete`, `feature.review.submit`.
- **Ausführung:** `story.create/update/delete` (art), `task.create/edit` (art),
  `dependency.link/unlink`, `impediment.create/escalate/resolve`.
- Scope: Wertströme (leer = ganzer Mandant).

### Ebene 2 — Wertstrom

#### `value_stream_owner` — Wertstrom-Verantwortlicher

- `value_stream.update` (value_stream) — nur der eigene Wertstrom.
- `epic.create` (value_stream), `epic.update` (value_stream),
  `epic.hypothesis.submit` (value_stream) — Epics des eigenen Wertstroms.
- Scope: Wertströme. **Hinweis:** Der Scope wird sicher beim `epic.create`
  geprüft (die Ziel-`valueStreamId` liegt im Input). Bei `epic.update` trägt die
  Ressource keine `valueStreamId` — der Scope degradiert dort auf „unskopiert"
  (gleiches Verhalten wie `art`/`team`-Scopes). Eine strikte Durchsetzung auf
  der Service-Ebene ist eine offene Folge-Aufgabe.

### Ebene 3 — Epic & Freigabe

#### `epic_owner` — Epic-Verantwortlicher

- `epic.create`, `epic.update`.
- **Freigabe-Workflow:** `epic.hypothesis.submit`, `epic.approval.configure`
  (wählt die Pflicht-Approver), `epic.businesscase.submit`. Reicht ein und holt
  Freigaben ein, entscheidet aber **nicht** selbst (Funktionstrennung).

#### `vmo` — Value Management Office

- `epic.hypothesis.decide` — gibt die Benefit Hypothese frei oder zurück.
- `epic.section.signoff` — Breakdown-/KPI-Abnahme (mit `value_stream_owner`,
  `portfolio_manager`).
- `epic.approve` — schaltet die Epic-Stage-Gates L0–L5 mit (zusammen mit
  `portfolio_manager`).

#### Stakeholder-Approver (Querschnitt)

- `epic.approval.decide` — der vom Epic Owner **zugewiesene** User erteilt/lehnt
  die Freigabe seiner Partei ab. Policy-seitig auf die Approver-Rollen
  beschränkt (`portfolio_manager`, `value_stream_owner`, `vmo`, `rte`,
  `feature_owner`); im Service zusätzlich auf den konkret zugewiesenen User
  gegengeprüft.

### Ebene 4 — ART / Programm

#### `rte` — Release Train Engineer

- **PI:** `pi.create`, `pi.update`, `pi.start`, `pi.complete`, `pi.delete`,
  `pi_objective.create`, `pi_objective.update`.
- **ART/Team:** `team.update`.
- **Feature:** `feature.create`, `feature.update`, `feature.wsjf.set`,
  `feature.delete`, `feature.review.submit`, `feature.review.decide` (Feature-QS).
- **Ausführung:** `story.create/update/delete` (art), `task.create/edit` (art),
  `dependency.link/unlink`, `impediment.create/escalate/resolve`.
- Scope: ARTs.
- ART-Lebenszyklus (`art.create/update/delete`) bleibt beim `tenant_admin`.

### Ebene 5 — Feature

#### `feature_owner` — Feature-Verantwortlicher / Product Manager

- `feature.create`, `feature.update`, `feature.wsjf.set`,
  `feature.review.submit`.
- **Ausführung:** `story.create/update` (art), `task.create/edit` (art),
  `dependency.link/unlink`, `impediment.create`.
- **Nicht** berechtigt: `feature.delete`, `feature.review.decide` (das
  entscheidet der RTE — Funktionstrennung), `story.delete`.
- Scope: ARTs.

### Ebene 6 — Team

#### `team_editor` — Scrum Master / Product Owner

- `story.create/update/delete`, `task.create/edit`,
  `pi_objective.create/update`, `dependency.link/unlink` (team),
  `impediment.create/escalate/resolve`.
- Scope: Teams.

### Ebene 7 — Story

#### `story_owner` — Tech Lead

- `story.create/update/delete`, `task.create/edit`, `impediment.create`.
- **Nicht** berechtigt: `pi_objective.*`, `dependency.*`,
  `impediment.escalate/resolve`.

### Ebene 8 — Task

#### `task_owner` — Entwickler

- `task.edit` (own) — nur eigene Tasks.
- `impediment.create`.

### Querschnitt — Lesen

#### `viewer`

- Keine schreibende Funktion — erscheint in keinem Grant.
- Lesezugriff mandantenweit über RLS.

---

## 3 — Abgleich-Notizen

Stand des letzten Abgleichs gegen die Portfolio-Verantwortlichkeiten:

- `value_stream_owner` hat Epic-Rechte erhalten (`epic.create/update`,
  `epic.hypothesis.submit`, value_stream-skopiert) — vorher trug die Rolle nur eine
  einzige Funktion.
- `epic.approve` (Stage Gates) wurde um `vmo` erweitert — das VMO co-governt den
  Epic-Investment-Funnel.
- `impediment.create` wurde um `feature_owner` erweitert — die Feature-Ebene
  konnte zuvor keine Impediments melden.
- Offene Folge-Aufgabe: strikte `value_stream`-Scope-Durchsetzung für
  `epic.update` auf der Service-Ebene (siehe Ebene 2).
