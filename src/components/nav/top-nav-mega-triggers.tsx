"use client";

import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { NAV_GROUPS } from "@/components/nav/nav-config";
import { isActive } from "@/components/nav/active";

interface Props {
  /** Hrefs the principal may see — computed server-side from target + capabilities. */
  visibleHrefs: string[];
  /** The currently open group's `labelKey`, or `null` when the panel is closed. */
  openKey: string | null;
  /** Setter — receives the next openKey (group label) or `null`. */
  onOpenChange: (next: string | null) => void;
}

const triggerBase =
  "flex h-12 items-center border-b-2 px-1 text-sm transition-colors -mb-px outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * Top-nav trigger row of the mega-menu. Single-item groups render as direct
 * links (with their group label); multi-item groups render as `<button>`s
 * that toggle the shared `openKey` state held by the Topbar. Pure click
 * behaviour — no hover-to-open, no hover-to-switch.
 */
export function TopNavMegaTriggers({ visibleHrefs, openKey, onOpenChange }: Props) {
  const pathname = usePathname();
  const router = useRouter();
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
              onClick={() => onOpenChange(null)}
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

        const isOpen = openKey === group.labelKey;
        const firstHref = group.items[0]!.href;
        return (
          <button
            key={group.labelKey}
            type="button"
            data-trigger-key={group.labelKey}
            aria-haspopup="true"
            aria-expanded={isOpen}
            aria-controls="mega-menu-panel"
            onClick={() => {
              if (isOpen) {
                // Toggle-close on the already-open trigger; no navigation —
                // the user is already in this section.
                onOpenChange(null);
              } else {
                // Open the panel for this group AND jump straight to its
                // first visible sub-page. Click on "Programmplanung" → land
                // on /pi-planning with the panel exposing the other items.
                router.push(firstHref);
                onOpenChange(group.labelKey);
              }
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
        );
      })}
    </nav>
  );
}
