"use client";

import { useTranslations } from "next-intl";
import type { CockpitPiSlot } from "@/modules/drumbeat/domain/cockpit-types";

/**
 * **Wie viel Arbeit steckt in diesem PI?**
 *
 * Ein PI-Titel sagte bis September 2026 nur, *wie viele* Vorhaben darunter
 * liegen — eine Zahl, die nichts über den Aufwand aussagt: drei kleine
 * Features sind nicht dasselbe wie drei grosse. Die Kapazität daneben
 * (`setPiCapacity`) war gepflegt und wurde gegen nichts gestellt.
 *
 * Mit hinterlegter Kapazität steht die Summe **gegen** sie („18 / 25 JS"), und
 * eine Überbuchung färbt sich. Ohne Kapazität steht nur die Summe da — eine
 * Grenze zu behaupten, die niemand gesetzt hat, wäre schlimmer als keine.
 *
 * Ist gar nichts bewertet, steht nichts da: eine „0 JS" unter jedem PI wäre
 * Rauschen, kein Signal.
 */
export function PiJobSize({ pi, className = "" }: { pi: CockpitPiSlot; className?: string }) {
  const t = useTranslations();
  const { plannedJobSize: geplant, capacityJobSize: kapazitaet } = pi;
  if (geplant === 0 && kapazitaet == null) return null;

  const ueberbucht = kapazitaet != null && geplant > kapazitaet;
  return (
    <span
      className={`text-label tabular-nums ${ueberbucht ? "text-destructive" : "text-muted-foreground"} ${className}`}
      title={t("drumbeat.ui.jobSizeErklaerung")}
    >
      {kapazitaet == null
        ? t("drumbeat.ui.jobSizeKurz", { n: geplant })
        : t("drumbeat.ui.jobSizeVonKapazitaet", { n: geplant, kapazitaet })}
    </span>
  );
}
