"use client";

import { cn } from "@/lib/utils";

/**
 * Segmented toggle — the pill-row that several list-shell filter bars used to
 * inline (group + density toggles in impediments / dependencies / epics).
 * Pure render: takes `value` and an `options` array, calls `onChange` with the
 * next id. `aria-pressed` per option so screen readers see the segmented state.
 *
 * Keep this primitive small — if a caller needs different visuals (filled vs
 * outline, icons, vertical), pass through `className` rather than growing the
 * interface here.
 */
export interface ToggleGroupOption<T extends string> {
  id: T;
  label: string;
}

interface Props<T extends string> {
  value: T;
  options: ReadonlyArray<ToggleGroupOption<T>>;
  onChange: (next: T) => void;
  /** Optional override for the outer wrapper (e.g. vertical alignment). */
  className?: string;
  /** Accessible group label — rendered as `aria-label` on the wrapping role=group. */
  ariaLabel?: string;
}

export function ToggleGroup<T extends string>({
  value,
  options,
  onChange,
  className,
  ariaLabel,
}: Props<T>) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn("inline-flex overflow-hidden rounded-md border", className)}
    >
      {options.map((opt) => {
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            aria-pressed={active}
            className={cn(
              "px-2 py-1",
              active ? "bg-primary text-primary-foreground" : "hover:bg-muted/50",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
