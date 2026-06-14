"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { ZieleSubTab } from "@/server/views/ziele-view";

/**
 * Sub-Tabs fuer Ziele + Strategie. URL-State `?tab=`, Default `strategie`.
 * Im `ziele`-Modus sehen wir 3 Tabs (Strategie · OKRs · Money); im
 * `strategy`-Modus 2 Tabs (Strategie · OKRs), weil Money in Ziele
 * lebt und Pflege nach Controlling gewandert ist.
 */
type ShellMode = "ziele" | "strategy";

const TABS_BY_MODE: Record<ShellMode, ReadonlyArray<{ id: ZieleSubTab; label: string }>> = {
  ziele: [
    { id: "strategie", label: "Strategie" },
    { id: "okrs", label: "OKRs" },
    { id: "money", label: "Money" },
  ],
  strategy: [
    { id: "strategie", label: "Strategie" },
    { id: "okrs", label: "OKRs" },
  ],
};

interface Props {
  active: ZieleSubTab;
  mode?: ShellMode;
}

export function ZieleSubTabs({ active, mode = "ziele" }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabs = TABS_BY_MODE[mode];

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
      aria-label={`${mode === "strategy" ? "Strategie" : "Ziele"}-Sub-Tabs`}
      className="inline-flex overflow-hidden rounded-md border bg-card text-sm"
    >
      {tabs.map((t) => {
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
