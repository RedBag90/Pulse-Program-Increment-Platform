import { Link } from "@/i18n/navigation";
import {
  FeaturePlanningBoard,
  type PlanningFeature,
} from "@/features/pi/components/feature-planning-board";
import {
  FeaturePlanningTable,
  type TablePi,
} from "@/features/pi/components/feature-planning-table";
import type { PiCapacityOverlay, FeatureBlockerOverlay } from "@/server/views/pi-planning";

interface Props {
  piId: string;
  artId: string;
  canEdit: boolean;
  features: PlanningFeature[];
  pis: TablePi[];
  capacity: Record<string, PiCapacityOverlay>;
  blockers: Record<string, FeatureBlockerOverlay>;
  currentCycleKey: string;
  /** Board oder Tabelle — gespiegelt aus `?view=` der URL. */
  view: "board" | "table";
  /** ARTs der Timeline, in der dieser PI lebt. Picker erscheint nur bei > 1. */
  availableArts: { id: string; name: string }[];
}

/**
 * Plan-Tab des PI-Workspaces. Wiederverwendet den bestehenden
 * PI-Planning-Board (Drag&Drop) bzw. die Tabellen-Variante. Zeigt
 * weiterhin **alle PIs des ARTs** (Planung ist cross-PI), damit
 * Features in einer Sitzung umverteilt werden koennen.
 */
export function PiPlanTab({
  piId,
  artId,
  canEdit,
  features,
  pis,
  capacity,
  blockers,
  currentCycleKey,
  view,
  availableArts,
}: Props) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {availableArts.length > 1 ? (
          <div className="flex flex-wrap gap-1 border-b">
            {availableArts.map((a) => (
              <Link
                key={a.id}
                href={`/umsetzung/pi/${piId}?tab=plan&view=${view}&art=${a.id}` as never}
                className={`-mb-px border-b-2 px-3 py-1.5 text-sm transition-colors ${
                  a.id === artId
                    ? "border-primary font-medium text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {a.name}
              </Link>
            ))}
          </div>
        ) : (
          <span /> /* Platzhalter fuer flex-justify */
        )}
        <div className="flex shrink-0 overflow-hidden rounded-md border text-sm">
          {(["board", "table"] as const).map((v) => (
            <Link
              key={v}
              href={`/umsetzung/pi/${piId}?tab=plan&view=${v}&art=${artId}` as never}
              className={`px-3 py-1.5 transition-colors ${
                view === v
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {v === "board" ? "Board" : "Tabelle"}
            </Link>
          ))}
        </div>
      </div>

      {pis.length === 0 ? (
        <p className="rounded-md border border-dashed bg-card px-4 py-3 text-sm text-muted-foreground">
          Der ART hat noch keine PIs angelegt.
        </p>
      ) : view === "table" ? (
        <FeaturePlanningTable
          artId={artId}
          canEdit={canEdit}
          features={features}
          pis={pis}
          capacity={capacity}
          blockers={blockers}
          currentCycleKey={currentCycleKey}
        />
      ) : (
        <FeaturePlanningBoard
          artId={artId}
          canEdit={canEdit}
          features={features}
          pis={pis}
          capacity={capacity}
          blockers={blockers}
          currentCycleKey={currentCycleKey}
        />
      )}
    </div>
  );
}
