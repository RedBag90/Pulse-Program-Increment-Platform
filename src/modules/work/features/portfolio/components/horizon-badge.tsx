"use client";

import {
  HORIZON_LABEL,
  HORIZON_HELP,
  isHorizon,
  type Horizon,
} from "@/modules/work/domain/portfolio-guardrails";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * Farbklassen je Horizont — Punkt + weicher Hintergrund (Anzeige-Konsistenz).
 *
 * **Die Töne sind nach Nähe zur Wertschöpfung geordnet**, nicht nach Laune:
 * violett (fern, erkundend) → türkis (wachsend) → orange (der Kern, wo das Geld
 * liegt) → steingrau (im Abgang). Vorher standen hier Fuchsia, Violett, Blau
 * und Schiefer — drei Einwände dagegen, alle nachprüfbar:
 *
 *  1. Fuchsia und Violett sind Nachbartöne und bei Symbolgröße im
 *     Horizont-Trichter kaum zu unterscheiden — ausgerechnet bei den beiden
 *     Bahnen mit den vielen kleinen Posten.
 *  2. H1 trug das **Primärblau** der Anwendung. Links und Schaltflächen sind
 *     blau; der Kern-Horizont sah dadurch aus wie Bedienelement, nicht wie
 *     Inhalt.
 *  3. Die vier Töne hatten keine Reihenfolge, obwohl die Sache eine hat.
 */
export const HORIZON_BADGE_CLASS: Record<Horizon, { pill: string; dot: string }> = {
  h3: {
    pill: "bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
    dot: "bg-violet-600",
  },
  h2: {
    pill: "bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300",
    dot: "bg-teal-600",
  },
  h1: {
    pill: "bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
    dot: "bg-orange-600",
  },
  h0: {
    pill: "bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300",
    dot: "bg-stone-500",
  },
};

/**
 * Dieselben Toene als Farbwert — Balken, Quadrate und SVG koennen keine
 * Tailwind-Klasse tragen. Steht bewusst neben `HORIZON_BADGE_CLASS`, damit die
 * zwei Definitionen desselben Farbraums nicht auseinanderlaufen.
 */
export const HORIZON_HEX: Record<Horizon, string> = {
  h3: "#7c3aed", // violet-600 — fern, erkundend
  h2: "#0d9488", // teal-600 — wachsend
  h1: "#ea580c", // orange-600 — der Kern, wo das Geld liegt
  h0: "#78716c", // stone-500 — entsättigt, im Abgang
};

/**
 * „Ohne Horizont" — der Neutralton für alles, was (noch) nirgends steht.
 * Bewusst ein reines Grau: es soll sich keiner Bahn zuordnen lassen.
 */
export const HORIZON_NONE_HEX = "#a1a1aa"; // zinc-400

const NONE_CLASS = { pill: "bg-muted text-muted-foreground", dot: "bg-muted-foreground/50" };

/**
 * Horizont-Badge (Pill + Punkt). `withHelp` hängt einen Erklär-Tooltip an
 * (Helfer-Schicht: Bedeutung + typische Epic-Art). `horizon = null` → „Ohne".
 */
export function HorizonBadge({
  horizon,
  investmentMode,
  withHelp = false,
  className,
}: {
  horizon: string | null;
  /** Nur in H1 relevant: „extracting" ⇒ Label „H1 · Extracting" (gleiche H1-Farbe). */
  investmentMode?: string | null;
  withHelp?: boolean;
  className?: string;
}) {
  const h = isHorizon(horizon) ? horizon : null;
  const style = h ? HORIZON_BADGE_CLASS[h] : NONE_CLASS;
  const label = h
    ? h === "h1" && investmentMode === "extracting"
      ? "H1 · Extracting"
      : HORIZON_LABEL[h]
    : "Ohne";

  const pill = (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        style.pill,
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", style.dot)} />
      {label}
    </span>
  );

  if (!withHelp || !h) return pill;

  const help = HORIZON_HELP[h];
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger render={<span className="cursor-help" />}>{pill}</TooltipTrigger>
        <TooltipContent className="max-w-xs flex-col items-start gap-1 text-left">
          <span className="font-medium">{label}</span>
          <span>{help.blurb}</span>
          <span className="opacity-80">Epics: {help.epicArt}</span>
          <span className="opacity-80">Budget: {help.budgetFokus}</span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
