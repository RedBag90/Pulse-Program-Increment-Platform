"use client";

import { useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";
import type {
  CockpitArtRef,
  CockpitFilters,
  FeatureStatus,
} from "@/modules/drumbeat/server/views/umsetzung-cockpit-view";

/**
 * Cockpit-Top-Bar — Scope-Krümelpfad (Wertstrom ▸ ART) + Filter.
 *
 * Multi-ART: Picker erscheint nur bei >1 ART, sonst Plain-Text. `?art=<uuid>`
 * persistiert die Auswahl deeplinkbar.
 *
 * Filter: Status + „nur Blocker" schreiben in `?status=`/`?blocker=` (der Loader
 * honoriert sie serverseitig). Owner-/Epic-Filter sind über die URL bereits
 * honoriert; eigene Picker dafür folgen separat.
 */
interface Props {
  availableArts: CockpitArtRef[];
  selectedArt: CockpitArtRef | null;
  filters: CockpitFilters;
}

const STATUS_LABELS: Record<FeatureStatus, string> = {
  approved: "Freigegeben",
  in_progress: "In Umsetzung",
  blocked: "Blockiert",
  completed: "Fertig",
  cancelled: "Abgebrochen",
};

const STATUS_ORDER: readonly FeatureStatus[] = [
  "approved",
  "in_progress",
  "blocked",
  "completed",
  "cancelled",
];

export function CockpitTopBar({ availableArts, selectedArt, filters }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);

  function commit(next: URLSearchParams) {
    router.replace(`${pathname}?${next.toString()}` as never, { scroll: false });
  }

  function setArt(artId: string) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("art", artId);
    commit(next);
  }

  function toggleStatus(s: FeatureStatus) {
    const next = new URLSearchParams(searchParams.toString());
    const current = new Set(filters.status);
    if (current.has(s)) current.delete(s);
    else current.add(s);
    if (current.size === 0) next.delete("status");
    else next.set("status", [...current].join(","));
    commit(next);
  }

  function toggleBlocker() {
    const next = new URLSearchParams(searchParams.toString());
    if (filters.hasBlocker) next.delete("blocker");
    else next.set("blocker", "1");
    commit(next);
  }

  function reset() {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("status");
    next.delete("blocker");
    next.delete("owner");
    next.delete("epic");
    commit(next);
  }

  const isMultiArt = availableArts.length > 1;
  const valueStreamName = selectedArt?.valueStreamName ?? null;
  const activeCount =
    filters.status.length +
    filters.ownerIds.length +
    filters.epicIds.length +
    (filters.hasBlocker ? 1 : 0);

  return (
    <header className="relative flex flex-wrap items-center justify-between gap-3 border-b bg-surface-frame px-6 py-3">
      <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
        {valueStreamName && (
          <>
            <span className="text-muted-foreground">{valueStreamName}</span>
            <span className="text-muted-foreground/60">▸</span>
          </>
        )}
        {isMultiArt ? (
          <select
            aria-label="ART auswaehlen"
            value={selectedArt?.id ?? ""}
            onChange={(e) => setArt(e.target.value)}
            className="rounded-md border bg-background px-2 py-1 text-sm font-medium"
          >
            {availableArts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.activeFeatureCount})
              </option>
            ))}
          </select>
        ) : (
          <span className="font-medium">{selectedArt?.name ?? "Kein ART-Zugriff"}</span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex items-center gap-1.5 rounded-md border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted/40"
        >
          <SlidersHorizontal className="size-3.5" />
          Filter
          {activeCount > 0 && (
            <span className="grid size-4 place-items-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
              {activeCount}
            </span>
          )}
        </button>
      </div>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute right-6 top-[calc(100%-0.25rem)] z-20 w-60 rounded-lg border bg-card p-3 shadow-lg">
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Status
            </p>
            <div className="flex flex-col gap-1">
              {STATUS_ORDER.map((s) => (
                <label key={s} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={filters.status.includes(s)}
                    onChange={() => toggleStatus(s)}
                    className="size-3.5 accent-primary"
                  />
                  {STATUS_LABELS[s]}
                </label>
              ))}
            </div>

            <label className="mt-3 flex cursor-pointer items-center gap-2 border-t pt-2.5 text-sm">
              <input
                type="checkbox"
                checked={filters.hasBlocker}
                onChange={toggleBlocker}
                className="size-3.5 accent-primary"
              />
              Nur blockierte Features
            </label>

            {activeCount > 0 && (
              <button
                type="button"
                onClick={reset}
                className="mt-3 w-full rounded-md border px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
              >
                Filter zurücksetzen
              </button>
            )}
          </div>
        </>
      )}
    </header>
  );
}
