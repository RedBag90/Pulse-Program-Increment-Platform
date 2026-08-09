import type { CockpitPiSlot } from "@/server/views/umsetzung-cockpit-view";

/**
 * Cockpit-PI-Strip — horizontaler Streifen mit 5 PIs (aktuell + 1 vor + 3
 * nach, Entscheidung #10). Vor-/Zurueck-Pfeile sind ein Folgeschritt
 * (Phase 2 — sie verschieben das Fenster ueber ein zusaetzliches
 * URL-Param). Aktuelles PI wird hervorgehoben.
 */
interface Props {
  pis: CockpitPiSlot[];
}

export function CockpitPiStrip({ pis }: Props) {
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
      className="flex items-center gap-2 overflow-x-auto border-b bg-surface-frame px-6 py-3"
    >
      {pis.map((p) => {
        const cls = p.isCurrent
          ? "border-primary bg-primary/10 text-foreground"
          : "border-border bg-card text-muted-foreground hover:text-foreground";
        return (
          <div
            key={p.id}
            className={`flex min-w-[120px] flex-col rounded-md border px-3 py-1.5 text-xs ${cls}`}
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
          </div>
        );
      })}
    </nav>
  );
}
