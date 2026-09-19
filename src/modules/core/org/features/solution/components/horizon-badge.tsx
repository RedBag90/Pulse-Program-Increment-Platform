"use client";

import { HORIZON_HELP, horizonLabel, isHorizon } from "@/modules/core/org/domain/horizon";
import { HORIZON_BADGE_CLASS } from "@/modules/core/org/features/solution/components/horizon-tokens";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const NONE_CLASS = { pill: "bg-muted text-muted-foreground", dot: "bg-muted-foreground/50" };

/**
 * Horizont-Badge (Pill + Punkt). `withHelp` hängt einen Erklär-Tooltip an
 * (Helfer-Schicht: Bedeutung + typische Epic-Art). `horizon = null` → „Ohne".
 */
export function HorizonBadge({
  horizon,
  investmentMode,
  withHelp = false,
  short = false,
  className,
}: {
  horizon: string | null;
  /** Nur in H1 relevant: „extracting" ⇒ Label „H1 · Extracting" (gleiche H1-Farbe). */
  investmentMode?: string | null;
  withHelp?: boolean;
  /**
   * Nur die Stufe — `H3` statt `H3 · R&D`.
   *
   * Für schmale Spalten: der ausgeschriebene Name bricht dort auf zwei Zeilen
   * um, und die Stufe allein trägt die Auskunft. Die Stufe wird aus dem
   * Horizont selbst gebildet, nicht aus einer zweiten Etikettenliste, die
   * neben `HORIZON_LABEL` veralten könnte.
   */
  short?: boolean;
  className?: string;
}) {
  const h = isHorizon(horizon) ? horizon : null;
  const style = h ? HORIZON_BADGE_CLASS[h] : NONE_CLASS;
  // Die Regel „H1 zerfällt in Investing/Extracting" steht in der Domäne, nicht
  // hier — der Organisations-Baum beschriftet seine Solution-Zeilen aus
  // derselben Quelle.
  const label = h ? (short ? h.toUpperCase() : horizonLabel(h, investmentMode)) : "Ohne";

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
