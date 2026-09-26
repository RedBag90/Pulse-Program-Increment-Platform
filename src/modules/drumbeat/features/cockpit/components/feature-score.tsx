"use client";

import { useTranslations } from "next-intl";
import type { SyntheticEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { CockpitFeature } from "@/modules/drumbeat/domain/cockpit-types";
import { WsjfBadge } from "@/modules/drumbeat/features/lib/status-badges";
import { WsjfScoreDialog } from "@/modules/work/features/feature/components/wsjf-score-dialog";

/**
 * **WSJF und Job Size eines Features — anklickbar, wo man sie setzen darf.**
 *
 * Die Job Size steht neben dem WSJF, weil sie das ist, was sich gegen das Ziel
 * des PI summiert: wer plant, braucht sie auf der Karte, nicht erst im
 * Slide-Over. Ein Feature ohne Job Size zeigt „JS —" — es zählt in keiner
 * Summe, und das soll auffallen.
 *
 * Mit `feature.wsjf.set` öffnet ein Klick den WSJF-Dialog (derselbe wie im
 * Slide-Over; er setzt auch die Job Size). Der Knopf sitzt auf einer Karte,
 * die selbst klickbar und ziehbar ist — deshalb hält er Klick, Taste und
 * Zeigerdruck bei sich: sonst ginge zugleich das Slide-Over auf oder ein Drag
 * los.
 *
 * **Die Hülle, nicht der Knopf.** Der Dialog liegt im DOM ausserhalb der
 * Karte (Portal), im React-Baum aber darin — und React reicht Ereignisse
 * entlang des React-Baums weiter. Ein Klick auf „Speichern" oder Enter in
 * einem Feld des Dialogs landete sonst in `onClick`/`onKeyDown` der Karte
 * und öffnete das Slide-Over. Die Hülle fängt alles ab, was aus dem Dialog
 * oder dem Knopf aufsteigt.
 */
export function FeatureScore({
  feature,
  canScore,
  className,
  badgeClassName,
}: {
  feature: CockpitFeature;
  canScore: boolean;
  className?: string;
  badgeClassName?: string;
}) {
  const t = useTranslations();
  const badges = (
    <>
      <WsjfBadge value={feature.wsjfComputed} className={badgeClassName ?? ""} />
      <Badge
        variant="outline"
        className={cn(
          "font-mono tabular-nums",
          feature.wsjfJobSize == null && "text-muted-foreground",
          badgeClassName,
        )}
        title={t("drumbeat.ui.jobSizeFeatureErklaerung")}
      >
        {feature.wsjfJobSize == null
          ? t("drumbeat.ui.jobSizeFeatureLeer")
          : t("drumbeat.ui.jobSizeFeature", { n: feature.wsjfJobSize })}
      </Badge>
    </>
  );

  if (!canScore || !feature.artId) {
    return <span className={cn("flex shrink-0 items-center gap-1", className)}>{badges}</span>;
  }

  const beiMir = (e: SyntheticEvent) => e.stopPropagation();
  return (
    <span
      className="contents"
      onClick={beiMir}
      onKeyDown={beiMir}
      onPointerDown={beiMir}
      onMouseDown={beiMir}
      onDragStart={beiMir}
    >
      <WsjfScoreDialog
        featureId={feature.id}
        artId={feature.artId}
        current={{
          bv: feature.wsjfBusinessValue,
          tc: feature.wsjfTimeCriticality,
          rr: feature.wsjfRiskReduction,
          js: feature.wsjfJobSize,
        }}
        renderTrigger={({ onClick }) => (
          <button
            type="button"
            draggable={false}
            aria-label={t("drumbeat.ui.wsjfBearbeitenFuer", { title: feature.title })}
            onClick={onClick}
            onDragStart={(e) => e.preventDefault()}
            className={cn(
              "flex shrink-0 cursor-pointer items-center gap-1 rounded-md hover:opacity-80 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              className,
            )}
          >
            {badges}
          </button>
        )}
      />
    </span>
  );
}
