"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { ChevronDown, Lock } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { NAV_GROUPS } from "@/components/nav/nav-config";
import { isActive } from "@/components/nav/active";
import { TopNavMegaPanel } from "@/components/nav/top-nav-mega-panel";
import type { MegaMenuApi } from "@/components/nav/use-mega-menu";

interface Props {
  /** Hrefs the principal may see — computed server-side from target + capabilities. */
  visibleHrefs: string[];
  /** Modul-gesperrte Hrefs (Entitlement) — sichtbar, aber ausgegraut mit 🔒. */
  lockedHrefs: string[];
  /** Mega-menu state-machine; owns hover/focus/ESC/timer/fine-pointer logic. */
  menu: MegaMenuApi;
}

const triggerBase =
  "flex h-12 items-center border-b-2 px-1 text-sm transition-colors -mb-px outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * Komplett modul-gesperrte Gruppe: ausgegrauter Trigger mit Schloss; Klick
 * öffnet einen kleinen „Teil der Vollversion"-Hinweis statt zu navigieren.
 */
function LockedTrigger({ label }: { label: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative" onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={cn(triggerBase, "gap-1 border-transparent text-muted-foreground/50")}
      >
        <Lock className="size-3" aria-hidden />
        {label}
      </button>
      {open && (
        <div className="absolute left-0 top-full z-40 mt-1 w-56 rounded-md border bg-popover p-3 text-xs text-popover-foreground shadow-lg">
          <p className="font-medium">{label}</p>
          <p className="mt-1 text-muted-foreground">
            Dieses Modul ist Teil der Vollversion und in diesem Bereich nicht enthalten.
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Top-nav trigger row. Single-item groups render as direct links; multi-item
 * groups render as `<button>`s that spread `menu.triggerProps(key)` for the
 * full hover/focus/aria/data-key bag, and add their own `onClick` that
 * navigates to the group's `defaultHref` plus opens the panel. Modul-gesperrte
 * Items bleiben sichtbar (Upsell): voll gesperrte Gruppen als `LockedTrigger`,
 * teil-gesperrte zeigen ihre gesperrten Einträge ausgegraut im Panel.
 */
export function TopNavMegaTriggers({ visibleHrefs, lockedHrefs, menu }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("nav");
  const visible = new Set(visibleHrefs);
  const locked = new Set(lockedHrefs);

  const groups = NAV_GROUPS.map((group) => {
    const items = group.items.filter((item) => visible.has(item.href) || locked.has(item.href));
    const unlocked = items.filter((item) => visible.has(item.href));
    return { ...group, items, unlocked, fullyLocked: items.length > 0 && unlocked.length === 0 };
  }).filter((group) => group.items.length > 0);

  return (
    <nav className="hidden h-12 items-stretch gap-5 md:flex">
      {groups.map((group) => {
        if (group.fullyLocked) {
          return <LockedTrigger key={group.labelKey} label={t(group.labelKey)} />;
        }

        // Trigger highlighting is path-only — a section stays lit no matter
        // which `?tab=` the user is on inside it.
        const groupActive = group.unlocked.some((i) =>
          isActive(pathname, i.href, i.exact ?? false),
        );

        // Single (freigeschaltetes) Item → direkter Link mit Gruppen-Label.
        if (group.items.length === 1) {
          const item = group.items[0]!;
          return (
            <Link
              key={group.labelKey}
              href={item.href}
              onClick={menu.close}
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
        // Navigations-Ziel: defaultHref nur, wenn freigeschaltet; sonst das
        // erste freigeschaltete Item der Gruppe.
        const targetHref =
          group.defaultHref && visible.has(group.defaultHref)
            ? group.defaultHref
            : group.unlocked[0]!.href;
        return (
          <div key={group.labelKey} className="relative">
            <button
              type="button"
              {...menu.triggerProps(group.labelKey)}
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
              <TopNavMegaPanel
                items={group.items}
                lockedHrefs={lockedHrefs}
                labelKey={group.labelKey}
                menu={menu}
              />
            )}
          </div>
        );
      })}
    </nav>
  );
}
