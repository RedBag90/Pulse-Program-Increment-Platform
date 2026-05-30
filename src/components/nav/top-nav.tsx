"use client";

import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NAV_GROUPS } from "@/components/nav/nav-config";
import { isActive } from "@/components/nav/active";

interface TopNavProps {
  /** Hrefs the principal may see — computed server-side from target + capabilities. */
  visibleHrefs: string[];
}

const linkBase =
  "flex h-12 items-center border-b-2 px-1 text-sm transition-colors -mb-px outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * Horizontal top navigation — re-hosts NAV_GROUPS as a slim editorial bar.
 * A group with several visible items opens a dropdown; a single-item group links
 * directly. The active group is underlined with the primary accent. Hidden on
 * mobile (the hamburger drawer renders the full sidebar instead).
 */
export function TopNav({ visibleHrefs }: TopNavProps) {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const visible = new Set(visibleHrefs);

  const groups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => visible.has(item.href)),
  })).filter((group) => group.items.length > 0);

  return (
    <nav className="hidden h-12 items-stretch gap-5 md:flex">
      {groups.map((group) => {
        const groupActive = group.items.some((i) => isActive(pathname, i.href, i.exact ?? false));

        // Single-item group → a direct link labelled with the group name.
        if (group.items.length === 1) {
          const item = group.items[0]!;
          return (
            <Link
              key={group.labelKey}
              href={item.href}
              className={cn(
                linkBase,
                groupActive
                  ? "border-primary font-medium text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t(group.labelKey)}
            </Link>
          );
        }

        return (
          <DropdownMenu key={group.labelKey}>
            <DropdownMenuTrigger
              className={cn(
                linkBase,
                "gap-1 data-[popup-open]:text-foreground",
                groupActive
                  ? "border-primary font-medium text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t(group.labelKey)}
              <ChevronDown className="size-3.5 opacity-60" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-52">
              {group.items.map(({ href, labelKey, icon: Icon, exact }) => {
                const active = isActive(pathname, href, exact ?? false);
                return (
                  <DropdownMenuItem
                    key={href}
                    render={
                      <Link href={href}>
                        <Icon className="size-4 shrink-0 opacity-70" />
                        <span>{t(labelKey)}</span>
                      </Link>
                    }
                    className={cn("gap-2", active && "text-foreground font-medium")}
                  />
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      })}
    </nav>
  );
}
