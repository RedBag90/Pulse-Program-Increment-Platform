import {
  LayoutDashboard,
  Layers,
  FolderTree,
  CalendarDays,
  Network,
  Goal,
  Gauge,
  Map,
  LineChart,
  Wallet,
  GitBranch,
  Route,
  Timer,
  BarChart2,
  Activity,
  Trophy,
  Calculator,
  ShieldCheck,
  Plug,
  ClipboardList,
  Inbox,
  ListTodo,
  Compass,
  Hammer,
  Wrench,
  MoreHorizontal,
  type LucideIcon,
} from "lucide-react";
import type { Practice } from "@/domain/operating-model";
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
}

export const NAV_GROUPS: NavGroup[] = [
  {
    labelKey: "myTasks",
    items: [{ href: "/my-tasks", labelKey: "myTasks", icon: ListTodo }],
  },
  {
    labelKey: "myApprovals",
    items: [{ href: "/my-approvals", labelKey: "myApprovals", icon: Inbox }],
  },
  {
    labelKey: "goals",
    items: [
      { href: "/ziele", labelKey: "goalOverview", icon: LayoutDashboard, exact: true },
      { href: "/strategy", labelKey: "strategy", icon: Goal, capability: "target.manage" },
      { href: "/transformation", labelKey: "goalManagement", icon: Goal },
    ],
  },
  {
    labelKey: "portfolio",
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
    ],
  },
  {
    labelKey: "implementation",
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
    labelKey: "setupControlling",
    items: [
      // "Structure Overview" und "Structure" zeigen heute denselben
      // Hub mit unterschiedlichem `?tab=`. Eine spätere Trennung könnte
      // Overview = high-level Dashboard, Structure = Strukturbaum.
      { href: "/structure?tab=overview", labelKey: "structureOverview", icon: FolderTree },
      { href: "/structure?tab=arts", labelKey: "structureTree", icon: Network },
      { href: "/structure?tab=timeline", labelKey: "structureTimeline", icon: CalendarDays },
      { href: "/controlling", labelKey: "controllingOverview", icon: Gauge, exact: true },
      {
        href: "/controlling/kpi-tree",
        labelKey: "kpiTree",
        icon: Calculator,
        practice: "portfolioLevel",
      },
      {
        href: "/controlling/kpi-coverage",
        labelKey: "kpiCoverage",
        icon: Calculator,
        capability: "target.manage",
      },
      {
        href: "/controlling/budgeting",
        labelKey: "participatoryBudgeting",
        icon: Wallet,
        capability: "budget.manage",
      },
      {
        href: "/controlling/budget-plan",
        labelKey: "budgetPlan",
        icon: ClipboardList,
      },
    ],
  },
  {
    labelKey: "admin",
    items: [
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
      // RTE-Cockpit ist in den ART-Hub (`/umsetzung/art/[id]`) eingezogen.
      // Die Route `/rte` bleibt als Redirect erreichbar, ist aber aus dem Nav raus.
      { href: "/sprint", labelKey: "mySprints", icon: Timer },
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
        href: "/reporting/pi-velocity",
        labelKey: "piVelocity",
        icon: Activity,
        practice: "programLevel",
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
