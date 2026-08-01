"use client";

import { useTranslations } from "next-intl";
import { usePathname, useSearchParams } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import type { NavItem } from "@/components/nav/nav-config";
import { isActiveLink } from "@/components/nav/active";
import type { MegaMenuApi } from "@/components/nav/use-mega-menu";

interface Props {
  items: readonly NavItem[];
  /** Group's `labelKey` — only used for the panel's accessible label. */
  labelKey: string;
  menu: MegaMenuApi;
}

/**
 * Compact dropdown rendered directly under the active trigger by
 * `TopNavMegaTriggers`. The trigger wraps both itself and this panel in a
 * `position: relative` container; the panel uses `absolute top-full left-0`
 * to anchor without any JS x-position tracking. Clicking an item closes the
 * panel via `menu.close`.
 */
export function TopNavMegaPanel({ items, labelKey, menu }: Props) {
  const pathname = usePathname();
  const search = useSearchParams();
  const t = useTranslations("nav");

  return (
    <div
      {...menu.panelProps}
      aria-label={t(labelKey)}
      className="absolute left-0 top-full z-40 mt-1 hidden w-64 rounded-md border bg-popover shadow-lg backdrop-blur-sm md:block"
    >
      <ul className="flex flex-col gap-0.5 p-1">
        {items.map(({ href, labelKey: itemLabelKey, icon: Icon, exact }) => {
          const active = isActiveLink(pathname, search, href, exact ?? false);
          return (
            <li key={href}>
              <Link
                href={href}
                onClick={menu.close}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors hover:bg-muted",
                  active && "bg-primary/5 font-medium text-primary",
                )}
              >
                <Icon className="size-4 shrink-0 opacity-70" />
                <span>{t(itemLabelKey)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
