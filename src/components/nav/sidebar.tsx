"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Layers,
  Network,
  Zap,
  CalendarRange,
  Map,
  GitBranch,
  Route,
  Users,
  Timer,
  BarChart2,
  Activity,
  Trophy,
  ShieldCheck,
  Plug,
  ClipboardList,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { UserNav } from "@/components/nav/user-nav";

const NAV_GROUPS = [
  {
    labelKey: "portfolio",
    items: [
      { href: "/portfolio", labelKey: "overview", icon: LayoutDashboard, exact: true },
      { href: "/portfolio/epics", labelKey: "epics", icon: Layers },
      { href: "/roadmap/portfolio", labelKey: "portfolioRoadmap", icon: Map },
    ],
  },
  {
    labelKey: "capacityPlanning",
    items: [
      { href: "/capacity", labelKey: "valueStreams", icon: Network },
      { href: "/roadmap/value-stream", labelKey: "valueStreamRoadmap", icon: GitBranch },
    ],
  },
  {
    labelKey: "programPlanning",
    items: [
      { href: "/art", labelKey: "arts", icon: Zap },
      { href: "/pi-planning", labelKey: "piPlanning", icon: CalendarRange },
      { href: "/roadmap/art", labelKey: "artRoadmap", icon: Route },
    ],
  },
  {
    labelKey: "teamExecution",
    items: [
      { href: "/team", labelKey: "teams", icon: Users },
      { href: "/sprint", labelKey: "mySprints", icon: Timer },
    ],
  },
  {
    labelKey: "reporting",
    items: [
      { href: "/reporting/portfolio-health", labelKey: "portfolioHealth", icon: BarChart2 },
      { href: "/reporting/pi-velocity", labelKey: "piVelocity", icon: Activity },
      { href: "/reporting/wsjf-leaderboard", labelKey: "wsjfLeaderboard", icon: Trophy },
    ],
  },
  {
    labelKey: "admin",
    items: [
      { href: "/admin/users", labelKey: "users", icon: ShieldCheck },
      { href: "/admin/integrations", labelKey: "integrations", icon: Plug },
      { href: "/admin/audit-log", labelKey: "auditLog", icon: ClipboardList },
    ],
  },
] as const;

function isActive(pathname: string, href: string, exact: boolean): boolean {
  const path = pathname.replace(/^\/[a-z]{2}(?=\/|$)/, "") || "/";
  if (exact) return path === href;
  return path === href || path.startsWith(`${href}/`);
}

interface SidebarProps {
  userEmail: string;
}

export function Sidebar({ userEmail }: SidebarProps) {
  const pathname = usePathname();
  const t = useTranslations("nav");

  return (
    <aside className="flex flex-col h-full bg-sidebar border-r border-sidebar-border">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 h-14 border-b border-sidebar-border shrink-0">
        <div className="size-7 rounded-lg bg-primary flex items-center justify-center shrink-0">
          <Zap className="size-4 text-primary-foreground" strokeWidth={2.5} />
        </div>
        <span className="font-semibold text-sm tracking-tight text-sidebar-foreground">Pulse</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-1">
        {NAV_GROUPS.map((group, groupIdx) => (
          <div key={group.labelKey}>
            {groupIdx > 0 && <Separator className="my-3 bg-sidebar-border" />}
            <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">
              {t(group.labelKey)}
            </p>
            <div className="space-y-0.5">
              {group.items.map(({ href, labelKey, icon: Icon, ...rest }) => {
                const exact = "exact" in rest ? rest.exact : false;
                const active = isActive(pathname, href, exact);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                      active
                        ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    <span>{t(labelKey)}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User Section */}
      <div className="border-t border-sidebar-border p-3 shrink-0">
        <UserNav email={userEmail} />
      </div>
    </aside>
  );
}
