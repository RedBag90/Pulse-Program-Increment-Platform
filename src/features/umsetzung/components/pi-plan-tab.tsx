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
}: Props) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <div className="flex shrink-0 overflow-hidden rounded-md border text-sm">
          {(["board", "table"] as const).map((v) => (
            <Link
              key={v}
              href={`/umsetzung/pi/${piId}?tab=plan&view=${v}` as never}
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
