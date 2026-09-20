# Pulse — Funktions-Übersicht & Rollen-Funktions-Matrix

> **Status (Rollen-Vereinfachung):** Autoritativ sind die **8 Rollen** in
> [`src/domain/roles.ts`](../src/domain/roles.ts). `transformation_lead` + `vmo` →
> **`portfolio_manager`**, `team_editor` → **`rte`**. Zeilen unten mit diesen drei
> Rollen (oder den nie implementierten `story_owner`/`task_owner` + `story.*`/`task.*`
> Actions) sind veraltet — maßgeblich sind `roles.ts` + `POLICIES`.

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
- **Admin-Bypass:** **`tenant_admin`** darf jede Funktion **seines** Mandanten;
  das ist direkt in `authorize()` verdrahtet, nicht über Grants. `platform_admin`
  stand dort bis September 2026 daneben — und hatte damit volle Inhalts-Rechte in
  jedem Mandanten, in dem eine Zeile für ihn lag, bis hinein in private Bereiche
  fremder Nutzer. Die Plattform-Rechte laufen seither **nicht** über diese
  Matrix: sie hängen am globalen Kennzeichen `isPlatformAdmin` und werden von
  `requirePlatformAdmin` vor die `/platform`-Flächen gestellt.
- **Scopes:** Ein Grant kann zusätzlich verlangen, dass die Rolle den Scope der
  Ressource trifft — `value_stream`, `art`, `team` oder `own` (eigene Ressource).
  Ein leerer Scope der Rolle bedeutet „alle in Reichweite".
- **Keine Vererbung:** Die Kaskade ist die _Gliederung_ — jede Rolle hat gezielt
  zugeschnittene Rechte, übergeordnete Rollen erben nicht automatisch.
- **Zwei getrennte Achsen für Epics:**
  - **Stage Gates L0–L5** (`epic.gate.request` / `epic.gate.decide`) — der Investment-Funnel.
    Ein Wechsel wird beantragt und von den je Gate hinterlegten Personen abgenommen (ADR-0018).
  - **Freigabe-Workflow** (`approvalPhase`, `epic.hypothesis.*` / `epic.approval.*`
    / `epic.section.signoff`) — die mehrstufige Mehrparteien-Freigabe (siehe unten).
    Beide sind unabhängig. Die alte Ein-Schritt-Epic-QS (`epic.review.*`) wurde
    entfernt, die Feature-QS (`feature.review.*`) 2026-06 ebenfalls — was heute
    „Acceptance" heisst, ist der Acceptance-Criteria-Editor und läuft über
    `feature.update`.

## Rollen

| Rolle                 | Persona (Kurzform)                                                                 |
| --------------------- | ---------------------------------------------------------------------------------- |
| `platform_admin`      | Plattform-Betreiber — betreibt Pulse mandantenübergreifend                         |
| `tenant_admin`        | Mandanten-Administrator — Benutzer, Rollen, Integrationen                          |
| `transformation_lead` | Transformations-Lead (Coach / SPC) — definiert den Zielzustand, steuert den Wandel |
| `portfolio_manager`   | Portfolio-Lead / LPM — Portfolio-Backlog & Wertstrom-Finanzierung                  |
| `value_stream_owner`  | Wertstrom-Verantwortlicher (~Business Owner) — steuert seinen Wertstrom            |
| `epic_owner`          | Epic-Verantwortlicher — formuliert/pflegt Epics, reicht zur QS ein                 |
| `vmo`                 | Value Management Office — Epic-QS & Stage-Gate-Governance                          |
| `rte`                 | Release Train Engineer — ART-Orchestrierung, PI-Planung, Feature-Lieferung         |
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

| Funktion              | Beschreibung                  |
| --------------------- | ----------------------------- |
| `value_stream.create` | Wertstrom anlegen             |
| `epic.delete`         | Epic löschen                  |
| `epic.gate.request`   | Reifegrad-Wechsel beantragen  |
| `epic.gate.decide`    | Als benannte Person abnehmen  |
| `epic.gate.withdraw`  | Eigenen Antrag zurückziehen   |
| `epic.gate.revert`    | Epic zurückstufen (mit Grund) |

### Wertstrom

| Funktion              | Beschreibung         |
| --------------------- | -------------------- |
| `value_stream.update` | Wertstrom bearbeiten |
| `epic.create`         | Epic anlegen         |
| `epic.update`         | Epic bearbeiten      |

### Geld

| Funktion                       | Beschreibung                                                |
| ------------------------------ | ----------------------------------------------------------- |
| `budget.read`                  | Die Geld-Flächen eines Wertstroms oder ARTs überhaupt sehen |
| `budget.manage`                | Den Portfolio-Rahmen und die Zuteilung auf Epics führen     |
| `budget.round.manage`          | Eine Budgeting-Kachel führen (Rahmen, Gruppen, Erfassung)   |
| `budget.round.decide`          | Die Streuzone einer Kachel entscheiden                      |
| `budget.group.contribute`      | In der eigenen Gruppe verteilen und einreichen              |
| `budget.cycle.advance`         | Das Halbjahr weiterschalten                                 |
| `budget_plan.revision.capture` | Den lebenden Plan als Halbjahres-Beleg einfrieren           |
| `art_budget.manage`            | Das Wertstrom-Budget auf seine ARTs herunterführen          |
| `art_budget.distribute`        | Den ART-Rahmen auf die ART-Epics verteilen                  |
| `rtb_item.manage`              | Betriebspositionen pflegen und den Zuspruch aufteilen       |

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

| Funktion                                      | Beschreibung                        |
| --------------------------------------------- | ----------------------------------- |
| `art.create` / `art.update` / `art.delete`    | ART anlegen / bearbeiten / löschen  |
| `pi.create`                                   | Programm-Inkrement anlegen          |
| `pi.update`                                   | PI bearbeiten                       |
| `pi.start`                                    | PI starten                          |
| `pi.complete`                                 | PI abschließen                      |
| `pi.delete`                                   | PI löschen                          |
| `pi_objective.create` / `pi_objective.update` | PI-Ziel anlegen / bearbeiten        |
| `team.create` / `team.update` / `team.delete` | Team anlegen / bearbeiten / löschen |
| `feature.delete`                              | Feature löschen                     |

### Feature

| Funktion           | Beschreibung                    |
| ------------------ | ------------------------------- |
| `feature.create`   | Feature anlegen                 |
| `feature.update`   | Feature bearbeiten              |
| `feature.wsjf.set` | WSJF-Wert eines Features setzen |

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

Impedimente haben **keine eigenen Funktionen**. Sie sind ins vereinte
Issue-Register gewandert (`/issues`, ROAM) und laufen dort vollständig über
`risk.*`. Die früheren `impediment.create/escalate/resolve` waren nie
implementiert und wurden im September 2026 entfernt.

### Risks

| Funktion               | Beschreibung                                        | Träger                                               |
| ---------------------- | --------------------------------------------------- | ---------------------------------------------------- |
| `risk.suggest`         | Risiko vorschlagen                                  | alle (inkl. `viewer`)                                |
| `risk.document`        | Risiko dokumentieren (Register aufnehmen)           | `epic_owner` (VS-scoped), `portfolio_manager`, `rte` |
| `risk.review`          | Vorschlag annehmen / ablehnen                       | `epic_owner` (VS-scoped), `portfolio_manager`        |
| `risk.update`          | Risiko bearbeiten / Owner / Maßnahme / Neubewertung | `epic_owner` (VS-scoped), `portfolio_manager`, `rte` |
| `risk.roam`            | ROAM-Status setzen                                  | `epic_owner` (VS-scoped), `portfolio_manager`, `rte` |
| `risk.link`            | Risiko mit Epic verknüpfen                          | `epic_owner` (VS-scoped), `portfolio_manager`, `rte` |
| `risk.delete`          | Risiko löschen (soft)                               | `portfolio_manager`                                  |
| `risk.settings.manage` | Nummernpräfix verwalten                             | `tenant_admin`, `portfolio_manager`                  |

Die VS-Scope-Prüfung für `risk.document`/`risk.review` läuft am Service-Seam
(ADR-0002) über die value_streams der verknüpften Epics; unverknüpfte Risiken
sind Manager-only.

---

## 2 — Rollen-Funktions-Matrix (kaskadiert nach Ebenen)

Pro Rolle die **vollständige** Liste ihrer Funktionen, inklusive Funktionen
unterer Ebenen. `(art)` / `(team)` / `(value_stream)` / `(own)` kennzeichnet
einen Scope.

### Ebene 0 — Governance

#### `platform_admin` — Plattform-Betreiber

- **Keine** Funktion dieser Matrix. Die Rolle ist kein Mandanten-Recht, sondern
  ein globales Kennzeichen: sie öffnet die `/platform`-Flächen (Mandanten
  anlegen, Module setzen, Lebenszyklus, Plattform-Rolle, Konto-Sperre) und sonst
  nichts. Wer in einem Mandanten arbeiten soll, braucht dort eine Mandanten-Rolle.
- Erscheint in keinem Grant und **seit September 2026 auch in keinem Bypass**
  (`authorize()`); durchgesetzt wird sie von `requirePlatformAdmin` /
  `assertPlatformAdmin` und vom `platformOnly`-Riegel der Mutations-Routen.

#### `tenant_admin` — Mandanten-Administrator

- **Alle** Funktionen innerhalb des eigenen Mandanten (Bypass in `authorize()`).
- Explizit zugeordnete Governance-Funktionen: `tenant.users.manage`,
  `integration.manage`, `admin.audit-log.read`, `admin.users.read`,
  `art.delete`, `team.create/delete`, `epic.delete`, `feature.delete`,
  `story.delete`. (`art.create`/`art.update` liegen seit September 2026 beim
  `portfolio_manager`.)

### Ebene 1 — Portfolio

#### `portfolio_manager` — Portfolio-Lead / LPM

- **Portfolio:** `value_stream.create`, `value_stream.update`, `epic.create`,
  `epic.update`, `epic.delete`, `epic.gate.request`/`epic.gate.decide` (Reifegrad),
  `epic.hypothesis.submit`.
- **ART-Struktur:** `art.create`, `art.update` — ein ART ist Portfolio-Struktur,
  kein Admin-Thema; wer Wertströme anlegt, legt auch die Trains darin an.
  `art.delete` bleibt beim `tenant_admin`.
- **Feature:** `feature.create`, `feature.update`, `feature.wsjf.set`,
  `feature.delete`.
- **Ausführung:** `story.create/update/delete` (art), `task.create/edit` (art),
  `dependency.link/unlink`.
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

### Ebene 2b — Geld

Die Matrix hatte **320 Zeilen und kein einziges „budget"**. Vier Capabilities
hatten damit keinen dokumentierten Eigentümer — und das fiel erst auf, als eine
Spec neu zeichnete, wer welche Zahl sieht (`art-budget-consolidation.md` §1.8).
Dieser Abschnitt ist aus `src/server/auth/policies/index.ts` **abgelesen**, nicht
entworfen; wer ihn ändert, ändert zuerst dort.

Das Geld hat eine Eigenheit, die es sonst nirgends gibt: **zwei Wege führen an
den Rollen vorbei.** Beide sind Benennungen, keine App-Rollen, und beide prüft
der Service, nicht die Capability-Tabelle:

- **Die Finance-Partei des Wertstroms** (`ValueStream.financeApproverId`) darf
  lesen, ARTs beliefern, Positionen pflegen und den Zuspruch aufteilen — ohne
  eine einzige Rolle dafür zu tragen.
- **Der Produkt-Manager einer Solution** (`Solution.productManagerId`) darf aus
  dem ART-Rahmen den Epics **seiner** Solution zuteilen — und nur denen.

#### `portfolio_manager` — Portfolio-Lead / LPM

- `budget.manage`, `budget.round.manage`, `budget.round.decide`,
  `budget.cycle.advance`, `budget_plan.revision.capture` — tenant-weit. Der
  Rahmen und die Kachel gehören ihm.
- `budget.read`, `art_budget.manage`, `art_budget.distribute`,
  `rtb_item.manage` — tenant-weit, also auf jedem Wertstrom.
- Scope: keiner. Wer den Portfolio-Rahmen setzt, sieht das ganze Portfolio.

#### `value_stream_owner` — Wertstrom-Verantwortlicher

- `budget.read` — **tenant-weit**, nicht wertstrom-skopiert. Eine bewusste
  Grosszügigkeit: wer einen Wertstrom finanziert verantwortet, soll die Lage der
  Nachbarn einordnen können.
- `art_budget.manage` (value_stream), `rtb_item.manage` (value_stream) — nur der
  eigene Strom. **Der Scope ist hier tragend**, nicht kosmetisch: ohne ihn wäre
  der Grant vakuos erfüllt und der Verteil-Editor erschiene auf fremden
  Wertströmen.
- `art_budget.distribute` — tenant-weit. Er darf also auch selbst verteilen,
  nicht nur beliefern.

#### `rte` — Release Train Engineer

- `budget.read` (art), `art_budget.distribute` (art) — **sein** ART.
- Er sieht seine Last und seinen Rahmen und verteilt ihn auf seine Epics. Was er
  **nicht** darf: den Rahmen setzen — der wird _für_ den ART entschieden, nicht
  _von_ ihm.
- Auf der Geldfläche seines Wertstroms sieht er deshalb seine ART-Zeile mit
  Zahlen, die übrigen nur als Name, und die Summenzeilen des Stroms gar nicht.

#### `tenant_admin` — Mandanten-Administrator

- Trägt jede Budget-Capability tenant-weit. Betreiber-Rolle, keine fachliche.

#### Alle Rollen

- `budget.group.contribute` — ein **grober Vorfilter**. Die maßgebliche Prüfung
  ist die Gruppen-Zugehörigkeit im Service (`BudgetGroupMember`), und einreichen
  darf nur der Sprecher. Eine Portfolio-Rolle entscheidet hier nichts.

#### Wer gar nichts sieht

`epic_owner`, `feature_owner`, `team_editor`, `story_owner`, `task_owner`,
`vmo`, `transformation_lead` tragen **keine** Budget-Capability. Sie sehen Geld
nur dort, wo es an ihrem Gegenstand hängt — der Betrag am eigenen Epic —, nicht
als Fläche. Der Epic Owner erfährt über die Kachel, was ihm zugeteilt wurde;
den Rahmen, aus dem es kam, sieht er nicht.

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
- `epic.gate.request`/`epic.gate.decide` — beantragt bzw. nimmt Reifegrad-Wechsel ab (zusammen mit
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
  `feature.delete`.
- **Ausführung:** `story.create/update/delete` (art), `task.create/edit` (art),
  `dependency.link/unlink`.
- Scope: ARTs.
- ART-Stammsatz: `art.create`/`art.update` liegen beim `portfolio_manager`
  (seit September 2026), `art.delete` beim `tenant_admin`. Der RTE orchestriert
  den Train, er legt ihn nicht an.

### Ebene 5 — Feature

#### `feature_owner` — Feature-Verantwortlicher / Product Manager

- `feature.create`, `feature.update`, `feature.wsjf.set`.
- **Ausführung:** `story.create/update` (art), `task.create/edit` (art),
  `dependency.link/unlink`.
- **Nicht** berechtigt: `feature.delete` (das
  entscheidet der RTE — Funktionstrennung), `story.delete`.
- Scope: ARTs.

### Ebene 6 — Team

#### `team_editor` — Scrum Master / Product Owner

- `story.create/update/delete`, `task.create/edit`,
  `pi_objective.create/update`, `dependency.link/unlink` (team).
- Scope: Teams.

### Ebene 7 — Story

#### `story_owner` — Tech Lead

- `story.create/update/delete`, `task.create/edit`.
- **Nicht** berechtigt: `pi_objective.*`, `dependency.*`.

### Ebene 8 — Task

#### `task_owner` — Entwickler

- `task.edit` (own) — nur eigene Tasks.

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
  Epic-Investment-Funnel. _(Historisch: `epic.approve` ist seit ADR-0018 zurückgezogen; der
  Investment-Funnel läuft über `epic.gate._` plus namentlich benannte Abnehmer.)\*
- Offene Folge-Aufgabe: strikte `value_stream`-Scope-Durchsetzung für
  `epic.update` auf der Service-Ebene (siehe Ebene 2).
