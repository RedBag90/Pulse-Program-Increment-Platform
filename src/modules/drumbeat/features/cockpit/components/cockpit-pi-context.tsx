import { PiTransitionButton } from "@/modules/drumbeat/features/cockpit/components/pi-transition-button";
import { AdvanceCadenceButton } from "@/modules/drumbeat/features/cockpit/components/advance-cadence-button";
import { DeletePiButton } from "@/modules/drumbeat/features/cockpit/components/delete-pi-button";
import type { CockpitPiSlot } from "@/modules/drumbeat/server/views/umsetzung-cockpit-view";

/**
 * PI-Kontext-Leiste des Cockpits — ersetzt die frühere eigenständige
 * PI-Detailseite (`/pi/[piId]`). Sichtbar, sobald ein PI im Scope ist
 * (`?pi=`, Default = aktives PI): zeigt die PI-Fakten und die Lebenszyklus-
 * Aktionen am selben Ort wie Board/Tabelle/Roadmap.
 *
 * Abschließen läuft ausschließlich über „PI abschließen & nächstes öffnen"
 * (`AdvanceCadenceButton`) — der strenge Complete-PI-Weg entfällt (Spec WP2).
 * Darum wird `PiTransitionButton` hier nur für den Start (planned→active)
 * gerendert, nicht für aktive PIs.
 */
interface Props {
  pi: CockpitPiSlot;
  artId: string;
  artName: string;
  valueStreamName: string | null;
  canStart: boolean;
  canAdvance: boolean;
  canDelete: boolean;
}

const STATUS_BADGE: Record<string, string> = {
  planned: "bg-muted text-muted-foreground",
  active: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  completed: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
};

function formatDate(d: Date) {
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function CockpitPiContext({
  pi,
  artId,
  artName,
  valueStreamName,
  canStart,
  canAdvance,
  canDelete,
}: Props) {
  const badgeClass = STATUS_BADGE[pi.status] ?? "bg-muted text-muted-foreground";
  const totalDays = Math.round(
    (pi.endDate.getTime() - pi.startDate.getTime()) / (1000 * 60 * 60 * 24),
  );

  return (
    <div
      data-tour="cockpit-pi-context"
      className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b bg-surface-frame px-6 py-2.5"
    >
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold">{pi.name}</span>
        <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-medium ${badgeClass}`}>
          {pi.status}
        </span>
      </div>

      <span className="text-xs text-muted-foreground">
        {formatDate(pi.startDate)} – {formatDate(pi.endDate)} ({totalDays} Tage)
      </span>

      <span className="text-xs text-muted-foreground">
        {valueStreamName ? `${valueStreamName} · ` : ""}
        {artName} · {pi.featureCount} Feature{pi.featureCount === 1 ? "" : "s"}
      </span>

      <div className="ml-auto flex shrink-0 items-center gap-2">
        {pi.status === "planned" && canStart && (
          <PiTransitionButton piId={pi.id} currentStatus="planned" />
        )}
        {pi.status === "active" && canAdvance && <AdvanceCadenceButton piId={pi.id} />}
        {pi.status === "planned" && canDelete && (
          <DeletePiButton piId={pi.id} artId={artId} name={pi.name} />
        )}
      </div>
    </div>
  );
}
