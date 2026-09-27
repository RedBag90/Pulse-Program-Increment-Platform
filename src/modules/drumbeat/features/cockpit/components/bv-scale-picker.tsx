"use client";

import { BV_SCALE } from "@/modules/drumbeat/domain/pi-feedback";
import { cn } from "@/lib/utils";

/**
 * **Business Value auf der WSJF-Skala wählen** — eine Reihe Knöpfe statt eines
 * Dropdowns, damit der Plan-Wert (gestrichelt) und die Wahl nebeneinander
 * sichtbar sind.
 */
export function BvScalePicker({
  value,
  plan,
  onChange,
  label,
  disabled = false,
}: {
  value: number | null;
  /** Der geplante Wert — gestrichelt markiert, solange er nicht gewählt ist. */
  plan: number | null;
  onChange: (v: number) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {BV_SCALE.map((v) => {
        const on = value === v;
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={disabled}
            onClick={() => onChange(v)}
            className={cn(
              "h-10 w-10 rounded-md border text-sm tabular-nums transition-colors disabled:opacity-60",
              on
                ? "border-foreground bg-foreground font-semibold text-background"
                : v === plan
                  ? "border-dashed border-muted-foreground bg-background hover:bg-muted"
                  : "border-input bg-background text-muted-foreground hover:bg-muted",
            )}
          >
            {v}
          </button>
        );
      })}
    </div>
  );
}
