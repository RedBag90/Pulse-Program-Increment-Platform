"use client";

import { memo, type RefObject } from "react";
import type { CockpitFeature } from "@/modules/drumbeat/server/views/umsetzung-cockpit-view";
import { WsjfBadge, FEATURE_STATUS_DOT } from "@/modules/drumbeat/features/lib/status-badges";
import { useUrlState } from "@/modules/drumbeat/features/lib/use-url-state";
import { initials } from "@/components/detail/initiative-labels";

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
 * Ein Klick öffnet den Slide-Over.
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
      title={canDrag ? "Ziehen für PI-/Status-Wechsel" : "Nur lesen"}
      className={`group relative flex flex-col gap-1 overflow-hidden rounded-md bg-card p-2 pl-2.5 text-left shadow-card transition-shadow hover:shadow-md ${
        feature.hasBlocker ? "border-amber-300" : "border-border"
      } ${canDrag ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"}`}
    >
      {/* Status-Farbstreifen (Registry-Hue) — dasselbe Vokabular wie Lane/Badge/Graph. */}
      <span
        aria-hidden
        className={`absolute inset-y-0 left-0 w-1 ${FEATURE_STATUS_DOT[feature.status]}`}
      />
      <p className="line-clamp-2 text-xs font-medium leading-snug">{feature.title}</p>

      {/* Epic ▸ Solution. Fehlt die Solution (gemessen 40 % der Features), steht
          dort nur das Epic — kein „—", kein leerer Platzhalter. */}
      {feature.parentTitle && (
        <p
          className="truncate text-label text-muted-foreground"
          title={
            feature.solutionName
              ? `${feature.parentTitle} ▸ ${feature.solutionName}`
              : feature.parentTitle
          }
        >
          {feature.parentTitle}
          {feature.solutionName && (
            <>
              <span aria-hidden className="mx-1 text-muted-foreground/60">
                ▸
              </span>
              {feature.solutionName}
            </>
          )}
        </p>
      )}

      <div className="flex items-center justify-between gap-2 text-label text-muted-foreground">
        <span className="flex min-w-0 items-center gap-1.5">
          {feature.ownerName ? (
            <>
              <span
                aria-hidden
                className="flex size-4 shrink-0 items-center justify-center rounded-full bg-muted text-label font-semibold text-foreground/70"
              >
                {initials(feature.ownerName)}
              </span>
              <span className="truncate" title={feature.ownerName}>
                {feature.ownerName}
              </span>
            </>
          ) : (
            <span className="truncate text-muted-foreground/60">ohne Owner</span>
          )}
        </span>
        {feature.wsjfComputed != null && (
          <WsjfBadge
            value={feature.wsjfComputed}
            className="shrink-0 px-1 py-0 text-label font-medium"
          />
        )}
      </div>

      {feature.hasBlocker && feature.blockerHint && (
        <p className="line-clamp-1 text-label text-warning">
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
