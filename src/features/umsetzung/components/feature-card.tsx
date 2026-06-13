"use client";

import { memo, type RefObject } from "react";
import type { CockpitFeature } from "@/server/views/umsetzung-cockpit-view";

/**
 * Feature-Karte fuer das Board (und spaeter den Slide-Over). Memoisiert
 * mit Custom-Compare auf den ID + den drei aenderbaren Feldern, damit ein
 * Drag-Drop nur die zwei betroffenen Karten neu rendert (und nicht das
 * ganze 5×4-Grid).
 *
 * Klick auf die Karte oeffnet den Slide-Over (P5); aktuell ist es ein
 * No-Op-Hook, der `onOpen` aufruft.
 */
interface Props {
  feature: CockpitFeature;
  canDrag: boolean;
  draggingId: RefObject<string | null>;
  onOpen?: (id: string) => void;
}

function FeatureCardImpl({ feature, canDrag, draggingId, onOpen }: Props) {
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
      onClick={() => onOpen?.(feature.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen?.(feature.id);
        }
      }}
      title={canDrag ? "Drag fuer PI/Status-Wechsel" : "Lese-Modus"}
      className={`group flex flex-col gap-1 rounded-md border bg-card p-2 text-left shadow-sm transition-shadow hover:shadow-md ${
        feature.hasBlocker ? "border-amber-300" : "border-border"
      } ${canDrag ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"}`}
    >
      <p className="line-clamp-2 text-xs font-medium leading-snug">{feature.title}</p>
      <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
        <span className="truncate">{feature.artName}</span>
        {feature.wsjfComputed != null && (
          <span className="shrink-0 font-medium">WSJF {Math.round(feature.wsjfComputed)}</span>
        )}
      </div>
      {feature.hasBlocker && feature.blockerHint && (
        <p className="line-clamp-1 text-[10px] text-amber-700">
          ⚠ blockt durch <span className="font-medium">{feature.blockerHint}</span>
        </p>
      )}
    </div>
  );
}

export const FeatureCard = memo(FeatureCardImpl, (a, b) => {
  // Nur Felder vergleichen, die Karte tatsaechlich rendert + Drag-Berechtigung.
  if (a.canDrag !== b.canDrag) return false;
  if (a.onOpen !== b.onOpen) return false;
  const x = a.feature;
  const y = b.feature;
  return (
    x.id === y.id &&
    x.title === y.title &&
    x.status === y.status &&
    x.piId === y.piId &&
    x.wsjfComputed === y.wsjfComputed &&
    x.hasBlocker === y.hasBlocker &&
    x.blockerHint === y.blockerHint
  );
});
