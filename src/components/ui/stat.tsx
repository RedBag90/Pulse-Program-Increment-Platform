import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type DeltaTone = "up" | "down" | "flat";

const DELTA_TONE: Record<DeltaTone, string> = {
  up: "text-emerald-600 dark:text-emerald-400",
  down: "text-destructive",
  flat: "text-muted-foreground",
};

export interface StatProps {
  label: string;
  value: ReactNode;
  /** Optional secondary line (e.g. a delta or note), tone-coloured. */
  delta?: { tone: DeltaTone; text: string };
  /** Override the value colour (e.g. destructive for an impediment count). */
  valueClassName?: string;
  className?: string;
}

/**
 * A single editorial KPI cell: micro-label + large light monospace numeral +
 * optional tinted delta line. Pure/presentational. Use inside {@link StatStrip}.
 */
export function Stat({ label, value, delta, valueClassName, className }: StatProps) {
  return (
    <div className={cn("min-w-0 flex-1 px-4 py-3.5", className)}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-1.5 font-mono text-2xl font-light leading-none tabular-nums",
          valueClassName,
        )}
      >
        {value}
      </p>
      {delta && (
        <p className={cn("mt-1.5 font-mono text-[11px]", DELTA_TONE[delta.tone])}>{delta.text}</p>
      )}
    </div>
  );
}

/**
 * The bordered KPI strip — a single hairline-divided row of {@link Stat}s.
 * Replaces stacked metric cards in the editorial language.
 */
export function StatStrip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex divide-x divide-border overflow-hidden rounded-lg border", className)}>
      {children}
    </div>
  );
}
