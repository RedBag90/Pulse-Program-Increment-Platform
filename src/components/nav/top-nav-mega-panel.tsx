"use client";

import { useTranslations } from "next-intl";
import { usePathname, useSearchParams } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { NAV_GROUPS } from "@/components/nav/nav-config";
import { isActiveLink } from "@/components/nav/active";

interface Props {
  visibleHrefs: string[];
  /** The labelKey of the open group, or `null` when the panel is closed. */
  openKey: string | null;
}

/**
 * Full-width sub-nav panel rendered directly below the topbar row. Stays open
 * across navigations — clicking an item navigates but does not close. Only
 * the trigger toggle, ESC (handled by the Topbar parent), or clicking the
 * same trigger again closes it.
 *
 * Renders `null` when no group is open — costs nothing in the closed state.
 */
export function TopNavMegaPanel({ visibleHrefs, openKey }: Props) {
  const pathname = usePathname();
  const search = useSearchParams();
  const t = useTranslations("nav");

  if (!openKey) return null;

  const group = NAV_GROUPS.find((g) => g.labelKey === openKey);
  if (!group) return null;

  const visible = new Set(visibleHrefs);
  const items = group.items.filter((item) => visible.has(item.href));
  // Single-item groups shouldn't open the panel — the trigger is a direct link.
  // Guard rendering anyway in case state ends up out of sync.
  if (items.length <= 1) return null;

  return (
    <div
      id="mega-menu-panel"
      role="region"
      aria-label={t(group.labelKey)}
      className="hidden w-full border-t bg-background/95 px-4 py-1.5 backdrop-blur-sm md:block md:px-6"
    >
      <ul className="flex flex-wrap gap-1">
        {items.map(({ href, labelKey, icon: Icon, exact }) => {
          const active = isActiveLink(pathname, search, href, exact ?? false);
          return (
            <li key={href}>
              <Link
                href={href}
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
