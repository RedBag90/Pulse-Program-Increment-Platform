"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import type { CockpitFeature } from "@/modules/drumbeat/domain/cockpit-types";
import { FEATURE_TYPE_STRIPE } from "@/modules/drumbeat/features/lib/feature-type-tokens";
import { FEATURE_TYPE_KEYS } from "@/modules/work/domain/portfolio-guardrails";
import { FeatureScore } from "@/modules/drumbeat/features/cockpit/components/feature-score";
import { FeatureBlockers } from "@/modules/drumbeat/features/cockpit/components/feature-blockers";
import { initials } from "@/components/detail/initiative-labels";

/**
 * **Der Inhalt einer Feature-Karte — einmal, für Board und Netzplan.**
 *
 * Bis September 2026 zeigte der Netzplan-Knoten nur Statuspunkt, Titel,
 * Status und WSJF, während die Board-Karte Typ-Streifen, Epic ▸ Solution,
 * Owner, Blocker-Symbol und WSJF/JS-Knopf trug. Gewünscht war dieselbe Karte
 * an beiden Stellen; ein gemeinsamer Baustein hält sie gleich, statt dass zwei
 * Abschriften auseinanderlaufen.
 *
 * Die Hülle (Klick, Ziehen, Grösse) bleibt Sache der Fläche: das Board zieht
 * per HTML-Drag, der Netzplan per React Flow. `statusSlot` setzt der Netzplan —
 * im Board sagt die Zeile den Status.
 */
export function FeatureCardBody({
  feature,
  canScore,
  statusSlot,
  context = "epic",
}: {
  feature: CockpitFeature;
  /** `feature.wsjf.set` — WSJF und Job Size sind dann ein Knopf. */
  canScore: boolean;
  /** Eine eigene Zeile unter Epic ▸ Solution, z. B. der Status im Netzplan. */
  statusSlot?: ReactNode;
  /**
   * Was die Kontextzeile vor der Solution nennt: das **Epic** (Board,
   * Umsetzung) oder das **ART** (Epic-Reiter — dort ist das Epic auf jeder
   * Karte dasselbe, das ART sagt, wer umsetzt).
   */
  context?: "epic" | "art";
}) {
  const t = useTranslations();
  const kontext = context === "art" ? feature.artName || null : feature.parentTitle;
  const typLabel = feature.featureType
    ? t(FEATURE_TYPE_KEYS[feature.featureType])
    : t("drumbeat.ui.ohneTyp");

  return (
    <>
      {/* **Der Streifen zeigt den Typ, nicht den Status** — Feature, Enabler,
          Maintenance (`FEATURE_TYPE_STRIPE`). Die Farbe steht nicht allein:
          der Streifen trägt das Wort, das Board eine Legende. */}
      <span
        title={typLabel}
        className={`absolute inset-y-0 left-0 w-1 ${FEATURE_TYPE_STRIPE[feature.featureType ?? ""]}`}
      >
        <span className="sr-only">{typLabel}</span>
      </span>
      <p className="line-clamp-2 text-xs font-medium leading-snug">{feature.title}</p>

      {/* Epic ▸ Solution (bzw. ART ▸ Solution). Fehlt die Solution (gemessen
          40 % der Features), steht dort nur das Erste — kein „—", kein leerer
          Platzhalter. */}
      {kontext && (
        <p
          className="truncate text-label text-muted-foreground"
          title={feature.solutionName ? `${kontext} ▸ ${feature.solutionName}` : kontext}
        >
          {kontext}
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

      {statusSlot}

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
    </>
  );
}
