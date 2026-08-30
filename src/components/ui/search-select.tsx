"use client";

import { useId, useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Einfachauswahl mit Suchfeld — für Listen, die zu lang für ein `<select>` sind.
 *
 * Ein natives `<select>` zwingt zum Scrollen durch alles; sobald ein Mandant
 * mehr als eine Handvoll Personen hat, ist das keine Auswahl mehr, sondern eine
 * Suche ohne Suchfeld. Diese Komponente tippt statt scrollt.
 *
 * Bewusst **ohne** das Popover-Primitive: das portaliert über Base UI und
 * verlangt in jsdom Polyfills, die das Test-Setup nicht mitbringt. Hier genügt
 * ein absolut positioniertes Feld unter dem Auslöser — dafür ist die Auswahl in
 * Tests vollständig bedienbar, Tastatur eingeschlossen.
 *
 * Rein präsentational, wie `MultiSelectFilter`: der Wert gehört dem Aufrufer.
 */

export interface SearchSelectOption {
  value: string;
  label: string;
  /** Zusatz zur Unterscheidung (z. B. Rollen); wird mitdurchsucht. */
  hint?: string;
}

interface Props {
  /** Leerstring = nichts gewählt. */
  value: string;
  onChange: (value: string) => void;
  options: ReadonlyArray<SearchSelectOption>;
  /** Beschriftung des Leerwerts. Fehlt sie, ist der Leerwert nicht wählbar. */
  emptyLabel?: string;
  /** Text im Auslöser, solange nichts gewählt ist. */
  placeholder: string;
  searchPlaceholder?: string;
  ariaLabel: string;
  disabled?: boolean;
  className?: string;
}

function matches(opt: SearchSelectOption, needle: string): boolean {
  if (needle === "") return true;
  const hay = `${opt.label} ${opt.hint ?? ""}`.toLowerCase();
  return hay.includes(needle);
}

export function SearchSelect({
  value,
  onChange,
  options,
  emptyLabel,
  placeholder,
  searchPlaceholder = "Suchen …",
  ariaLabel,
  disabled,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);

  const selected = options.find((o) => o.value === value) ?? null;

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const hits = options.filter((o) => matches(o, needle));
    // Der Leerwert bleibt oben und wird nur bei leerer Suche angeboten — wer
    // tippt, sucht eine Person, nicht das Entfernen.
    return emptyLabel !== undefined && needle === ""
      ? [{ value: "", label: emptyLabel }, ...hits]
      : hits;
  }, [options, query, emptyLabel]);

  function close() {
    setOpen(false);
    setQuery("");
    setActive(0);
  }

  function choose(next: string) {
    onChange(next);
    close();
    triggerRef.current?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (visible.length === 0) return;
      const delta = e.key === "ArrowDown" ? 1 : -1;
      setActive((i) => (i + delta + visible.length) % visible.length);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const opt = visible[active];
      if (opt) choose(opt.value);
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      close();
      triggerRef.current?.focus();
    }
  }

  return (
    <div
      className={cn("relative", className)}
      // Verlässt der Fokus die Gruppe ganz, schließt das Feld — ein Klick
      // *innerhalb* (Option, Suchfeld) darf das nicht auslösen. Ob ein Klick
      // als „innerhalb" erkannt wird, hängt daran, dass der Fokus überhaupt auf
      // die Option wandert — deshalb verhindern die Optionen den Fokuswechsel
      // gleich ganz (siehe `onMouseDown` unten).
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) close();
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 rounded-md border border-input bg-card py-1.5 pl-2.5 pr-2 text-left text-sm shadow-xs hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
      >
        <span className={cn("truncate", !selected && "text-muted-foreground")}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-full min-w-56 rounded-lg border bg-popover p-1.5 shadow-md">
          <div className="relative mb-1">
            <Search
              className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <input
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={onKeyDown}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              aria-controls={listId}
              className="w-full rounded-md border border-input bg-background py-1 pl-7 pr-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <ul
            id={listId}
            role="listbox"
            aria-label={ariaLabel}
            className="max-h-64 overflow-y-auto"
          >
            {visible.length === 0 ? (
              <li className="px-2 py-1.5 text-sm text-muted-foreground">Keine Treffer.</li>
            ) : (
              visible.map((opt, i) => {
                const on = opt.value === value;
                return (
                  <li key={opt.value || "__empty"}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={on}
                      onMouseEnter={() => setActive(i)}
                      // Den Fokuswechsel unterbinden, statt ihn abzufangen.
                      //
                      // Safari fokussiert `<button>` beim Klicken nicht (macOS-
                      // Standard, solange „Vollständiger Tastaturzugriff" aus
                      // ist). Der Blur des Suchfelds kam dort also mit
                      // `relatedTarget === null` an, die Gruppen-Prüfung oben
                      // hielt das für „Fokus hat die Gruppe verlassen", schloss
                      // die Liste — und der `click` landete nie auf einer
                      // Option. Jede Personen-Auswahl war in Safari damit
                      // unbedienbar, in Chrome und in jsdom dagegen einwandfrei.
                      //
                      // `preventDefault` auf `mousedown` lässt den Fokus im
                      // Suchfeld: kein Blur, kein Schließen, der Klick kommt an.
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => choose(opt.value)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm",
                        i === active && "bg-muted/60",
                      )}
                    >
                      <Check
                        className={cn("size-3.5 shrink-0", on ? "opacity-100" : "opacity-0")}
                        aria-hidden
                      />
                      <span className="truncate">{opt.label}</span>
                      {opt.hint && (
                        <span className="ml-auto shrink-0 truncate text-xs text-muted-foreground">
                          {opt.hint}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
