import {
  LayoutDashboard,
  Layers,
  FolderTree,
  Target,
  Gauge,
  CalendarRange,
  Map,
  GitBranch,
  Route,
  Timer,
  BarChart2,
  Activity,
  Trophy,
  ShieldCheck,
  Plug,
  ClipboardList,
  ClipboardCheck,
  type LucideIcon,
} from "lucide-react";
import type { Practice } from "@/domain/operating-model";
import type { Action } from "@/server/auth/policies";

/**
 * The sidebar navigation, with per-item gating metadata. Lives in a shared
 * (non-client) module so the server layout can compute which items a user may
 * see — by the tenant's target operating model (`practice`) and the principal's
 * capabilities (`capability`) — and the client sidebar can render them.
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
        href: "/roadmap/portfolio",
        labelKey: "portfolioRoadmap",
        icon: Map,
        practice: "portfolioLevel",
      },
    ],
  },
  {
    labelKey: "structure",
    items: [{ href: "/structure", labelKey: "structure", icon: FolderTree }],
  },
  {
    labelKey: "transformation",
    items: [
      { href: "/transformation", labelKey: "transformationCockpit", icon: Gauge, exact: true },
      {
        href: "/transformation/ziel",
        labelKey: "targetState",
        icon: Target,
        capability: "target.manage",
      },
    ],
  },
  {
    labelKey: "programPlanning",
    items: [
      {
        href: "/pi-planning",
        labelKey: "piPlanning",
        icon: CalendarRange,
        practice: "programLevel",
      },
      {
        href: "/roadmap/value-stream",
        labelKey: "valueStreamRoadmap",
        icon: GitBranch,
        practice: "portfolioLevel",
      },
      { href: "/roadmap/art", labelKey: "artRoadmap", icon: Route, practice: "programLevel" },
    ],
  },
  {
    labelKey: "quality",
    items: [
      {
        href: "/quality/features",
        labelKey: "featureQuality",
        icon: ClipboardCheck,
        practice: "featureQs",
      },
    ],
  },
  {
    labelKey: "teamExecution",
    items: [{ href: "/sprint", labelKey: "mySprints", icon: Timer }],
  },
  {
    labelKey: "reporting",
    items: [
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
];
