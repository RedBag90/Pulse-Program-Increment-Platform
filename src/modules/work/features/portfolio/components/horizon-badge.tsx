"use client";

import {
  HORIZON_LABEL,
  HORIZON_HELP,
  isHorizon,
  type Horizon,
} from "@/modules/work/domain/portfolio-guardrails";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/** Farbklassen je Horizont — Punkt + weicher Hintergrund (Anzeige-Konsistenz). */
export const HORIZON_BADGE_CLASS: Record<Horizon, { pill: string; dot: string }> = {
  h3: {
    pill: "bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-950 dark:text-fuchsia-300",
    dot: "bg-fuchsia-500",
  },
  h2: {
    pill: "bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
    dot: "bg-violet-500",
  },
  h1: { pill: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300", dot: "bg-blue-500" },
  h0: {
    pill: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    dot: "bg-slate-500",
  },
};

/**
 * Dieselben Toene als Farbwert — Balken, Quadrate und SVG koennen keine
 * Tailwind-Klasse tragen. Steht bewusst neben `HORIZON_BADGE_CLASS`, damit die
 * zwei Definitionen desselben Farbraums nicht auseinanderlaufen.
 */
export const HORIZON_HEX: Record<Horizon, string> = {
  h3: "#d946ef", // fuchsia-500
  h2: "#8b5cf6", // violet-500
  h1: "#3b82f6", // blue-500
  h0: "#64748b", // slate-500
};

/** „Ohne Horizont" — teilt sich den Neutralton mit `PLAN_GREY` (chart-theme). */
export const HORIZON_NONE_HEX = "#94a3b8";

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
