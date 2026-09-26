import { useTranslations } from "next-intl";
import { PiTransitionButton } from "@/modules/drumbeat/features/cockpit/components/pi-transition-button";
import { AdvanceCadenceButton } from "@/modules/drumbeat/features/cockpit/components/advance-cadence-button";
import { DeletePiButton } from "@/modules/drumbeat/features/cockpit/components/delete-pi-button";
import type { CockpitPiSlot } from "@/modules/drumbeat/server/views/umsetzung-cockpit-view";
import { PI_STATUS_KEYS } from "@/modules/drumbeat/domain/status";
import { PiJobSize } from "@/modules/drumbeat/features/cockpit/components/pi-job-size";
import { PiCapacityField } from "@/modules/drumbeat/features/cockpit/components/pi-capacity-field";

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
  canStart: boolean;
  canAdvance: boolean;
  canDelete: boolean;
  /** `pi.update` — die Kapazität setzen. */
  canEditPi: boolean;
}

const STATUS_BADGE: Record<string, string> = {
  planned: "bg-muted text-muted-foreground",
  active: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  completed: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
};

/**
 * Ein **gewähltes** PI trägt immer einen echten PI-Status; die synthetischen
 * Board-Spalten (`backlog`, `overflow`) kommen hier nie an. Die Prüfung steht
 * trotzdem da, weil `CockpitPiSlot` beide Welten trägt — und weil vorher der
 * rohe englische Wert („planned") in der deutschen Oberfläche stand.
 */
function piStatusLabel(status: string): string {
  const t = useTranslations();
  return status in PI_STATUS_KEYS
    ? t(PI_STATUS_KEYS[status as keyof typeof PI_STATUS_KEYS] ?? status)
    : status;
}

/** Deutsche Oberfläche, deutsches Datum — hier stand `en-GB`. */
function formatDate(d: Date) {
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" });
}

export function CockpitPiContext({ pi, artId, canStart, canAdvance, canDelete, canEditPi }: Props) {
  const badgeClass = STATUS_BADGE[pi.status] ?? "bg-muted text-muted-foreground";
  const totalDays = Math.round(
    (pi.endDate.getTime() - pi.startDate.getTime()) / (1000 * 60 * 60 * 24),
  );

  return (
    <div
      data-tour="cockpit-pi-context"
      className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border/60 px-6 py-2.5"
    >
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold">{pi.name}</span>
        <span
          className={`inline-block rounded-full px-2.5 py-0.5 text-meta font-medium ${badgeClass}`}
        >
          {piStatusLabel(pi.status)}
        </span>
      </div>

      <span className="text-xs text-muted-foreground">
        {formatDate(pi.startDate)} – {formatDate(pi.endDate)} ({totalDays} Tage)
      </span>

      {/*
        Wertstrom und ART standen hier noch einmal — sie stehen seit dem Umbau
        im Kopf, und zweimal dasselbe zu lesen kostet Aufmerksamkeit, ohne etwas
        zu sagen. Die Feature-Zahl bleibt: sie gehört zu diesem PI.
      */}
      <span className="text-xs text-muted-foreground">
        {pi.featureCount} Feature{pi.featureCount === 1 ? "" : "s"} in diesem PI
      </span>

      {/* Die Last steht gegen die Kapazität — und die Kapazität lässt sich
          hier setzen. Vorher gab es die Zahl nur als Saat. */}
      <PiJobSize pi={pi} className="text-xs" />
      {canEditPi && (
        <PiCapacityField
          key={`${pi.id}:${pi.capacityJobSize ?? ""}`}
          piId={pi.id}
          artId={artId}
          value={pi.capacityJobSize}
        />
      )}

      <div className="ml-auto flex shrink-0 items-center gap-2">
        {pi.status === "planned" && canStart && (
          <PiTransitionButton piId={pi.id} artId={artId} currentStatus="planned" />
        )}
        {pi.status === "active" && canAdvance && (
          <AdvanceCadenceButton piId={pi.id} artId={artId} />
        )}
        {pi.status === "planned" && canDelete && (
          <DeletePiButton piId={pi.id} artId={artId} name={pi.name} />
        )}
      </div>
    </div>
  );
}
