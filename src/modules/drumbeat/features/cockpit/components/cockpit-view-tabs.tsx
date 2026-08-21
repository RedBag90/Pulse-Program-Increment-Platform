"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { CockpitView } from "@/modules/drumbeat/server/views/umsetzung-cockpit-view";

/**
 * Sicht-Toggle Board / Tabelle / Roadmap. URL-Param `?view=<sicht>`,
 * Default ist `board` (Entscheidung #1). Filter + Scope ueberleben den
 * Sicht-Wechsel automatisch, weil sie eigene Query-Params sind.
 */
const TABS: ReadonlyArray<{ id: CockpitView; label: string }> = [
  { id: "board", label: "Board" },
  { id: "table", label: "Tabelle" },
  { id: "roadmap", label: "Roadmap" },
  { id: "network", label: "Netzplan" },
];

interface Props {
  view: CockpitView;
}

export function CockpitViewTabs({ view }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setView(next: CockpitView) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "board") params.delete("view");
    else params.set("view", next);
    const qs = params.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ""}` as never, { scroll: false });
  }

  return (
    <div
      role="tablist"
      aria-label="Cockpit-Sicht"
      data-tour="cockpit-view-tabs"
      className="inline-flex overflow-hidden rounded-md border bg-card text-sm"
    >
      {TABS.map((t) => {
        const active = t.id === view;
        const cls = active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-muted/50";
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => setView(t.id)}
            className={`px-3 py-1.5 transition-colors ${cls}`}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
