# Pulse · Setup-Guide (V0.1)

Diese Doku fuehrt einen neuen Kunden in **sieben Milestones** durch die Initial-Befuellung von Pulse. Hauptleser ist der **Tenant-Admin**; ab Milestone 1 sind weitere Rollen (Transformation Lead, RTE, VMO, Epic Owner, Controller, Team Lead) eingebunden. **Reihenfolge der Milestones ist fix**, das Tempo bestimmt der Kunde. Pro Milestone steht, was am Ende fertig ist, wer es macht und wo es in der App passiert.

---

## M1 · Tenant Live

**Outcome:** Der Tenant existiert, der Admin kann sich einloggen und alle anderen Beitragenden sind als User mit den passenden Rollen aktiv.
**Wer:** Tenant-Admin
**Wo:** `/admin/users` (User-Verwaltung) · `/admin/roles` (Rollen + Capabilities) · `/ziele` → „Target-Modell" (Practices)
**Checkliste:**

- [ ] Tenant angelegt + erster Admin-Login funktioniert
- [ ] User pro Rolle (Transformation Lead, RTE, VMO, Epic Owner, Controller, Team Lead) eingeladen und aktiv
- [ ] Target Operating Model konfiguriert (Stage Gates an/aus, Multi-Party-Approval an/aus)

---

## M2 · Struktur fertig

**Outcome:** Die Organisation ist im Tool abgebildet — Value Streams, ARTs und Teams existieren.
**Wer:** Transformation Lead (Lead), RTE (fuer ART-Wizard)
**Wo:** `/structure` (Master-Detail) · `/transformation/art-starten` (ART-Wizard)
**Checkliste:**

- [ ] Mindestens ein Value Stream angelegt
- [ ] ART(s) ueber den Wizard `/transformation/art-starten` gestartet und an eine Timeline gebunden
- [ ] Teams unter ARTs angelegt (Name + Headcount + Velocity + SM/PO)

---

## M3 · Cadence laeuft

**Outcome:** Es gibt eine wiederkehrende PI-Kadenz; die naechsten PIs sind im Kalender.
**Wer:** RTE
**Wo:** `/timelines` (Timeline-Verwaltung mit PI-Standard und Kalender)
**Checkliste:**

- [ ] PI-Standard angelegt (Anchor-Datum + Cadence-Wochen + PI-Count)
- [ ] Timeline angelegt, ARTs sind subscribiert
- [ ] PIs via „Standard anwenden…"-Preview-Dialog generiert

---

## M4 · Strategy & Funnel

**Outcome:** Strategische Themen sind definiert, der Funnel ist mit den ersten Epic-Ideen befuellt.
**Wer:** Transformation Lead (Themes), VMO / Portfolio Manager (erste Epics)
**Wo:** `/ziele` (Themes + OKRs) · `/portfolio/epics` („+ Neues Epic")
**Checkliste:**

- [ ] 3–10 Strategic Themes mit Outcome-Beschreibung angelegt
- [ ] KPIs / OKRs an Themes verknuepft
- [ ] 5–10 Epics im L0-Funnel mit Working-Title + Value-Stream-Zuordnung

---

## M5 · Portfolio gepflegt

**Outcome:** Die Top-Funnel-Epics haben Owner, Hypothese, Business Case — und sind freigegeben (Sub-Stage L2.2).
**Wer:** VMO / Portfolio Manager (Approval-Workflow), Epic Owner pro Epic (Inhalt)
**Wo:** `/portfolio/epics/<id>` (Tabs: Hypothese, Business Case, KPIs, Freigaben)
**Checkliste:**

- [ ] Owner pro Epic gesetzt (Epic landet automatisch im Kanban-Bucket „Hypothese erstellen")
- [ ] Hypothese + Business Case + KPIs ausgefuellt
- [ ] Business Case voll freigegeben → Epic auf Sub-Stage **L2.2 „BC freigegeben"**

---

## M6 · Lean Budget aktiv

**Outcome:** Das Investitions-Budget steht, Top-Prio-Epics sind finanziert — sie wandern automatisch in „Portfolio Backlog" auf Stage Gate L3.
**Wer:** Controller (Pool + Allokation), VMO (Priorisierung)
**Wo:** `/controlling/budget-plan` (Pool + Perioden) · `/portfolio/budgeting` (Participatory Budgeting)
**Checkliste:**

- [ ] Budget-Pool + Perioden konfiguriert
- [ ] Allokation Σ > 0 pro Top-Epic auf L2.2 gesetzt
- [ ] Epics flippen automatisch auf Stage Gate **L3 „Budget alloziert"**

---

## M7 · First PI startet

**Outcome:** Mindestens das erste PI hat geplanten Inhalt — Features sind den Teams zugewiesen, mind. eines ist gestartet, das Epic ist auf L4 „Implementing".
**Wer:** RTE (Orchestrierung), Team Leads (Features), Epic Owner (Scope-Check)
**Wo:** `/portfolio/epics/<id>` Breakdown-Tab („+ Feature") · `/pi/<piId>` (Program Board) · `/umsetzung` (Cockpit-Board)
**Checkliste:**

- [ ] Features pro Epic angelegt und Team zugewiesen
- [ ] Features einem PI zugeordnet
- [ ] Erstes Feature in Implementation gestartet (`status = in_progress`) → Epic geht automatisch auf L4

---

## Gesamt-Checkliste

```
M1 · Tenant Live
[ ] Tenant + Admin-Login
[ ] User pro Rolle aktiv
[ ] Target Operating Model konfiguriert

M2 · Struktur fertig
[ ] Value Stream angelegt
[ ] ARTs an Timeline gebunden
[ ] Teams angelegt

M3 · Cadence laeuft
[ ] PI-Standard angelegt
[ ] Timeline + ART-Subscription
[ ] PIs generiert

M4 · Strategy & Funnel
[ ] Strategic Themes
[ ] KPIs/OKRs verknuepft
[ ] Erste Funnel-Epics

M5 · Portfolio gepflegt
[ ] Owner gesetzt
[ ] Hypothese + BC + KPIs
[ ] BC freigegeben (L2.2)

M6 · Lean Budget aktiv
[ ] Budget-Pool + Perioden
[ ] Allokation Σ > 0
[ ] Epics auf L3

M7 · First PI startet
[ ] Features pro Epic
[ ] Features in PI
[ ] Erstes Feature gestartet
```
