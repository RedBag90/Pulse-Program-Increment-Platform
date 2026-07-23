"use client";

import { useEffect, useRef, useState } from "react";
import {
  parseGoalPeriod,
  formatGoalPeriodKey,
  goalPeriodLabel,
  goalPeriodDateLabel,
  currentGoalPeriod,
  type GoalPeriod,
  type PeriodGranularity,
} from "@/domain/goal-period";

interface Props {
  /** FormData-Feldname; ein Hidden-Input trägt den kanonischen Key. */
  name: string;
  defaultValue: string | null;
  disabled?: boolean;
}

/**
 * Strukturierter Zeitraum-Picker (Asana-Stil): Jahr-Stepper + Ganzjahr / H1·H2 /
 * Q1–Q4. Erzeugt ausschließlich kanonische Keys (YYYY | YYYY-Hn | YYYY-Qn) und
 * spiegelt sie in ein Hidden-Input, damit unkontrollierte Formulare unverändert
 * submitten. Leerer Wert = kein Zeitraum (Backlog).
 */
export function PeriodPicker({ name, defaultValue, disabled }: Props) {
  const [value, setValue] = useState<string>(defaultValue ?? "");
  const [open, setOpen] = useState(false);
  const parsed = value ? parseGoalPeriod(value) : null;
  const [viewYear, setViewYear] = useState<number>(parsed?.year ?? currentGoalPeriod().year);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function pick(granularity: PeriodGranularity, index: number | null) {
    const p: GoalPeriod = { year: viewYear, granularity, index };
    setValue(formatGoalPeriodKey(p));
    setOpen(false);
  }

  function clear() {
    setValue("");
    setOpen(false);
  }

  function isActive(granularity: PeriodGranularity, index: number | null): boolean {
    return (
      parsed?.granularity === granularity && parsed.index === index && parsed.year === viewYear
    );
  }

  const cell =
    "rounded-md border px-2 py-1.5 text-sm hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50";
  const cellActive = "border-primary bg-primary/10 text-foreground";

  return (
    <div className="relative" ref={rootRef}>
      <input type="hidden" name={name} value={value} />
      <button
        type="button"
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-2 text-left text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
      >
        {value ? (
          <span className="flex items-baseline gap-2">
            <span className="font-medium">{goalPeriodLabel(value)}</span>
            <span className="text-[11px] text-muted-foreground">{goalPeriodDateLabel(value)}</span>
          </span>
        ) : (
          <span className="text-muted-foreground">Kein Zeitraum</span>
        )}
        <span aria-hidden className="text-muted-foreground">
          ▾
        </span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Zeitraum wählen"
          className="absolute z-50 mt-1 w-64 space-y-2 rounded-lg border bg-popover p-2 shadow-md"
        >
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setViewYear((y) => y - 1)}
              aria-label="Jahr zurück"
              className="grid size-7 place-items-center rounded-md border hover:bg-muted"
            >
              ‹
            </button>
            <span className="text-sm font-semibold tabular-nums">{viewYear}</span>
            <button
              type="button"
              onClick={() => setViewYear((y) => y + 1)}
              aria-label="Jahr vor"
              className="grid size-7 place-items-center rounded-md border hover:bg-muted"
            >
              ›
            </button>
          </div>

          <button
            type="button"
            onClick={() => pick("year", null)}
            className={`${cell} w-full text-left ${isActive("year", null) ? cellActive : ""}`}
          >
            <span className="font-medium">Ganzjahr FY{String(viewYear).slice(2)}</span>
            <span className="ml-2 text-[11px] text-muted-foreground">Jan – Dez</span>
          </button>

          <div className="grid grid-cols-2 gap-1.5">
            {[1, 2].map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => pick("half", h)}
                className={`${cell} ${isActive("half", h) ? cellActive : ""}`}
              >
                H{h}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-4 gap-1.5">
            {[1, 2, 3, 4].map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => pick("quarter", q)}
                className={`${cell} ${isActive("quarter", q) ? cellActive : ""}`}
              >
                Q{q}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={clear}
            className="w-full rounded-md px-2 py-1 text-left text-xs text-muted-foreground hover:bg-muted"
          >
            Kein Zeitraum
          </button>
        </div>
      )}
    </div>
  );
}
