"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ToggleGroup } from "@/components/ui/toggle-group";

/**
 * Sub-Toolbar-Toggle fuer den Strategie-Tab. Layouts über URL-State
 * `?layout=…`; Default **Tabelle** (URL-Param weglassen).
 *
 *   - **Tabelle** — hierarchische Liste, Pflege + € (Default)
 *   - **Netzplan** — Node-Graph (Strategy-Map)
 *   - **Roadmap** — Zeitachse (Balken je Zeitraum, Theme-Lanes) — nur Lesen
 *   - **Alignment** — Karten-Baum mit Fortschritts-Ring — nur Lesen
 */
export type StrategyLayout = "tabelle" | "netzplan" | "roadmap" | "alignment";

const OPTIONS: ReadonlyArray<{ id: StrategyLayout; label: string }> = [
  { id: "tabelle", label: "Tabelle" },
  { id: "netzplan", label: "Netzplan" },
  { id: "roadmap", label: "Roadmap" },
  { id: "alignment", label: "Alignment" },
];

interface Props {
  active: StrategyLayout;
}

export function StrategyLayoutToggle({ active }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setLayout(next: StrategyLayout) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "tabelle") params.delete("layout");
    else params.set("layout", next);
    const qs = params.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ""}` as never, { scroll: false });
  }

  return (
    <ToggleGroup
      value={active}
      options={OPTIONS}
      onChange={setLayout}
      ariaLabel="Layout"
      className="bg-card text-[11px]"
    />
  );
}
