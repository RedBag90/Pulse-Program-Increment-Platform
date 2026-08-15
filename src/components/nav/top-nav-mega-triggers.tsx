"use client";

import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { NAV_GROUPS } from "@/components/nav/nav-config";
import { isActive } from "@/components/nav/active";
import { TopNavMegaPanel } from "@/components/nav/top-nav-mega-panel";
import type { MegaMenuApi } from "@/components/nav/use-mega-menu";

interface Props {
  /** Hrefs the principal may see — computed server-side from target + capabilities + entitlement. */
  visibleHrefs: string[];
  /** Mega-menu state-machine; owns hover/focus/ESC/timer/fine-pointer logic. */
  menu: MegaMenuApi;
}

const triggerBase =
  "flex h-12 items-center border-b-2 px-1 text-sm transition-colors -mb-px outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * Top-nav trigger row. Single-item groups render as direct links; multi-item
 * groups render as `<button>`s that spread `menu.triggerProps(key)` for the
 * full hover/focus/aria/data-key bag, and add their own `onClick` that
 * navigates to the group's `defaultHref` plus opens the panel. Nicht sichtbare
 * Items (practice/capability/Modul-Entitlement) werden komplett ausgeblendet —
 * eine Gruppe ohne sichtbares Item taucht gar nicht auf.
 */
export function TopNavMegaTriggers({ visibleHrefs, menu }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("nav");
  const visible = new Set(visibleHrefs);

  const groups = NAV_GROUPS.map((group) => {
    const items = group.items.filter((item) => visible.has(item.href));
    return { ...group, items };
  }).filter((group) => group.items.length > 0);

  return (
    <nav className="hidden h-12 items-stretch gap-5 md:flex">
      {groups.map((group) => {
        // Trigger highlighting is path-only — a section stays lit no matter
        // which `?tab=` the user is on inside it.
        const groupActive = group.items.some((i) => isActive(pathname, i.href, i.exact ?? false));

        // Single (freigeschaltetes) Item → direkter Link mit Gruppen-Label.
        if (group.items.length === 1) {
          const item = group.items[0]!;
          return (
            <Link
              key={group.labelKey}
              href={item.href}
              onClick={menu.close}
              // Anker der Rollen-Tour. Bewusst am immer sichtbaren Gruppen-
              // Trigger und nicht an den Einträgen im Mega-Panel — die sind
              // nur bei geöffnetem Menü im DOM.
              data-tour={`group:${group.labelKey}`}
              className={cn(
                triggerBase,
                groupActive
                  ? "border-primary font-medium text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t(group.labelKey)}
            </Link>
          );
        }

        const isOpen = menu.openKey === group.labelKey;
        // Navigations-Ziel: defaultHref nur, wenn sichtbar; sonst das erste
        // sichtbare Item der Gruppe.
        const targetHref =
          group.defaultHref && visible.has(group.defaultHref)
            ? group.defaultHref
            : group.items[0]!.href;
        return (
          <div key={group.labelKey} className="relative">
            <button
              type="button"
              {...menu.triggerProps(group.labelKey)}
              data-tour={`group:${group.labelKey}`}
              onClick={() => {
                menu.openPanel(group.labelKey);
                router.push(targetHref);
              }}
              className={cn(
                triggerBase,
                "gap-1",
                groupActive || isOpen
                  ? "border-primary font-medium text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t(group.labelKey)}
              <ChevronDown
                className={cn("size-3.5 opacity-60 transition-transform", isOpen && "rotate-180")}
              />
            </button>
            {isOpen && (
              <TopNavMegaPanel items={group.items} labelKey={group.labelKey} menu={menu} />
            )}
          </div>
        );
      })}
    </nav>
  );
}
