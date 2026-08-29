"use client";

import { useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface MultiSelectOption {
  value: string;
  label: string;
  /** Optionaler Farbpunkt (z. B. Status-Tier-Hex). */
  color?: string;
}

export interface MultiSelectSection {
  /** Gruppen-Überschrift; ohne Heading = flache Liste. */
  heading?: string;
  options: MultiSelectOption[];
}

/**
 * Generischer Mehrfachauswahl-Filter: ein Popover-Trigger (Label + Zähler-Badge)
 * über einer Checkbox-Liste, optional gruppiert mit „alle/keine" je Gruppe. Rein
 * präsentational — Auswahl-Set + Callbacks kommen vom Aufrufer (URL-State).
 * `searchable` blendet ein Suchfeld ein, das die Optionen auf Label-Match
 * filtert; die „alle/keine"-Schnellwahl wirkt dann auf die gefilterte Teilmenge.
 */
export function MultiSelectFilter({
  label,
  sections,
  selected,
  onToggle,
  onToggleSection,
  onClear,
  disabled,
  searchable,
}: {
  label: string;
  sections: MultiSelectSection[];
  selected: ReadonlySet<string>;
  onToggle: (value: string) => void;
  /** Ganze Gruppe an/aus (für die „alle/keine"-Schnellwahl). */
  onToggleSection?: (values: string[], on: boolean) => void;
  onClear: () => void;
  disabled?: boolean;
  /** Suchfeld über der Liste — für lange Optionslisten (z. B. alle Epics). */
  searchable?: boolean;
}) {
  const count = selected.size;
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const visibleSections =
    searchable && needle !== ""
      ? sections.map((s) => ({
          ...s,
          options: s.options.filter((o) => o.label.toLowerCase().includes(needle)),
        }))
      : sections;
  return (
    <Popover>
      <PopoverTrigger
        disabled={disabled}
        className={cn(
          "inline-flex h-9 items-center gap-1.5 rounded-md border bg-card px-3 text-xs font-medium shadow-xs hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
          count > 0 ? "border-primary/40 text-foreground" : "text-muted-foreground",
        )}
      >
        <span className="text-[11px] uppercase tracking-wide">{label}</span>
        {count > 0 ? (
          <span className="grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold tabular-nums text-primary-foreground">
            {count}
          </span>
        ) : (
          <span className="text-muted-foreground/70">Alle</span>
        )}
        <ChevronDown className="size-3.5 opacity-60" aria-hidden />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 gap-1 p-1.5">
        {searchable && (
          <div className="relative pb-1">
            <Search
              className="absolute left-2 top-[13px] size-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Suchen…"
              aria-label={`${label} durchsuchen`}
              className="h-7 w-full rounded-md border border-input bg-transparent pl-7 pr-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        )}
        <div className="max-h-96 overflow-y-auto">
          {visibleSections.map((section, si) => {
            const values = section.options.map((o) => o.value);
            const allOn = values.length > 0 && values.every((v) => selected.has(v));
            return (
              <div
                key={section.heading ?? si}
                className={cn("py-0.5", !section.heading && si > 0 && "mt-1 border-t pt-1.5")}
              >
                {section.heading && (
                  <div className="flex items-center justify-between px-2 pb-1 pt-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                      {section.heading}
                    </span>
                    {onToggleSection && values.length > 0 && (
                      <button
                        type="button"
                        onClick={() => onToggleSection(values, !allOn)}
                        className="text-[11px] font-medium text-primary hover:underline"
                      >
                        {allOn ? "keine" : "alle"}
                      </button>
                    )}
                  </div>
                )}
                {section.options.length === 0 ? (
                  <p className="px-2 py-1 text-xs text-muted-foreground">Keine Optionen.</p>
                ) : (
                  section.options.map((opt) => {
                    const on = selected.has(opt.value);
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        role="checkbox"
                        aria-checked={on}
                        onClick={() => onToggle(opt.value)}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted/60"
                      >
                        <span
                          className={cn(
                            "grid size-4 shrink-0 place-items-center rounded border",
                            on
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-input",
                          )}
                        >
                          {on && <Check className="size-3" aria-hidden />}
                        </span>
                        {opt.color && (
                          <span
                            className="size-2 shrink-0 rounded-full"
                            style={{ backgroundColor: opt.color }}
                            aria-hidden
                          />
                        )}
                        <span className="truncate">{opt.label}</span>
                      </button>
                    );
                  })
                )}
              </div>
            );
          })}
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
