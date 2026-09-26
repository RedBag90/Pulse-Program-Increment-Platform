"use client";

import { useTranslations } from "next-intl";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { OVERVIEW_VIEWS, type OverviewView } from "./view-switcher-config";

export type { OverviewView } from "./view-switcher-config";

/**
 * Segmented control for the Portfolio overview — „Gesamt" plus one view per
 * portfolio meeting. Switching the
 * variant preserves any other URL params (Stichtag, selectedEpicIds, …) by
 * using `router.replace` over the current search params, not a hard-coded
 * `?view=` link.
 */
export function ViewSwitcher({
  current,
  available,
}: {
  current: OverviewView;
  /** Die Ansichten, die es für diesen Mandanten gibt (`availableOverviewViews`). */
  available: readonly OverviewView[];
}) {
  const router = useRouter();
  const t = useTranslations();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setView(next: OverviewView) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "mission") params.delete("view");
    else params.set("view", next);
    const qs = params.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ""}` as never, { scroll: false });
  }

  return (
    <nav
      aria-label={t("work.common.viewVariant")}
      className="flex max-w-full items-center gap-1 overflow-x-auto rounded-md border bg-muted/30 p-0.5 text-xs"
    >
      {OVERVIEW_VIEWS.filter((v) => available.includes(v.key)).map((v) => {
        const active = v.key === current;
        return (
          <button
            key={v.key}
            type="button"
            onClick={() => setView(v.key)}
            aria-pressed={active}
            className={cn(
              "shrink-0 whitespace-nowrap rounded-md px-2.5 py-1 transition-colors",
              active
                ? "bg-background font-medium text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t(v.labelKey)}
          </button>
        );
      })}
    </nav>
  );
}
