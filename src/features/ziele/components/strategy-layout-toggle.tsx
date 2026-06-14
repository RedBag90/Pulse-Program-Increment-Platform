"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

/**
 * Sub-Toolbar-Toggle fuer den Strategie-Tab. Vier Layouts mit URL-
 * State `?layout=…`; Default Tree (URL-Param weglassen).
 *
 *   - **Tree** — geschachtelte Cards (Default)
 *   - **Sankey** — €-Fluss-Diagramm
 *   - **Tabelle** — hierarchische Liste (Asana-Style)
 *   - **Netzplan** — Node-Graph (Asana Strategy-Map-Style)
 */
export type StrategyLayout = "tree" | "sankey" | "tabelle" | "netzplan";

const OPTIONS: ReadonlyArray<{ id: StrategyLayout; label: string }> = [
  { id: "tree", label: "Tree" },
  { id: "sankey", label: "Sankey" },
  { id: "tabelle", label: "Tabelle" },
  { id: "netzplan", label: "Netzplan" },
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
    if (next === "tree") params.delete("layout");
    else params.set("layout", next);
    const qs = params.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ""}` as never, { scroll: false });
  }

  return (
    <div className="inline-flex overflow-hidden rounded-md border bg-card text-[11px]">
      {OPTIONS.map((o) => {
        const isActive = o.id === active;
        const cls = isActive
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-muted/50";
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => setLayout(o.id)}
            className={`px-2.5 py-1 ${cls}`}
            aria-pressed={isActive}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
