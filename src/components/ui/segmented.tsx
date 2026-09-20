"use client";

import { cn } from "@/lib/utils";

/**
 * Ein Umschalter zwischen wenigen, gleichrangigen Darstellungen — „Karte |
 * Tabelle", „nach Struktur | nach Horizont".
 *
 * Er stand in der Werkzeugleiste der Organisations-Fläche; mit der
 * Rollenverteilung wäre er zum zweiten Mal dagewesen. Zwei Kopien desselben
 * Bedienelements laufen auseinander, sobald jemand eine davon anfasst — und
 * zwei Struktur-Flächen, die sich verschieden bedienen, sind schlimmer als eine
 * hässliche.
 *
 * **Kein Zustand hier.** Wer ihn einsetzt, hält den Wert in der URL: Lesezeichen
 * und der Zurück-Knopf des Browsers hängen daran.
 */
export function Segmented<T extends string>({
  label,
  options,
  active,
  onSelect,
  className,
}: {
  /** Für die Zuordnung durch Hilfsmittel — „Darstellung", „Gruppierung". */
  label: string;
  options: readonly { value: T; label: string }[];
  active: T;
  onSelect: (value: T) => void;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn("inline-flex rounded-lg bg-muted p-0.5", className)}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onSelect(o.value)}
          aria-pressed={o.value === active}
          className={cn(
            "rounded-[0.4rem] px-3 py-1 text-xs transition-colors",
            "focus-visible:outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
            o.value === active
              ? "bg-card font-semibold text-foreground shadow-card"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
