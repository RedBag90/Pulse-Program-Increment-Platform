"use client";

import { memo, type RefObject } from "react";
import type { CockpitFeature } from "@/modules/drumbeat/server/views/umsetzung-cockpit-view";
import { WsjfBadge, FEATURE_STATUS_DOT } from "@/modules/drumbeat/features/lib/status-badges";
import { useUrlState } from "@/modules/drumbeat/features/lib/use-url-state";
import { initials } from "@/components/detail/initiative-labels";

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
}

function FeatureCardImpl({ feature, canDrag, draggingId }: Props) {
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
      title={canDrag ? "Drag fuer PI/Status-Wechsel" : "Lese-Modus"}
      className={`group relative flex flex-col gap-1 overflow-hidden rounded-md border bg-card p-2 pl-2.5 text-left shadow-sm transition-shadow hover:shadow-md ${
        feature.hasBlocker ? "border-amber-300" : "border-border"
      } ${canDrag ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"}`}
    >
      {/* Status-Farbstreifen (Registry-Hue) — dasselbe Vokabular wie Lane/Badge/Graph. */}
      <span
        aria-hidden
        className={`absolute inset-y-0 left-0 w-1 ${FEATURE_STATUS_DOT[feature.status]}`}
      />
      <p className="line-clamp-2 text-xs font-medium leading-snug">{feature.title}</p>
      <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
        <div className="flex min-w-0 items-center gap-1.5">
          {feature.ownerName && (
            <span
              title={feature.ownerName}
              aria-label={`Owner: ${feature.ownerName}`}
              className="flex size-4 shrink-0 items-center justify-center rounded-full bg-muted text-[8px] font-semibold text-foreground/70"
            >
              {initials(feature.ownerName)}
            </span>
          )}
          <span className="truncate">{feature.parentTitle ?? "ohne Epic"}</span>
        </div>
        {feature.wsjfComputed != null && (
          <WsjfBadge
            value={feature.wsjfComputed}
            className="shrink-0 px-1 py-0 text-[10px] font-medium"
          />
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
