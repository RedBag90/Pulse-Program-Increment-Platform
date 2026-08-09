"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { CockpitArtRef } from "@/server/views/umsetzung-cockpit-view";

/**
 * Cockpit-Top-Bar — Scope-Krumelpfad + Filter + Quick-Add. Aktuell zeigt
 * der Krumelpfad „Timeline ▸ ART" (Team-Ebene kommt mit P3-Tabelle).
 *
 * Multi-ART: erscheint nur wenn der User Zugriff auf >1 ART hat. Bei
 * genau einer ART steht die ART als Plain-Text — kein Picker, kein Klick.
 * URL-Param `?art=<uuid>` persistiert die Auswahl deeplinkbar.
 */
interface Props {
  availableArts: CockpitArtRef[];
  selectedArt: CockpitArtRef | null;
  canCreate: boolean;
}

export function CockpitTopBar({ availableArts, selectedArt, canCreate }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setArt(artId: string) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("art", artId);
    router.replace(`${pathname}?${next.toString()}` as never, { scroll: false });
  }

  const isMultiArt = availableArts.length > 1;
  const valueStreamName = selectedArt?.valueStreamName ?? null;

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-surface-frame px-6 py-3">
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
        {/* Filter-Chips kommen mit P2/P3 — hier nur Platzhalter, damit
            das Layout stabil bleibt und der Sicht-Toggle drunter sitzen
            kann. */}
        <button
          type="button"
          disabled
          className="rounded-md border bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground"
          title="Filter folgen mit Phase 2"
        >
          Filter ▾
        </button>
        {canCreate && (
          <button
            type="button"
            disabled
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
            title="Quick-Add folgt mit Phase 2"
          >
            + Feature
          </button>
        )}
      </div>
    </header>
  );
}
