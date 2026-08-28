"use client";

import { useState } from "react";
import { SearchSelect, type SearchSelectOption } from "@/components/ui/search-select";

/**
 * Personen-Auswahl mit Suchfeld — der eine Weg, eine Person zu wählen.
 *
 * Kapselt {@link SearchSelect} plus die zwei Dinge, die jede Personen-Auswahl
 * sonst wiederholt: das Bauen der Optionen bleibt beim Aufrufer (`options`), aber
 * die **Form-Anbindung** (ein gespiegeltes `<input type="hidden" name=…>`, damit
 * der Wert in einem nativen `<form action=…>` mitgeschickt wird) und die
 * **State-Haltung** liegen hier.
 *
 * Zwei Betriebsarten:
 *  - **controlled** (`value` + `onChange`): der Aufrufer hält den Wert und baut
 *    daraus z. B. per onChange sein FormData — für Actions, die on-change feuern.
 *  - **uncontrolled + Form** (`defaultValue` + `name`): interner State plus
 *    Hidden-Input; der Wert reist mit dem umgebenden `<form>`.
 */
export interface UserPickerProps {
  options: ReadonlyArray<SearchSelectOption>;
  ariaLabel: string;
  placeholder?: string;
  /** Beschriftung des Leerwerts (Clear). Fehlt sie, ist „nichts" nicht wählbar. */
  emptyLabel?: string;
  disabled?: boolean;
  className?: string;
  /** Controlled-Modus. */
  value?: string;
  onChange?: (value: string) => void;
  /** Form-Modus: rendert ein Hidden-Input mit diesem `name`. */
  name?: string;
  defaultValue?: string;
}

export function UserPicker({
  options,
  ariaLabel,
  placeholder = "Person wählen …",
  emptyLabel,
  disabled,
  className,
  value,
  onChange,
  name,
  defaultValue,
}: UserPickerProps) {
  const controlled = value !== undefined;
  const [internal, setInternal] = useState(defaultValue ?? "");
  const current = controlled ? value : internal;

  const set = (next: string) => {
    if (!controlled) setInternal(next);
    onChange?.(next);
  };

  return (
    <>
      {name !== undefined && <input type="hidden" name={name} value={current} />}
      <SearchSelect
        value={current}
        onChange={set}
        options={options}
        {...(emptyLabel !== undefined ? { emptyLabel } : {})}
        placeholder={placeholder}
        ariaLabel={ariaLabel}
        {...(disabled !== undefined ? { disabled } : {})}
        {...(className !== undefined ? { className } : {})}
      />
    </>
  );
}
