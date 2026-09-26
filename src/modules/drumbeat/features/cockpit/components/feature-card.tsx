"use client";

import { useTranslations } from "next-intl";
import { memo, type RefObject } from "react";
import type { CockpitFeature } from "@/modules/drumbeat/server/views/umsetzung-cockpit-view";
import { FEATURE_TYPE_STRIPE } from "@/modules/drumbeat/features/lib/feature-type-tokens";
import { FEATURE_TYPE_KEYS } from "@/modules/work/domain/portfolio-guardrails";
import { FeatureScore } from "@/modules/drumbeat/features/cockpit/components/feature-score";
import { FeatureBlockers } from "@/modules/drumbeat/features/cockpit/components/feature-blockers";
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
  const t = useTranslations();
  const { setParam } = useUrlState();
  const typLabel = feature.featureType
    ? t(FEATURE_TYPE_KEYS[feature.featureType])
    : t("drumbeat.ui.ohneTyp");

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
      {/* **Der Streifen zeigt den Typ, nicht den Status.** Den Status zeigen
          die Board-Zeilen — der Streifen sagte ihn bis September 2026 ein
          zweites Mal. Jetzt: Feature, Enabler, Maintenance
          (`FEATURE_TYPE_STRIPE`, dieselben Töne wie im Netzplan). Die Farbe
          steht nicht allein: der Streifen trägt das Wort, das Board eine
          Legende. */}
      <span
        title={typLabel}
        className={`absolute inset-y-0 left-0 w-1 ${FEATURE_TYPE_STRIPE[feature.featureType ?? ""]}`}
      >
        <span className="sr-only">{typLabel}</span>
      </span>
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
            <span className="truncate text-muted-foreground/60">{t("drumbeat.ui.ohneOwner")}</span>
          )}
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          <FeatureBlockers blockers={feature.blockers} successors={feature.successors} />
          <FeatureScore
            feature={feature}
            canScore={canScore}
            badgeClassName="px-1 py-0 text-label font-medium"
          />
        </span>
      </div>
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
