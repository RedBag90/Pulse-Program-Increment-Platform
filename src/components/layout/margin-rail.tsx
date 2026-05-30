import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type NoteTone = "muted" | "amber" | "destructive";

const ACCENT: Record<NoteTone, string> = {
  muted: "border-border",
  amber: "border-amber-400",
  destructive: "border-destructive",
};

/**
 * Editorial "margin" rail — a slim right-hand column for contextual notes /
 * alerts alongside the main content. Stacks above the content on narrow screens.
 */
export function MarginRail({ children, className }: { children: ReactNode; className?: string }) {
  return <aside className={cn("w-full shrink-0 space-y-3 lg:w-56", className)}>{children}</aside>;
}

/**
 * A single margin note: a left rule + optional micro-label + body. Tone tints
 * the rule for severity (amber = attention, destructive = blocking).
 */
export function MarginNote({
  label,
  tone = "muted",
  children,
}: {
  label?: string;
  tone?: NoteTone;
  children: ReactNode;
}) {
  return (
    <div className={cn("border-l-2 pl-3", ACCENT[tone])}>
      {label && (
        <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {label}
        </p>
      )}
      <div className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{children}</div>
    </div>
  );
}
