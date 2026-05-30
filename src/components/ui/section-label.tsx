import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * Editorial micro-label — the tiny uppercase, letter-spaced heading used over
 * sections, KPI cells, and table columns. One source of truth for the
 * print-inspired label style.
 */
export function SectionLabel({ className, ...props }: ComponentProps<"h2">) {
  return (
    <h2
      className={cn(
        "text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}
