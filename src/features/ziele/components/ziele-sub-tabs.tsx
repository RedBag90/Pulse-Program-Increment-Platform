"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { ZieleSubTab } from "@/server/views/ziele-view";

/**
 * Sub-Tabs des Ziele-Moduls. URL-State `?tab=`, Default `strategie`.
 * Konsistent zur Cockpit-Sicht-Toggle-Konvention.
 */
const TABS: ReadonlyArray<{ id: ZieleSubTab; label: string }> = [
  { id: "strategie", label: "Strategie" },
  { id: "okrs", label: "OKRs" },
  { id: "money", label: "Money" },
  { id: "pflege", label: "Pflege" },
];

interface Props {
  active: ZieleSubTab;
}

export function ZieleSubTabs({ active }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setTab(next: ZieleSubTab) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "strategie") params.delete("tab");
    else params.set("tab", next);
    const qs = params.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ""}` as never, { scroll: false });
  }

  return (
    <div
      role="tablist"
      aria-label="Ziele-Sub-Tabs"
      className="inline-flex overflow-hidden rounded-md border bg-card text-sm"
    >
      {TABS.map((t) => {
        const isActive = t.id === active;
        const cls = isActive
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-muted/50";
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 transition-colors ${cls}`}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
