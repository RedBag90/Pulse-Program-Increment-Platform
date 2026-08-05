"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { ZieleSubTab } from "@/server/views/ziele-view";
import { ToggleGroup } from "@/components/ui/toggle-group";

/**
 * Sub-Tabs fuer die Ziele-Shell (nur `mode="ziele"`): Strategie · Money.
 * URL-State `?tab=`, Default `strategie`. Die Strategie-Pflege (/strategy)
 * hat keinen Sub-Tab-Toggle mehr (OKR-Board entfernt; Money lebt in Ziele,
 * Pflege ist nach Controlling gewandert).
 */
const TABS: ReadonlyArray<{ id: ZieleSubTab; label: string }> = [
  { id: "strategie", label: "Strategie" },
  { id: "money", label: "Money" },
];

interface Props {
  active: ZieleSubTab;
  /** Money entsteht aus Epic-KPIs (Portfolio-Modul) — ohne Portfolio ausgeblendet. */
  showMoney?: boolean;
}

export function ZieleSubTabs({ active, showMoney = true }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabs = showMoney ? TABS : TABS.filter((t) => t.id !== "money");

  function setTab(next: ZieleSubTab) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "strategie") params.delete("tab");
    else params.set("tab", next);
    const qs = params.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ""}` as never, { scroll: false });
  }

  return (
    <ToggleGroup
      value={active}
      options={tabs}
      onChange={setTab}
      ariaLabel="Ziele-Sub-Tabs"
      className="bg-card text-sm"
    />
  );
}
