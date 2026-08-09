"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  formatGoalPeriodKey,
  currentGoalPeriod,
  type PeriodGranularity,
} from "@/modules/core/goals/domain/goal-period";

/**
 * Mehrfach-Zeitraum-Filter in der strukturierten Optik des `PeriodPicker`
 * (Jahr-Stepper + Ganzjahr / H1·H2 / Q1–Q4), aber als Toggle-Auswahl über
 * beliebige Jahre. Erzeugt kanonische Keys (YYYY | YYYY-Hn | YYYY-Qn); der
 * Aufrufer hält die Auswahl als `Set` und schreibt sie als CSV in die URL.
 */
export function PeriodMultiSelect({
  selected,
  onToggle,
  onClear,
}: {
  selected: ReadonlySet<string>;
  onToggle: (key: string) => void;
  onClear: () => void;
}) {
  const [year, setYear] = useState<number>(currentGoalPeriod().year);
  const count = selected.size;

  function Cell({
    granularity,
    index,
    label,
    className,
  }: {
    granularity: PeriodGranularity;
    index: number | null;
    label: string;
    className?: string;
  }) {
    const key = formatGoalPeriodKey({ year, granularity, index });
    const on = selected.has(key);
    return (
      <button
        type="button"
        aria-pressed={on}
        onClick={() => onToggle(key)}
        className={cn(
          "rounded-md border px-2 py-1.5 text-sm hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          on && "border-primary bg-primary/10 text-foreground",
          className,
        )}
      >
        {label}
      </button>
    );
  }

  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          "inline-flex h-9 items-center gap-1.5 rounded-md border bg-card px-3 text-xs font-medium shadow-xs hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          count > 0 ? "border-primary/40 text-foreground" : "text-muted-foreground",
        )}
      >
        <span className="text-[11px] uppercase tracking-wide">Zeitraum</span>
        {count > 0 ? (
          <span className="grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold tabular-nums text-primary-foreground">
            {count}
          </span>
        ) : (
          <span className="text-muted-foreground/70">Alle</span>
        )}
        <ChevronDown className="size-3.5 opacity-60" aria-hidden />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 gap-2 p-2.5">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setYear((y) => y - 1)}
            aria-label="Jahr zurück"
            className="grid size-7 place-items-center rounded-md border hover:bg-muted"
          >
            ‹
          </button>
          <span className="text-sm font-semibold tabular-nums">{year}</span>
          <button
            type="button"
            onClick={() => setYear((y) => y + 1)}
            aria-label="Jahr vor"
            className="grid size-7 place-items-center rounded-md border hover:bg-muted"
          >
            ›
          </button>
        </div>

        <Cell
          granularity="year"
          index={null}
          label={`Ganzjahr FY${String(year).slice(2)}`}
          className="w-full text-left font-medium"
        />

        <div className="grid grid-cols-2 gap-1.5">
          <Cell granularity="half" index={1} label="H1" />
          <Cell granularity="half" index={2} label="H2" />
        </div>

        <div className="grid grid-cols-4 gap-1.5">
          <Cell granularity="quarter" index={1} label="Q1" />
          <Cell granularity="quarter" index={2} label="Q2" />
          <Cell granularity="quarter" index={3} label="Q3" />
          <Cell granularity="quarter" index={4} label="Q4" />
        </div>

        {count > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="w-full rounded-md px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          >
            Zurücksetzen
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
