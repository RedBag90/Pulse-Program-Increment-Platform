"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { usePathname } from "next/navigation";
import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { UserNav } from "@/components/nav/user-nav";
import { NAV_GROUPS } from "@/components/nav/nav-config";

function isActive(pathname: string, href: string, exact: boolean): boolean {
  const path = pathname.replace(/^\/[a-z]{2}(?=\/|$)/, "") || "/";
  if (exact) return path === href;
  return path === href || path.startsWith(`${href}/`);
}

interface SidebarProps {
  userEmail: string;
  /** Hrefs the principal may see — computed server-side from target + capabilities. */
  visibleHrefs: string[];
}

export function Sidebar({ userEmail, visibleHrefs }: SidebarProps) {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const visible = new Set(visibleHrefs);

  const groups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => visible.has(item.href)),
  })).filter((group) => group.items.length > 0);

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
        {groups.map((group, groupIdx) => (
          <div key={group.labelKey}>
            {groupIdx > 0 && <Separator className="my-3 bg-sidebar-border" />}
            <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">
              {t(group.labelKey)}
            </p>
            <div className="space-y-0.5">
              {group.items.map(({ href, labelKey, icon: Icon, exact }) => {
                const active = isActive(pathname, href, exact ?? false);
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
