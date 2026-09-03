import {
  LayoutDashboard,
  Layers,
  Boxes,
  CalendarDays,
  Network,
  Goal,
  Map,
  LineChart,
  LayoutGrid,
  GitBranch,
  Route,
  BarChart2,
  Trophy,
  ShieldCheck,
  Plug,
  ClipboardCheck,
  ClipboardList,
  Inbox,
  ListTodo,
  Compass,
  Hammer,
  Wrench,
  MoreHorizontal,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react";
import type { Practice } from "@/modules/core/kernel/domain/operating-model";
import type { Action } from "@/server/auth/policies";

/**
 * The sidebar navigation, with per-item gating metadata. Lives in a shared
 * (non-client) module so the server layout can compute which items a user may
 * see — by the tenant's target operating model (`practice`) and the principal's
 * capabilities (`capability`) — and the client sidebar can render them.
 *
 * Ordering follows the IA-Rework vom 2026-06-06: persönliche Inboxen ganz oben,
 * Goals als Strategie-Layer, Portfolio / Implementation als Lieferungs-Lensen,
 * Risks & Dependencies als horizontale Domänen, Setup & Controlling als
 * Verwaltungs-Layer, Administration und alles Übrige zuletzt.
 */
export interface NavItem {
  href: string;
  labelKey: string;
  icon: LucideIcon;
  exact?: boolean;
  /** Hidden unless this practice is part of the active target operating model. */
  practice?: Practice;
  /** Hidden unless the principal holds this capability. */
  capability?: Action;
}

export interface NavGroup {
  labelKey: string;
  items: NavItem[];
  /** Default-Page, zu der ein Click auf den Top-Nav-Trigger navigiert.
   *  Wenn nicht gesetzt, faellt es auf das erste sichtbare Item zurueck. */
  defaultHref?: string;
}

export const NAV_GROUPS: NavGroup[] = [
  {
    // „Meine Freigaben" ist in „Meine Tasks" aufgegangen: beide Listen liegen jetzt
    // gestapelt auf /my-tasks. Ein-Item-Gruppe → rendert als einfacher Top-Level-
    // Link ohne Dropdown. /my-approvals bleibt als Redirect auf /my-tasks.
    labelKey: "myTasks",
    defaultHref: "/my-tasks",
    items: [{ href: "/my-tasks", labelKey: "myTasks", icon: ListTodo }],
  },
  {
    labelKey: "goals",
    defaultHref: "/ziele",
    items: [
      // Übersicht + Strategie-Pflege sind zusammengelegt — eine Ziele-Surface
      // (Edit-Affordances Capability-gesteuert via `target.manage`).
      { href: "/ziele", labelKey: "goalOverview", icon: Goal, exact: true },
    ],
  },
  {
    // Struktur: die Organisation hinter dem Portfolio — Wertströme, ARTs,
    // Solutions, PI-Kadenz. Steht **vor** Portfolio, weil sie dessen Grundlage
    // ist: erst die Organisation, dann was sie tut. Bis 2026-09 hing sie unter
    // „Setup" zwischen Leitfaden und Timelines, was ihrer gewachsenen Bedeutung
    // nicht mehr entsprach.
    //
    // Solutions und Timelines gehören zu Work bzw. Drumbeat — sie werden vom
    // Route-Guard über die Unterpfad-Ausnahmen in `moduleForPath` ausgeblendet,
    // nicht über eine Practice.
    labelKey: "structure",
    defaultHref: "/structure",
    items: [
      { href: "/structure", labelKey: "organisation", icon: Network, exact: true },
      { href: "/structure/solutions", labelKey: "solutions", icon: Boxes },
      { href: "/structure/timelines", labelKey: "timelines", icon: CalendarDays },
    ],
  },
  {
    labelKey: "portfolio",
    defaultHref: "/portfolio",
    items: [
      {
        href: "/portfolio",
        labelKey: "overview",
        icon: LayoutDashboard,
        exact: true,
        practice: "portfolioLevel",
      },
      { href: "/portfolio/epics", labelKey: "epics", icon: Layers, practice: "portfolioLevel" },
      {
        href: "/portfolio/dashboard",
        labelKey: "portfolioDashboard",
        icon: LineChart,
        practice: "portfolioLevel",
      },
      {
        href: "/portfolio/guardrails",
        labelKey: "portfolioGuardrails",
        icon: ShieldCheck,
        practice: "portfolioLevel",
      },
      {
        href: "/portfolio/review",
        labelKey: "portfolioReview",
        icon: BarChart2,
        practice: "portfolioLevel",
      },
    ],
  },
  {
    labelKey: "implementation",
    defaultHref: "/umsetzung",
    items: [
      {
        // Umsetzungs-Hub — Konsolidierungs-Surface (Roadmap-P0). Bestands-
        // Routen (Features-Übersicht, PI-Planung, RTE, Impediments,
        // Dependencies) wandern in spaeteren Phasen unter diesen Hub und
        // werden danach aus der Nav entfernt.
        href: "/umsetzung",
        labelKey: "umsetzungHub",
        icon: Compass,
        practice: "programLevel",
      },
      {
        // Cross-VS/ART Features-Liste — PR 2 der IA-Rework Suite.
        href: "/implementation/features",
        labelKey: "featuresOverview",
        icon: Hammer,
        practice: "programLevel",
      },
      // PI-Planning, Impediments und Dependencies sind seit Roadmap-P2.B/C
      // in den PI-Workspace eingezogen (Tabs Plan, Impediments, Dependencies).
      // Die Routen `/pi-planning`, `/impediments`, `/dependencies` bleiben
      // als Deep-Link-Targets erreichbar; aus dem Nav sind sie raus.
    ],
  },
  {
    // Issues (Risks + Impediments vereint) als horizontale Domäne. Single-Item-
    // Gruppe → rendert als eigenständiger Top-Level-Link (wie „Ziele"); via
    // moduleAllowed automatisch ausgeblendet, wenn das Risks-Modul aus ist.
    labelKey: "issues",
    defaultHref: "/issues",
    items: [{ href: "/issues", labelKey: "issues", icon: ShieldAlert, exact: true }],
  },
  {
    // Budgeting: **eine** Arbeitsfläche (die Kachel trägt den ganzen Ablauf) und
    // **ein** Archiv. Die Controlling-Übersicht ist in Gallery und Kachel
    // aufgegangen; Run the Business lebt in der Ballot-Phase und ist von
    // Wertstrom und Solution aus erreichbar. Via moduleAllowed ausgeblendet,
    // wenn das Budgeting-Modul aus ist.
    labelKey: "budgeting",
    defaultHref: "/budgeting/periods",
    items: [
      {
        // Kachel-Gallery der Budgeting-Zeiträume — die Arbeitsfläche.
        href: "/budgeting/periods",
        labelKey: "budgetPeriods",
        icon: LayoutGrid,
        capability: "budget.round.manage",
      },
      {
        href: "/budgeting/budget-plan",
        labelKey: "budgetPlan",
        icon: ClipboardList,
      },
    ],
  },
  {
    labelKey: "admin",
    defaultHref: "/admin/users",
    items: [
      // Der Setup-Leitfaden aus der aufgelösten Gruppe „Setup". Bewusst **ohne**
      // Capability, obwohl die übrigen Einträge hier eine tragen: sonst verlöre
      // ein frisch angelegter Mandant genau die Seite, die ihn einrichtet.
      { href: "/setup", labelKey: "setupGuide", icon: ClipboardCheck, exact: true },
      {
        href: "/admin/users",
        labelKey: "users",
        icon: ShieldCheck,
        capability: "admin.users.read",
      },
      {
        href: "/admin/roles",
        labelKey: "roles",
        icon: ShieldCheck,
        capability: "role.capability.manage",
      },
      {
        href: "/admin/anfragen",
        labelKey: "joinRequests",
        icon: Inbox,
        capability: "tenant.users.manage",
      },
      {
        href: "/admin/goal-fields",
        labelKey: "goalFields",
        icon: ListTodo,
        capability: "goal.custom_field.manage",
      },
      {
        href: "/admin/integrations",
        labelKey: "integrations",
        icon: Plug,
        capability: "integration.manage",
      },
      {
        href: "/admin/audit-log",
        labelKey: "auditLog",
        icon: ClipboardList,
        capability: "admin.audit-log.read",
      },
    ],
  },
  {
    // Sammelplatz für Routen, die im IA-Rework nicht in eine eigene
    // Gruppe gewandert sind, aber weiter erreichbar bleiben. Wenn ein
    // Eintrag dauerhaft niemand nutzt, raus aus dem Nav.
    labelKey: "others",
    items: [
      {
        href: "/roadmap/portfolio",
        labelKey: "portfolioRoadmap",
        icon: Map,
        practice: "portfolioLevel",
      },
      {
        href: "/roadmap/value-stream",
        labelKey: "valueStreamRoadmap",
        icon: GitBranch,
        practice: "portfolioLevel",
      },
      { href: "/roadmap/art", labelKey: "artRoadmap", icon: Route, practice: "programLevel" },
      {
        href: "/reporting/portfolio-health",
        labelKey: "portfolioHealth",
        icon: BarChart2,
        practice: "portfolioLevel",
      },
      {
        href: "/reporting/wsjf-leaderboard",
        labelKey: "wsjfLeaderboard",
        icon: Trophy,
        practice: "wsjf",
      },
    ],
  },
];

// Wrench/MoreHorizontal sind reserviert für spätere Setup-/Others-Akzente.
void Wrench;
void MoreHorizontal;
