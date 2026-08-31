# Budgeting-Modul — Analyse und Refactor-Spec

> Status: **Spec / zur Umsetzung** · Erstellt 2026-08-31 · Löst
> [budgeting-ui-refactor.md](budgeting-ui-refactor.md) ab.
>
> Im Modul liegen **zwei Generationen übereinander**. Die €-Board-Generation
> (Tenant-Topf, `BudgetAllocation`, manueller `ArtBudget`, Prozessleiste) hat
> ihre Bedien-Oberflächen verloren — `/budgeting/board`, `/budgeting/round` und
> `/budgeting/rounds` sind Redirects —, ihre **Lese**-Flächen sind geblieben und
> berichten weiter über Zahlen, die niemand mehr pflegen kann. Die
> Kachel-Generation (`BudgetRound` + Kandidaten + Gruppen + `finalAmount`) trägt
> den echten Ablauf, reicht aber nicht bis ins Endartefakt. **Ziel: eine
> Wahrheit (die Kachel), ein Ort für den Ablauf (die Kachel), zwei
> Nav-Einträge.** Wireframes:
> <https://claude.ai/code/artifact/cb1f7a23-ee1c-47a2-9cf9-25fdecedcb79>

---

## 1 Analyse

### 1.1 Toter Code — 2.072 Zeilen

Vom Routen-Graph aus **nicht erreichbar** (transitiv über alle `page.tsx`
geprüft, siehe Verifikation in §7):

|          Zeilen | Datei                                                                                             |
| --------------: | ------------------------------------------------------------------------------------------------- |
|             443 | `features/components/round/round-workspace.tsx`                                                   |
|             407 | `features/components/round/round-setup.tsx`                                                       |
| 152 · 149 · 112 | `round-capture.tsx` · `round-report-out.tsx` · `round-decisions.tsx`                              |
|   117 · 83 · 78 | `cycle-controls.tsx` · `candidates-section.tsx` · `level-pool.tsx`                                |
|             265 | `features/components/board/*` (`epic-row`, `pool-row`, `value-stream-chart[-lazy]`, `board-cell`) |
|       128 · 135 | `server/views/budgeting-board.ts` · `server/views/decisions-view.ts`                              |

Daran hängen **7 von 12** Server-Actions in `features/actions/round.ts`, die
ausschließlich von diesen Komponenten aufgerufen werden: `createRoundAction`,
`updateRoundFrameAction`, `transitionRoundAction`, `setMemberReadAction`,
`setGroupAllocationAction`, `recordDecisionAction`, `setReportOutAction`. Live
sind nur die fünf Gruppen-Actions (aus `period-setup-tab.tsx`).

### 1.2 Die alte Welt ist unpflegbar geworden — wird aber angezeigt

`saveBudgetPool` und `saveBudgetAllocation` werden **nur noch aus totem Code**
aufgerufen. `Tenant.budgetPoolByPeriod` ist über die Oberfläche nicht mehr
änderbar. `/budgeting` weist trotzdem „Verbleibend im Topf" aus — Tenant-Topf
minus Zuteilungen. Gemessen (2026-08-31, lesend gegen die Produktions-DB):

| Mandant         |  Tenant-Topf | Σ Zuteilungen |  „Verbleibend" | Kachel-Töpfe       |
| --------------- | -----------: | ------------: | -------------: | ------------------ |
| Pulse Demo Corp |  4.400.000 € |   4.700.000 € | **−300.000 €** | 3 × 2.000.000 €    |
| Large Test Corp | 20.000.000 € |   8.800.000 € |   11.200.000 € | 6 Kacheln, 1–2 Mio |
| Test Demo       |     72.000 € |      60.000 € |       12.000 € | 1 × 42.000 €       |

Die Zahl „−300.000 € · Überallokation" entsteht aus zwei Töpfen, die nichts
miteinander zu tun haben: der Tenant-Topf wird nicht mehr gepflegt, die
Zuteilungen schreibt inzwischen die Kachel-Finalisierung.

`transitionRound` — mit Topf-Vererbung (F-C2), der „finanziert =
budgetiert"-Naht (F-B5) und dem automatischen Protokoll (F-C3) — hängt an
`transitionRoundAction` und ist damit unerreichbar. Der lebende Weg läuft über
`finalize-service.ts` und übernimmt davon **nur** die
`BudgetAllocation`-Naht.

### 1.3 Der Snapshot stammt aus der anderen Welt

`captureBudgetPlanRevision` liest Topf und Zuteilungen aus `getBudgetingBoard`
(alt) und die ART-Zahlen aus `ArtBudget.byPeriod` — dem handgepflegten Feld auf
`/value-streams/[id]`. **Das Endartefakt des Prozesses stammt aus einer anderen
Quelle als der Prozess.** Parallel leitet `server/views/period-valuestreams.ts`
die VS-/ART-Budgets aus der finalen Verteilung ab: zwei ART-Wahrheiten (6
manuelle `ArtBudget`-Zeilen gegen die abgeleitete Sicht).

### 1.4 Die Prozessleiste zeigt den falschen Prozess und führt ins Leere

`buildBudgetProcessRail` beschreibt sechs Schritte — _Einreichung · Rahmen &
Gruppen · Erfassung & Zonen · Entscheidung · €/ART-Detail · Protokoll_. „Zonen"
und „€/ART-Detail" gibt es als Fläche nicht mehr. Alle Links zeigen auf
`/budgeting/rounds`, `/budgeting/round` oder `/budgeting`; die ersten beiden
sind Redirects auf die Gallery. **Wer auf Schritt 4 klickt, landet auf
Schritt 0.**

Dazu unterstellt `activeBudgetCycle` _einen_ aktiven Zyklus, während das
Kachel-Modell mehrere koexistieren lässt (Identität = `id`).
`getRoundForCycle` nimmt „zuletzt angelegt" — das Runden-Widget zeigt womöglich
eine andere Kachel als die, an der gearbeitet wird.

### 1.5 Das Hin und Her

Vier Nav-Einträge für einen Ablauf, der in _einer_ Kachel lebt.

- **Portfolio-Manager, ganzer Zyklus:** Zeiträume → Kachel anlegen → Setup
  (Rahmen · Ballot · Beteiligte · Gruppen — vier gleichrangige Blöcke mit je
  eigenem Speichern-Knopf, „Runde starten" mitten im ersten) → Reiter
  _Verteilungs-Übersicht_ → schließen → finalisieren → Reiter _Value Streams &
  ARTs_ → **Nav-Wechsel** zu Controlling → Snapshot → **Nav-Wechsel** zu
  Budget-Plan. Macht **3 Nav-Wechsel, 3 Reiter-Wechsel, 1 Routen-Sprung**.
- **Gruppenmitglied:** My-Tasks → eigene Verteil-Route → verteilen → „Zur
  Kachel" → landet auf **Setup**, nicht auf der Verteilung → Reiter wechseln,
  um die eigene Abgabe zu sehen.
- **Finance:** Finalisieren in der Kachel, ART-Budget auf `/value-streams/[id]`,
  Run the Business auf `/budgeting/run-the-business`. Drei Seiten für eine Rolle.

Sieben Rechte (`budget.round.manage`, `budget.group.contribute`,
`budget.manage`, `rtb_item.manage`, `art_budget.manage`,
`budget_plan.revision.capture`, `target.manage`) verteilen sich über vier
Seiten, ohne dass irgendwo steht, wer wann dran ist.

### 1.6 Fremdkörper

Die **Portfolio-Guardrails** (ein Work-Thema, `target.manage`) werden auf der
Controlling-Seite editiert — im Vorgänger-Doc als „P5" benannt und nie
umgesetzt.

---

## 2 Zielbild

### 2.1 Eine Wahrheit: die Kachel

| Größe             | heute                                                                    | künftig                                                     |
| ----------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------- |
| Topf              | `Tenant.budgetPoolByPeriod` (unpflegbar) **und** `BudgetRound.poolTotal` | **nur** `BudgetRound.poolTotal`                             |
| „aktiver Zyklus"  | `Tenant.activeBudgetCycle`                                               | die laufende Kachel (`status = running`), sonst die jüngste |
| Zuteilung je Epic | frei editierbar **und** aus der Finalisierung                            | **nur** abgeleitet aus der Finalisierung                    |
| ART-Budget        | `ArtBudget` (manuell) **und** abgeleitet                                 | **nur** abgeleitet (`period-valuestreams`)                  |
| Snapshot-Quelle   | `getBudgetingBoard` + `ArtBudget`                                        | die Kachel                                                  |

`BudgetAllocation` **bleibt**: der L3.1 → L3.2-Gate liest `budgetAllocationSum`
(`modules/work/domain/gate-readiness.ts`), und `finalize-service.ts` schreibt
es. Diese Brücke ist intakt und wird die **einzige** Schreibstelle.

### 2.2 Navigation: Arbeitsfläche + Archiv

```
Budgeting
├── Budgeting-Zeiträume   /budgeting/periods       ← der ganze Ablauf
└── Budget-Plan           /budgeting/budget-plan   ← eingefrorene Stände
```

`/budgeting` wird Redirect auf `/budgeting/periods`.
`/budgeting/run-the-business` **bleibt als Route** (Deep-Link aus Ballot,
Wertstrom und Solution), verlässt aber die Nav.

### 2.3 Die Kachel trägt den Ablauf

`EntityDetailShell` wie bisher, mit zwei Änderungen.

**`subHeader` = Phasen-Leiste.** Sechs Phasen mit Zustand und
**funktionierendem** Deep-Link auf den Reiter, der den Schritt trägt:

| Phase                | erledigt wenn                        | Reiter     |
| -------------------- | ------------------------------------ | ---------- |
| Rahmen               | `poolTotal > 0` und Zeitraum gesetzt | Setup      |
| Ballot               | ≥ 1 Kandidat                         | Setup      |
| Beteiligte & Gruppen | ≥ 1 Gruppe mit ≥ 1 Mitglied          | Setup      |
| Verteilen            | alle Gruppen eingereicht             | Verteilung |
| Finalisieren         | `status = closed`                    | Ergebnis   |
| Protokoll            | Revision dieses Zeitraums erfasst    | Ergebnis   |

Abgeleitet aus dem Kachel-Zustand, nicht aus `activeBudgetCycle`. Ersetzt
`budget-process-rail.ts` vollständig.

**Drei Reiter statt drei Reiter + zwei Fremdseiten:**

- **Setup** _(draft)_ — geordnete Checkliste statt vier gleichrangiger Blöcke:
  Rahmen → Ballot → Beteiligte & Gruppen → **Runde starten am Ende**, mit
  benannter Vorbedingung. Der Ballot zeigt Epic-Kandidaten **und** die aktiven
  Run-the-Business-Positionen mit ihrem Kachel-Ask (`rtbCycleAmount`, siehe
  [participatory-budgeting.md](participatory-budgeting.md)) plus Link zur
  RtB-Pflege.
- **Verteilung** _(running)_ — Gruppen mit Abgabe-Fortschritt, je Gruppe der
  Link auf die Verteil-Route, „Verteilung schließen". Die Verteil-Route kehrt
  **hierher** zurück, nicht auf Setup.
- **Ergebnis** _(decided/closed)_ — Finalisierung, Reserve, die abgeleiteten
  VS-/ART-/RtB-Budgets **und der Snapshot-Knopf**. Das Einfrieren steht neben
  dem Ergebnis, das es einfriert. Darunter „Nächsten Zeitraum starten".

### 2.4 Gallery und Archiv

- **`/budgeting/periods`** bekommt einen Kopf mit den vier Zahlen, die die
  Controlling-Seite sinnvoll beigetragen hat: laufende Kachel · Σ Topf ·
  Abgabe-Fortschritt · letzter Snapshot — alle auf die Kachel bezogen. Die
  Kachel-Karte zeigt ihre **Phase** statt nur ihres Status.
- **`/budgeting/budget-plan[/id]`** bleibt funktional; die Revisionsliste (heute
  doppelt auf `/budgeting` und hier) lebt nur noch hier.

### 2.5 Was das Modul verlässt

- **Portfolio-Guardrails** ziehen zurück ins Portfolio (Work).
- Der **`ArtBudgetEditor`** auf `/value-streams/[id]` weicht der abgeleiteten
  Sicht mit Link auf die Kachel; `saveArtBudget` und `ArtBudget` werden
  stillgelegt.

---

## 3 Reuse-Map

| Baustein                                                                                                        | Rolle künftig                                                             |
| --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `finalize-service.ts`                                                                                           | **Kern.** Einzige Schreibstelle für `finalAmount` und `BudgetAllocation`. |
| `candidate-service.ts`, `ballot.ts`, `rtb-item-service.ts`                                                      | bleiben — Ballot inkl. RtB-Ask.                                           |
| `participant-service.ts`, `round-group-service.ts`, `group-distribution-service.ts`                             | bleiben — Setup und Verteilung.                                           |
| `epic-allocation.ts`                                                                                            | bleibt — die L3.2-Gate-Naht.                                              |
| `views/period-detail.ts`, `distribution-overview.ts`, `group-distribution-view.ts`                              | bleiben, speisen die drei Reiter.                                         |
| `views/period-valuestreams.ts`                                                                                  | bleibt und wird die **einzige** ART-Quelle.                               |
| `views/periods-gallery.ts`                                                                                      | bleibt, um den Gallery-Kopf erweitert.                                    |
| `views/zones-view.ts`                                                                                           | bleibt — vom Protokoll in `budget-plan-revision.ts` gelesen.              |
| `budget-plan-revision.ts` (Service + View)                                                                      | bleibt, Quelle wechselt auf die Kachel (Stufe 5).                         |
| `views/budget-process-rail.ts`                                                                                  | **ersetzt** durch den Kachel-Phasen-Builder (Stufe 2).                    |
| `views/controlling-overview.ts`, `views/round-widget.ts`, `views/round-view.ts`                                 | entfallen mit ihren Flächen (Stufe 4).                                    |
| `views/budgeting-board.ts`, `views/decisions-view.ts`                                                           | tot, raus (Stufe 1).                                                      |
| `services/budgeting.ts` (`saveBudgetPool`/`saveBudgetAllocation`/`getBudgetingBoard`), `services/art-budget.ts` | entfallen (Stufe 1 bzw. 5).                                               |
| `services/round-service.ts`                                                                                     | bleibt ohne `transitionRound`/`createRound`/`updateRoundFrame`.           |

---

## 4 Requirements (testbar)

- **REQ-B-1** — Genau **zwei** Budgeting-Nav-Einträge; `/budgeting` leitet auf
  `/budgeting/periods` um. Bestehende Deep-Links bleiben gültig.
- **REQ-B-2** — Der komplette Ablauf eines Zeitraums ist **ohne Nav-Wechsel**
  bedienbar: Anlegen, Setup, Starten, Verteilen (eigene Route mit Rückweg auf
  _Verteilung_), Finalisieren, Snapshot.
- **REQ-B-3** — Die Phasen-Leiste leitet ihren Zustand allein aus der Kachel ab
  und verlinkt auf den Reiter, der den Schritt trägt. Kein Link zeigt auf einen
  Redirect.
- **REQ-B-4** — Kein Topf außerhalb der Kachel. `Tenant.budgetPoolByPeriod` und
  `Tenant.activeBudgetCycle` sind entfernt; alle Leser (u. a.
  `modules/work/server/views/portfolio-overview.ts`) beziehen ihre Zahlen aus
  den Kacheln.
- **REQ-B-5** — `BudgetAllocation` wird ausschließlich von der Finalisierung
  geschrieben; `budgetAllocationSum > 0` bleibt für jedes heute finanzierte Epic
  erfüllt.
- **REQ-B-6** — ART-Budgets sind ausschließlich abgeleitet; keine manuelle
  Eingabe mehr, und `/value-streams/[id]` zeigt dieselben Zahlen wie die Kachel.
- **REQ-B-7** — `captureBudgetPlanRevision` liest die Kachel; Topf und
  ART-Zahlen einer neuen Revision stimmen mit dem Reiter _Ergebnis_ überein.
- **REQ-B-8** — Die in §1.1 gelisteten 2.072 Zeilen sind entfernt; die
  Erreichbarkeitsprüfung findet keinen unerreichbaren Rest im Modul.
- **REQ-B-9** — Rechte unverändert. Jede Phase nennt, wer sie ausführt, und ist
  ohne das Recht read-only statt unsichtbar.
- **REQ-B-10** — Die Portfolio-Guardrails sind aus dem Budgeting-Modul
  verschwunden und im Portfolio erreichbar.

---

## 5 Umsetzung in Stufen

Jede Stufe ist für sich lauffähig und einzeln abnehmbar.

1. **Aufräumen** — die 2.072 toten Zeilen raus, samt der sieben Actions, die nur
   von ihnen benutzt werden. Rein subtraktiv, keine Verhaltensänderung.
2. **Phasen-Leiste** — `budget-process-rail.ts` durch einen Builder ersetzen,
   der aus der Kachel ableitet; in den `subHeader` der Kachel. Die Orientierung
   stimmt, bevor irgendetwas umzieht.
3. **Kachel-Reiter neu schneiden** — Setup als geordnete Checkliste, Verteilung
   als eigener Reiter, Ergebnis mit Snapshot-Knopf; Rückweg der Verteil-Route
   korrigieren.
4. **Nav verdichten** — Gallery-Kopf, `/budgeting` als Redirect, Guardrails
   zurück ins Portfolio, RtB aus der Nav.
5. **Eine Wahrheit** — Snapshot auf die Kachel umstellen, `ArtBudget` und
   Tenant-Topf stilllegen, Leser umhängen, Bestandsdaten migrieren.

Stufe 5 ist die einzige mit Datenmodell-Änderung, braucht eine eigene Abnahme
und ein Migrations-Skript nach dem Muster von
`prisma/scripts/2026-08-31-unify-run-the-business.ts`. Betroffener Bestand: 9
Revisionen und 6 `ArtBudget`-Zeilen in Large Test Corp, 2 und 6 in Pulse Demo
Corp, 1 und 1 in Test Demo.

---

## 6 Bewusster Verzicht

- **Die freie €/ART-Feinplanung entfällt ersatzlos.** Finance setzt Beträge nur
  noch über die Finalisierung; ein Nachjustieren je Periode und ART gibt es
  nicht mehr. Erweist sich das im Betrieb als Lücke, ist die Antwort eine
  Korrektur-Runde auf der Kachel — nicht eine zweite Pflegefläche.
- **Ohne Budgeting-Modul** gibt es künftig keine Budgetzahlen mehr an Solution
  und Wertstrom (bereits so entschieden bei der Run-the-Business-Vereinheitlichung).
- **Nicht im Umfang:** Mehrsprachigkeit, Änderungen an der Halbjahres-Rechnung,
  an den Rollen/Capabilities oder an der Drei-Zonen-Auswertung.

---

## 7 Verifikation der Analyse

Die Zahlen sind reproduzierbar:

- **Toter Code:** transitive Erreichbarkeit ab allen `src/app/**/page.tsx` über
  `from "…"`- und `import("…")`-Kanten; alles unter
  `src/modules/budgeting`, was nicht erreicht wird, ist die Liste aus §1.1.
- **Töpfe:** lesende Gegenüberstellung von `Tenant.budgetPoolByPeriod`,
  Σ `BudgetAllocation.allocations` und `BudgetRound.poolTotal` je Mandant.
- **Prozessleiste:** die drei `HREF_*`-Konstanten in `budget-process-rail.ts`
  gegen die Redirect-Routen in `src/app/[locale]/(dashboard)/budgeting/`.

## 8 Referenzen

- [participatory-budgeting.md](participatory-budgeting.md) — Kachel-Modell,
  RtB-Perioden, Rechte.
- [budgeting-module-deepening.md](budgeting-module-deepening.md) — Terminologie,
  REQ-_/F-_-Nummern.
- [budgeting-ui-refactor.md](budgeting-ui-refactor.md) — **abgelöst**; sein
  Zielbild (`/budgeting/round` als die eine Arbeitsfläche) wurde vom
  Kachel-Modell überholt, was einen Teil der heutigen Verwirrung erklärt.
- ADR-0013 (Modul-Layering), ADR-0019, `src/modules/budgeting/README.md`.
