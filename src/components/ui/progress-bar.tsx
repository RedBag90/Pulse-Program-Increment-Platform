import { cn } from "@/lib/utils";

type ProgressTone = "primary" | "emerald" | "amber" | "destructive";

const FILL: Record<ProgressTone, string> = {
  primary: "bg-primary",
  emerald: "bg-emerald-500",
  amber: "bg-amber-500",
  destructive: "bg-destructive",
};

/**
 * Thin (2px) editorial progress rule. `value` is 0–100; clamps out of range.
 */
export function ProgressBar({
  value,
  tone = "primary",
  className,
}: {
  value: number;
  tone?: ProgressTone;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("h-0.5 w-full bg-border", className)}>
      <div className={cn("h-full", FILL[tone])} style={{ width: `${pct}%` }} />
    </div>
  );
}
