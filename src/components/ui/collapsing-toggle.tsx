"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * **Ein Umschalter, der zugeklappt nur seinen aktiven Wert zeigt.**
 *
 * Eine Kopfleiste mit zwei vollen Optionsreihen ist überladen: elf Wörter
 * stehen da, zwei davon gelten. Diese Kachel zeigt das geltende und geht beim
 * Antippen auf — die anderen schieben sich daneben, man wählt, sie klappt zu.
 *
 * **Sie kennt keine Richtung, keine Sortierung, keine Achse.** Sie meldet nur,
 * welche Option angetippt wurde — auch die **bereits aktive**. Was das bedeutet,
 * entscheidet der Aufrufer: im Beitrags-Block dreht ein erneutes Antippen die
 * Sortierrichtung, genau wie der zweite Klick auf `ToggleGroup`.
 *
 * **Nicht `Segmented`** (das verlangt den Zustand in der URL und zeigt immer
 * alle Optionen) und **nicht `ToggleGroup`** (zeigt ebenfalls immer alle). Beide
 * bleiben, wie sie sind; wer alles sehen will, nimmt weiter sie.
 *
 * Die Breite wandert, statt zu springen — wer `prefers-reduced-motion` gesetzt
 * hat, bekommt den Wechsel ohne Übergang.
 */
export interface CollapsingToggleOption<T extends string> {
  id: T;
  /** Was auf der Kachel steht — knapp, es ist eine Kachel. */
  label: string;
  /**
   * Was eine Screenreaderin hört, wenn diese Option die aktive ist. Ohne das
   * läse sie „Plan Pfeil nach unten"; hier steht „Plan, absteigend".
   */
  srLabel?: string;
}

export function CollapsingToggle<T extends string>({
  value,
  options,
  onSelect,
  label,
  className,
}: {
  value: T;
  options: ReadonlyArray<CollapsingToggleOption<T>>;
  /** Feuert für **jede** Wahl, auch für die bereits aktive Option. */
  onSelect: (id: T) => void;
  /** Wofür der Schalter steht — „Sortiert nach". Trägt den zugänglichen Namen. */
  label: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  // Zu, sobald die Aufmerksamkeit woanders ist: Escape, ein Klick daneben. Den
  // Tastatur-Weg hinaus deckt `onBlur` unten ab.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onDown = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  return (
    <div
      ref={box}
      role="group"
      aria-label={label}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
      // Ohne eigenen Grund: die Kachel sitzt auf der Fläche, die sie trägt.
      // Rahmen + Radius + `bg-card` wären zusammen eine handgerollte Karte —
      // und das hier ist ein Bedienelement, keine Karte (ADR-0021).
      className={cn("inline-flex items-center overflow-hidden rounded-md border", className)}
    >
      {options.map((opt) => {
        const active = opt.id === value;
        const shown = open || active;
        return (
          <div
            key={opt.id}
            // Die Spalte wandert von 0fr auf 1fr — eine Breite, die sich
            // animieren lässt, ohne dass jemand sie vorher ausmessen muss.
            className={cn(
              "grid transition-[grid-template-columns] duration-200 ease-out motion-reduce:transition-none",
              shown ? "grid-cols-[1fr]" : "grid-cols-[0fr]",
            )}
          >
            <button
              type="button"
              // Zugeklappt sind die anderen weder erreichbar noch vorlesbar.
              // `inert` allein täte das im Browser; `tabIndex` und `aria-hidden`
              // stehen daneben, weil sonst nur der Browser die Zusage kennt und
              // keine Prüfung sie halten kann.
              inert={!shown}
              tabIndex={shown ? undefined : -1}
              aria-hidden={shown ? undefined : true}
              aria-pressed={open ? active : undefined}
              aria-expanded={active && !open ? false : undefined}
              aria-label={
                active && !open ? `${label}: ${opt.srLabel ?? opt.label} — ändern` : undefined
              }
              onClick={() => {
                if (!open) {
                  setOpen(true);
                  return;
                }
                onSelect(opt.id);
                setOpen(false);
              }}
              // Der Knopf selbst trägt **keine** Polsterung: ein Kasten mit
              // `width: 0` ist immer noch so breit wie sein Innenabstand, und
              // drei zugeklappte Optionen hinterliessen so eine Lücke.
              // **Gefüllt erst im aufgeklappten Zustand.** Zugeklappt steht die
              // aktive Option allein da — eine Hervorhebung ohne etwas, wovon
              // sie sich abhebt, wäre nur Farbe. Aufgeklappt trägt sie die
              // Auswahl, wie in `ToggleGroup`.
              className={cn(
                "min-w-0 overflow-hidden text-left",
                active && open
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground hover:bg-muted/50",
              )}
            >
              <span className="flex items-center gap-1 whitespace-nowrap px-2 py-1">
                {opt.label}
                {active && !open && <ChevronDown className="size-3 shrink-0" aria-hidden />}
              </span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
