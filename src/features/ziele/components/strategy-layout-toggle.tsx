"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

/**
 * Sub-Toolbar-Toggle fuer den Strategie-Tab. Drei Layouts mit URL-
 * State `?layout=…`; Default **Tabelle** (URL-Param weglassen).
 *
 *   - **Tabelle** — hierarchische Liste, Asana-Stil (Default)
 *   - **Sankey** — €-Fluss-Diagramm
 *   - **Netzplan** — Node-Graph (Asana Strategy-Map-Style)
 *
 * Die alte „Tree"-Sicht wurde mit Refactor §„Tabelle wird Haupt-
 * Layout" entfernt; alle Pflege-/€-Affordances sind in die Tabelle
 * gewandert.
 */
export type StrategyLayout = "tabelle" | "sankey" | "netzplan";

const OPTIONS: ReadonlyArray<{ id: StrategyLayout; label: string }> = [
  { id: "tabelle", label: "Tabelle" },
  { id: "sankey", label: "Sankey" },
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
    if (next === "tabelle") params.delete("layout");
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
