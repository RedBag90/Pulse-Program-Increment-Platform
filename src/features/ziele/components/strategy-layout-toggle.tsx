"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

/**
 * Sub-Toolbar-Toggle Tree ↔ Sankey (Konzept §4.1 / V1+V1b). URL-State
 * `?layout=sankey`; Default ist Tree (also `?layout` weglassen).
 */
export type StrategyLayout = "tree" | "sankey";

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
      {(["tree", "sankey"] as const).map((id) => {
        const isActive = id === active;
        const cls = isActive
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-muted/50";
        return (
          <button
            key={id}
            type="button"
            onClick={() => setLayout(id)}
            className={`px-2.5 py-1 ${cls}`}
            aria-pressed={isActive}
          >
            {id === "tree" ? "Tree" : "Sankey"}
          </button>
        );
      })}
    </div>
  );
}
