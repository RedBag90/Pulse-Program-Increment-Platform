"use client";

import { memo, type RefObject } from "react";
import type { CockpitFeature } from "@/modules/drumbeat/server/views/umsetzung-cockpit-view";
import { useUrlState } from "@/modules/drumbeat/features/lib/use-url-state";
import { FeatureCardBody } from "@/modules/drumbeat/features/cockpit/components/feature-card-body";

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
  draggingId: RefObject<string | null>;
}

function FeatureCardImpl({ feature, canDrag, canScore, draggingId }: Props) {
  const { setParam } = useUrlState();

  function openSlideOver() {
    setParam("featureId", feature.id);
  }

  return (
    <div
      role="button"
      tabIndex={0}
      draggable={canDrag}
      onDragStart={(e) => {
        draggingId.current = feature.id;
        e.dataTransfer.effectAllowed = "move";
        e.currentTarget.classList.add("opacity-40");
      }}
      onDragEnd={(e) => {
        e.currentTarget.classList.remove("opacity-40");
        draggingId.current = null;
      }}
      onClick={openSlideOver}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openSlideOver();
        }
      }}
      title={canDrag ? "Ziehen für PI-/Status-Wechsel" : "Nur lesen"}
      className={`group relative flex flex-col gap-1 overflow-hidden rounded-md bg-card p-2 pl-2.5 text-left shadow-card transition-shadow hover:shadow-md ${
        feature.hasBlocker ? "border-amber-300" : "border-border"
      } ${canDrag ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"}`}
    >
      <FeatureCardBody feature={feature} canScore={canScore} />
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
    x.hasBlocker === y.hasBlocker &&
    x.blockerHint === y.blockerHint &&
    x.blockers.map((b) => `${b.id}:${b.state}`).join() ===
      y.blockers.map((b) => `${b.id}:${b.state}`).join() &&
    x.successors.map((b) => `${b.id}:${b.state}`).join() ===
      y.successors.map((b) => `${b.id}:${b.state}`).join()
  );
});
