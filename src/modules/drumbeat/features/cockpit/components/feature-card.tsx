"use client";

import { memo } from "react";
import type { CockpitFeature } from "@/modules/drumbeat/server/views/umsetzung-cockpit-view";
import { useUrlState } from "@/modules/drumbeat/features/lib/use-url-state";
import { FeatureCardBody } from "@/modules/drumbeat/features/cockpit/components/feature-card-body";
import { recentlyDragged, useCardDrag } from "@/modules/drumbeat/features/lib/board-dnd";

/**
 * Feature-Karte für das Board. Memoisiert mit Custom-Compare auf die Id und die
 * änderbaren Felder, damit ein Drag-Drop nur die zwei betroffenen Karten neu
 * rendert statt der ganzen Matrix.
 *
 * **Vier Signale an fester Stelle** — Epic, Solution, Owner, WSJF. Im Betrieb
 * muss man sehen, zu welchem Vorhaben und zu welchem Produkt eine Arbeit
 * gehört, wer sie führt und wie sie eingeordnet ist; die Spalte sagt nur das
 * PI, die Bahn nur den Status. Die Karte wächst dadurch um eine Zeile — die
 * Seite wird trotzdem kürzer, weil die Bahnen gekappt sind (`splitCell`).
 *
 * Ein Klick öffnet den Slide-Over — ausser auf WSJF und Job Size: dort öffnet
 * er den WSJF-Dialog, wenn man ihn setzen darf (`FeatureScore`).
 */
interface Props {
  feature: CockpitFeature;
  canDrag: boolean;
  /** `feature.wsjf.set` — WSJF und Job Size sind dann ein Knopf. */
  canScore: boolean;
}

/** Gemeinsame Hülle von Karte und Kopie am Finger. */
const CARD =
  "group relative flex flex-col gap-1 overflow-hidden rounded-md bg-card p-2 pl-2.5 text-left shadow-card transition-shadow";

function FeatureCardImpl({ feature, canDrag, canScore }: Props) {
  const { setParam } = useUrlState();
  // Mit Maus und Finger (`board-dnd.tsx`); ohne Recht bleibt die Karte stehen.
  const { attributes, listeners, setNodeRef, isDragging } = useCardDrag(feature.id, !canDrag);

  function openSlideOver() {
    setParam("featureId", feature.id);
  }

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      role="button"
      tabIndex={0}
      onClick={() => {
        // Der Klick nach dem Loslassen gehört zum Ziehen, nicht zum Öffnen.
        if (!recentlyDragged()) openSlideOver();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openSlideOver();
        }
      }}
      title={canDrag ? "Ziehen für PI-/Status-Wechsel" : "Nur lesen"}
      // `select-none` und kein iOS-Kontextmenü: der lange Druck nimmt die Karte auf.
      className={`${CARD} select-none [-webkit-touch-callout:none] hover:shadow-md ${
        feature.hasBlocker ? "border-amber-300" : "border-border"
      } ${canDrag ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"} ${
        isDragging ? "opacity-40" : ""
      }`}
    >
      <FeatureCardBody feature={feature} canScore={canScore} />
    </div>
  );
}

/** Die Kopie am Finger während des Ziehens — ohne Knöpfe und ohne Drag. */
export function FeatureCardPreview({ feature }: { feature: CockpitFeature }) {
  return (
    <div className={`${CARD} w-full border-border shadow-lg`}>
      <FeatureCardBody feature={feature} canScore={false} />
    </div>
  );
}

export const FeatureCard = memo(FeatureCardImpl, (a, b) => {
  // Nur Felder vergleichen, die Karte tatsaechlich rendert + Drag-Berechtigung.
  if (a.canDrag !== b.canDrag || a.canScore !== b.canScore) return false;
  const x = a.feature;
  const y = b.feature;
  return (
    x.id === y.id &&
    x.title === y.title &&
    x.status === y.status &&
    x.featureType === y.featureType &&
    x.piId === y.piId &&
    x.wsjfComputed === y.wsjfComputed &&
    x.wsjfJobSize === y.wsjfJobSize &&
    x.wsjfBusinessValue === y.wsjfBusinessValue &&
    x.wsjfTimeCriticality === y.wsjfTimeCriticality &&
    x.wsjfRiskReduction === y.wsjfRiskReduction &&
    x.wsjfBusinessValueActual === y.wsjfBusinessValueActual &&
    x.hasBlocker === y.hasBlocker &&
    x.blockerHint === y.blockerHint &&
    x.blockers.map((b) => `${b.id}:${b.state}`).join() ===
      y.blockers.map((b) => `${b.id}:${b.state}`).join() &&
    x.successors.map((b) => `${b.id}:${b.state}`).join() ===
      y.successors.map((b) => `${b.id}:${b.state}`).join()
  );
});
