"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type {
  CockpitPiSlot,
  CockpitPiWindowNav,
} from "@/modules/drumbeat/server/views/umsetzung-cockpit-view";

/**
 * Cockpit-PI-Strip — horizontaler Streifen mit 5 PIs rund um den **Anker**
 * (aktives PI). Vor-/Zurück-Pfeile verschieben das Fenster über den `?piw`-
 * URL-Param, ohne den Anker zu ändern.
 *
 * Eine Kachel ist ein **Selektor**: Klick setzt `?pi=<id>` und scoped damit die
 * PI-Kontext-Leiste (Fakten + Start/Fortschreiben/Löschen) — kein Absprung mehr
 * auf die (entfallende) PI-Detailseite. Das gewählte PI wird hervorgehoben.
 */
interface Props {
  pis: CockpitPiSlot[];
  window: CockpitPiWindowNav;
  /** Aktuell im Scope gewähltes PI (Default = aktives PI), oder null. */
  selectedPiId: string | null;
}

export function CockpitPiStrip({ pis, window: nav, selectedPiId }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function shift(offset: number) {
    const next = new URLSearchParams(searchParams.toString());
    if (offset === 0) next.delete("piw");
    else next.set("piw", String(offset));
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  function select(piId: string) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("pi", piId);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  if (pis.length === 0) {
    return (
      <div className="border-b bg-surface-frame px-6 py-2 text-xs text-muted-foreground">
        Keine PIs in dieser Timeline.
      </div>
    );
  }

  return (
    <nav
      aria-label="PI-Strip"
      data-tour="cockpit-pi-strip"
      className="flex items-center gap-2 overflow-x-auto border-b bg-surface-frame px-6 py-3"
    >
      <button
        type="button"
        aria-label="Fenster zurück"
        disabled={!nav.canBack}
        onClick={() => shift(nav.offset - 1)}
        className="grid size-7 shrink-0 place-items-center rounded-md border bg-card text-muted-foreground hover:text-foreground disabled:opacity-30"
      >
        <ChevronLeft className="size-4" />
      </button>

      {pis.map((p) => {
        const isSelected = p.id === selectedPiId;
        const cls = isSelected
          ? "border-primary ring-1 ring-primary bg-primary/10 text-foreground"
          : p.isCurrent
            ? "border-primary/60 bg-primary/5 text-foreground"
            : "border-border bg-card text-muted-foreground hover:text-foreground";
        return (
          <button
            key={p.id}
            type="button"
            aria-pressed={isSelected}
            onClick={() => select(p.id)}
            className={`flex min-w-[120px] shrink-0 flex-col rounded-md border px-3 py-1.5 text-left text-xs transition-colors ${cls}`}
          >
            <span className="flex items-center gap-1 font-medium">
              {p.name}
              {p.isCurrent && (
                <span className="text-[10px] font-semibold uppercase tracking-wide text-primary">
                  jetzt
                </span>
              )}
            </span>
            <span className="text-[11px]">{p.featureCount} Features</span>
          </button>
        );
      })}

      <button
        type="button"
        aria-label="Fenster vor"
        disabled={!nav.canForward}
        onClick={() => shift(nav.offset + 1)}
        className="grid size-7 shrink-0 place-items-center rounded-md border bg-card text-muted-foreground hover:text-foreground disabled:opacity-30"
      >
        <ChevronRight className="size-4" />
      </button>

      {nav.offset !== 0 && (
        <button
          type="button"
          onClick={() => shift(0)}
          className="ml-1 shrink-0 whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-medium text-primary hover:underline"
        >
          Zum aktiven PI
        </button>
      )}
    </nav>
  );
}
