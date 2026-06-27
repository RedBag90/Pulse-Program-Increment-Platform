"use client";

import { useTranslations } from "next-intl";
import { usePathname, useSearchParams } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { NAV_GROUPS } from "@/components/nav/nav-config";
import { isActiveLink } from "@/components/nav/active";
import type { MegaMenuApi } from "@/components/nav/use-mega-menu";

interface Props {
  visibleHrefs: string[];
  /** Mega-menu state-machine; spread `menu.panelProps` for hover-wiring. */
  menu: MegaMenuApi;
}

/**
 * Full-width sub-nav panel rendered as an absolute overlay under the topbar.
 * Returns `null` when no group is open — costs nothing in the closed state.
 * Clicking an item closes the panel via `menu.close`.
 */
export function TopNavMegaPanel({ visibleHrefs, menu }: Props) {
  const pathname = usePathname();
  const search = useSearchParams();
  const t = useTranslations("nav");

  if (!menu.openKey) return null;

  const group = NAV_GROUPS.find((g) => g.labelKey === menu.openKey);
  if (!group) return null;

  const visible = new Set(visibleHrefs);
  const items = group.items.filter((item) => visible.has(item.href));
  // Single-item groups shouldn't open the panel — the trigger is a direct link.
  if (items.length <= 1) return null;

  return (
    <div
      {...menu.panelProps}
      aria-label={t(group.labelKey)}
      className="absolute left-0 right-0 top-12 z-40 hidden border-t bg-background/95 px-4 py-1.5 shadow-md backdrop-blur-sm md:block md:px-6"
    >
      <ul className="flex flex-wrap gap-1">
        {items.map(({ href, labelKey, icon: Icon, exact }) => {
          const active = isActiveLink(pathname, search, href, exact ?? false);
          return (
            <li key={href}>
              <Link
                href={href}
                onClick={menu.close}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md border border-transparent px-2.5 py-1 text-xs transition-colors hover:border-border hover:bg-muted",
                  active &&
                    "border-primary bg-primary/5 font-medium text-primary hover:border-primary",
                )}
              >
                <Icon className="size-3.5 shrink-0 opacity-70" />
                <span>{t(labelKey)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
