/**
 * Statische Inhalte fuer den Setup-Guide MVP V0.1.
 * Single-Source: spiegelt 1:1 die Datei `docs/setup-guide.md`.
 *
 * V0.1 ist hardcoded auf Deutsch, kein i18n im Page-Body — nur die
 * Nav-Entry-Beschriftung ist via `setupGuide`-Key uebersetzt.
 */
export interface MilestoneCheck {
  id: string;
  label: string;
}

export interface MilestoneLink {
  href: string;
  label: string;
}

export interface Milestone {
  id: string;
  name: string;
  outcome: string;
  who: string;
  where: readonly MilestoneLink[];
  checks: readonly MilestoneCheck[];
}

export const MILESTONES: readonly Milestone[] = [
  {
    id: "m1",
    name: "M1 · Tenant Live",
    outcome: "Tenant existiert, Admin kann sich einloggen, alle Beitragenden sind als User aktiv.",
    who: "Tenant-Admin",
    where: [
      { href: "/admin/users", label: "User-Verwaltung" },
      { href: "/admin/roles", label: "Rollen & Capabilities" },
      { href: "/ziele", label: "Target-Modell" },
    ],
    checks: [
      { id: "m1-1", label: "Tenant + Admin-Login funktioniert" },
      { id: "m1-2", label: "User pro Rolle eingeladen und aktiv" },
      { id: "m1-3", label: "Target Operating Model konfiguriert" },
    ],
  },
  {
    id: "m2",
    name: "M2 · Struktur fertig",
    outcome: "Die Organisation ist im Tool abgebildet — Value Streams, ARTs und Teams existieren.",
    who: "Transformation Lead, RTE",
    where: [
      { href: "/structure", label: "Strukturbaum" },
      { href: "/transformation/art-starten", label: "ART-Wizard" },
    ],
    checks: [
      { id: "m2-1", label: "Mindestens ein Value Stream angelegt" },
      { id: "m2-2", label: "ART(s) ueber den Wizard an eine Timeline gebunden" },
      { id: "m2-3", label: "Teams unter ARTs angelegt" },
    ],
  },
  {
    id: "m3",
    name: "M3 · Cadence laeuft",
    outcome: "Eine wiederkehrende PI-Kadenz ist etabliert, die naechsten PIs sind im Kalender.",
    who: "RTE",
    where: [{ href: "/timelines", label: "Timelines" }],
    checks: [
      { id: "m3-1", label: "PI-Standard angelegt (Anchor + Cadence + Count)" },
      { id: "m3-2", label: "Timeline angelegt, ARTs sind subscribiert" },
      { id: "m3-3", label: "PIs via 'Standard anwenden…' generiert" },
    ],
  },
  {
    id: "m4",
    name: "M4 · Strategy & Funnel",
    outcome: "Strategische Themen sind definiert, der Funnel ist mit ersten Epic-Ideen befuellt.",
    who: "Portfolio Manager",
    where: [
      { href: "/ziele", label: "Ziele & Themes" },
      { href: "/portfolio/epics", label: "Portfolio · Epics" },
    ],
    checks: [
      { id: "m4-1", label: "3–10 Strategic Themes mit Outcome angelegt" },
      { id: "m4-2", label: "KPIs / OKRs an Themes verknuepft" },
      { id: "m4-3", label: "5–10 Epics im L0-Funnel mit Value-Stream-Zuordnung" },
    ],
  },
  {
    id: "m5-legacy",
    name: "M5 · Bestand einspielen",
    outcome:
      "Laufende Initiativen aus der Vor-Pulse-Welt sind im Portfolio sichtbar — als L0-Epics angelegt, damit das Reporting den realen Stand kennt.",
    who: "Tenant-Admin, Portfolio Manager",
    where: [{ href: "/portfolio/epics", label: "Portfolio · Epics (+ Neues Epic)" }],
    checks: [
      {
        id: "m5-legacy-1",
        label: "Liste der laufenden Initiativen aus Vor-Pulse-Welt zusammengestellt",
      },
      { id: "m5-legacy-2", label: "Bestands-Epics als L0 angelegt (1 Epic pro Initiative)" },
      {
        id: "m5-legacy-3",
        label: "Owner pro Bestands-Epic gesetzt (→ landet in 'Hypothese erstellen')",
      },
    ],
  },
  {
    id: "m6",
    name: "M6 · Portfolio gepflegt",
    outcome:
      "Top-Funnel-Epics haben Owner, Hypothese und freigegebenen Business Case (Sub-Stage L2.2).",
    who: "Portfolio Manager, Epic Owner",
    where: [{ href: "/portfolio/epics", label: "Portfolio · Epics" }],
    checks: [
      { id: "m6-1", label: "Owner pro Epic gesetzt" },
      { id: "m6-2", label: "Hypothese + Business Case + KPIs ausgefuellt" },
      { id: "m6-3", label: "Business Case voll freigegeben (L2.2)" },
    ],
  },
  {
    id: "m7",
    name: "M7 · Lean Budget aktiv",
    outcome:
      "Top-Prio-Epics sind finanziert und wandern automatisch auf Stage Gate L3 'Budget alloziert'.",
    who: "Controller, Portfolio Manager",
    where: [
      { href: "/controlling/budget-plan", label: "Budget-Plan (Pool + Perioden)" },
      { href: "/portfolio/budgeting", label: "Participatory Budgeting" },
    ],
    checks: [
      { id: "m7-1", label: "Budget-Pool + Perioden konfiguriert" },
      { id: "m7-2", label: "Allokation Σ > 0 pro Top-Epic gesetzt" },
      { id: "m7-3", label: "Epics flippen automatisch auf L3" },
    ],
  },
  {
    id: "m8",
    name: "M8 · First PI startet",
    outcome:
      "Das erste PI hat geplanten Inhalt — Features sind Teams zugewiesen, mind. eines gestartet, Epic auf L4.",
    who: "RTE, Team Leads, Epic Owner",
    where: [
      { href: "/portfolio/epics", label: "Portfolio · Epics (Deliverables-Tab)" },
      { href: "/umsetzung", label: "Umsetzungs-Cockpit" },
    ],
    checks: [
      { id: "m8-1", label: "Features pro Epic angelegt und Team zugewiesen" },
      { id: "m8-2", label: "Features einem PI zugeordnet" },
      { id: "m8-3", label: "Erstes Feature in Implementation gestartet (Epic → L4)" },
    ],
  },
];

export const TOTAL_CHECKS = MILESTONES.reduce((sum, m) => sum + m.checks.length, 0);
