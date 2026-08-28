"use client";

import {
  ROAM_DOT,
  ROAM_LABELS,
  ROAM_STATUSES,
  type RoamStatus,
} from "@/modules/core/kernel/domain/roam";

/**
 * ROAM-Funnel — die geteilte Achse über beide Issue-Arten. Sichtbare Chip-Leiste
 * mit Zählern; Mehrfach-Auswahl (togglet je Status). „Alle" setzt zurück.
 */
export function IssuesFunnelBar({
  counts,
  activeRoams,
  onToggleRoam,
  onClear,
}: {
  counts: Record<RoamStatus, number>;
  activeRoams: string[];
  onToggleRoam: (roam: RoamStatus) => void;
  onClear: () => void;
}) {
  const total = ROAM_STATUSES.reduce((sum, s) => sum + counts[s], 0);
  const none = activeRoams.length === 0;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={onClear}
        aria-pressed={none}
        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs ${
          none ? "border-primary bg-primary/10 font-medium" : "hover:bg-muted/50"
        }`}
      >
        Alle
        <span className="tabular-nums text-muted-foreground">{total}</span>
      </button>
      {ROAM_STATUSES.map((s) => {
        const active = activeRoams.includes(s);
        return (
          <button
            key={s}
            type="button"
            onClick={() => onToggleRoam(s)}
            aria-pressed={active}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs ${
              active ? "border-primary bg-primary/10 font-medium" : "hover:bg-muted/50"
            }`}
          >
            <span className={`size-2 rounded-full ${ROAM_DOT[s]}`} aria-hidden />
            {ROAM_LABELS[s]}
            <span className="tabular-nums text-muted-foreground">{counts[s]}</span>
          </button>
        );
      })}
    </div>
  );
}
