"use client";

import { useState } from "react";
import { PeriodPicker } from "@/modules/core/goals/features/components/period-picker";
import { ToggleGroup } from "@/components/ui/toggle-group";

const INPUT =
  "h-9 w-full rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50";

/**
 * Umsetzungszeitraum-Feld im Editor: Umschalter **Raster** (kanonischer Bucket
 * FY/H1·H2/Q1–Q4 über den `PeriodPicker`) oder **Individuell** (Start–Ende als
 * `type=date`). Submittet je nach Modus `period` ODER `periodStart`/`periodEnd`;
 * die inaktiven Felder werden leer mitgesendet, damit die Gegenseite geleert wird.
 *
 * Im Modus **Individuell** sind beide Grenzen Pflicht: `goalTimeframe` verlangt
 * Start UND Ende, eine halbe Range ergäbe gar keinen Zeitraum (das Ziel fiele
 * stumm aus Roadmap, Filter und Pace-Linie). Einzige Ausnahme ist
 * `allowOpenEnd` — Budgeting rechnet dort ein fehlendes Ende serverseitig als
 * Start + 6 Monate.
 */
export function GoalPeriodField({
  defaultPeriod,
  defaultStart,
  defaultEnd,
  disabled,
  allowOpenEnd,
}: {
  defaultPeriod?: string | null;
  defaultStart?: string | null;
  defaultEnd?: string | null;
  disabled?: boolean;
  /** Erlaubt im Modus „Individuell" ein leeres Ende (Budgeting füllt es auf). */
  allowOpenEnd?: boolean;
}) {
  const [mode, setMode] = useState<"bucket" | "range">(
    defaultStart && defaultEnd ? "range" : "bucket",
  );
  const day = (iso?: string | null): string => (iso ? iso.slice(0, 10) : "");

  return (
    <div className="space-y-2">
      <ToggleGroup
        value={mode}
        onChange={setMode}
        ariaLabel="Zeitraum-Modus"
        className="bg-card text-[11px]"
        options={[
          { id: "bucket", label: "Raster" },
          { id: "range", label: "Individuell" },
        ]}
      />
      {mode === "bucket" ? (
        <>
          <PeriodPicker
            name="period"
            defaultValue={defaultPeriod ?? null}
            {...(disabled !== undefined ? { disabled } : {})}
          />
          <input type="hidden" name="periodStart" value="" />
          <input type="hidden" name="periodEnd" value="" />
        </>
      ) : (
        <>
          <input type="hidden" name="period" value="" />
          <div className="grid grid-cols-2 gap-2">
            <label className="block space-y-1">
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Start
              </span>
              <input
                type="date"
                name="periodStart"
                defaultValue={day(defaultStart)}
                disabled={disabled}
                required={!allowOpenEnd}
                className={INPUT}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Ende
              </span>
              <input
                type="date"
                name="periodEnd"
                defaultValue={day(defaultEnd)}
                disabled={disabled}
                required={!allowOpenEnd}
                className={INPUT}
              />
            </label>
          </div>
        </>
      )}
    </div>
  );
}
