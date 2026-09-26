"use client";

import { useLocale, useTranslations } from "next-intl";
import type { CockpitPiSlot } from "@/modules/drumbeat/domain/cockpit-types";
import { TARGET_FACTOR } from "@/modules/drumbeat/domain/pi-job-size-target";

/**
 * **Wie viel Arbeit steckt in diesem PI — gegen welches Ziel?**
 *
 * Mit errechnetem Ziel steht die Summe **gegen** es („18 / 25 JS"), und eine
 * Überplanung färbt sich. Ohne Ziel steht nur die Summe da — eine Grenze zu
 * behaupten, die sich nicht herleiten lässt, wäre schlimmer als keine.
 *
 * Das Ziel ist seit September 2026 keine Eingabe mehr, sondern die Formel aus
 * `deriveJobSizeTarget`; `PiTargetDerivation` daneben zeigt, woraus es
 * entsteht.
 *
 * Ist gar nichts bewertet und kein Ziel da, steht nichts: eine „0 JS" unter
 * jedem PI wäre Rauschen, kein Signal.
 */
export function PiJobSize({ pi, className = "" }: { pi: CockpitPiSlot; className?: string }) {
  const t = useTranslations();
  const geplant = pi.plannedJobSize;
  const ziel = pi.jobSizeTarget?.target ?? null;
  if (geplant === 0 && ziel == null) return null;

  const ueberplant = ziel != null && geplant > ziel;
  return (
    <span
      className={`text-label tabular-nums ${ueberplant ? "text-destructive" : "text-muted-foreground"} ${className}`}
      title={t(
        ziel == null ? "drumbeat.ui.jobSizeErklaerung" : "drumbeat.ui.jobSizeErklaerungMitZiel",
      )}
    >
      {ziel == null
        ? t("drumbeat.ui.jobSizeKurz", { n: geplant })
        : t("drumbeat.ui.jobSizeVonZiel", { n: geplant, ziel })}
    </span>
  );
}

/**
 * **Die Rechnung hinter dem Ziel, in einer Zeile** — damit die Zahl
 * nachrechenbar ist, statt geglaubt werden zu müssen.
 *
 * „Ziel 99 JS = Ø 12,4 JS je Kapazität (4 PIs) × 10 × 0,8". Die Vorgänger mit
 * ihrer Quote stehen im Tooltip. Fehlt ein Eingang, sagt die Zeile, welcher.
 *
 * Bei einem abgeschlossenen PI steht zusätzlich seine **eigene** Quote — das
 * ist der Wert, mit dem es in die Ziele der folgenden PIs eingeht.
 */
export function PiTargetDerivation({ pi }: { pi: CockpitPiSlot }) {
  const t = useTranslations();
  const locale = useLocale();
  const target = pi.jobSizeTarget;
  if (target == null) return null;

  const zahl = (n: number, stellen = 1) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: stellen }).format(n);

  const basisZeilen = target.basis
    .map((b) =>
      t("drumbeat.ui.zielBasisZeile", {
        name: b.name,
        geliefert: zahl(b.delivered, 0),
        kapazitaet: zahl(b.capacity, 2),
        quote: zahl(b.ratio),
      }),
    )
    .join("\n");

  const zeile =
    target.reason === "noCapacity"
      ? t("drumbeat.ui.zielOhneKapazitaet")
      : target.reason === "noHistory"
        ? t("drumbeat.ui.zielOhneHistorie")
        : t(
            target.basis.length === 1
              ? "drumbeat.ui.zielHerleitungEinPi"
              : "drumbeat.ui.zielHerleitung",
            {
              ziel: target.target ?? 0,
              quote: zahl(target.perCapacity ?? 0),
              n: target.basis.length,
              kapazitaet: zahl(pi.capacity ?? 0, 2),
              faktor: zahl(TARGET_FACTOR),
            },
          );

  return (
    <span className="flex flex-wrap items-center gap-x-3 text-label text-muted-foreground">
      <span className="tabular-nums" title={basisZeilen || undefined}>
        {zeile}
      </span>
      {pi.deliveredPerCapacity != null && (
        <span className="tabular-nums">
          {t("drumbeat.ui.gelieferteQuote", { quote: zahl(pi.deliveredPerCapacity) })}
        </span>
      )}
    </span>
  );
}
