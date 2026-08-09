"use client";

import type { ReactNode } from "react";

/**
 * Ein Eintrag einer Verknüpfungs-Liste (Chip) mit Entfernen-Affordance.
 */
export interface LinkChip {
  key: string;
  /** Primär-Label; als Link, wenn `href` gesetzt ist. */
  label: ReactNode;
  href?: string | undefined;
  /** Kleiner Uppercase-Untertitel (nur `row`-Variante). */
  subtitle?: ReactNode;
  /** Nachlaufender Inhalt vor dem ✕ (nur `row`-Variante), z. B. €-Trio. */
  trailing?: ReactNode;
  /** aria-label des Entfernen-Buttons. */
  removeLabel: string;
}

/**
 * Wiederverwendbarer **Verknüpfungs-Listen-Rahmen**: Leer-Zustand, Chip-Liste und
 * die Entfernen-Affordance — die eine Stelle, an der „Chips + ✕" lebt. Der
 * Hinzufügen-Picker variiert je Verknüpfungstyp und wird als `children` gereicht;
 * das Verknüpfen/Entfernen (FormData + Action) bleibt beim Aufrufer. Zwei Stile:
 * `row` (gerahmte Zeilen mit Titel/Untertitel) und `pill` (kompakte Flex-Chips).
 */
export function LinkList({
  items,
  emptyText,
  canEdit,
  onRemove,
  removePending,
  variant = "row",
  children,
}: {
  items: LinkChip[];
  emptyText: string;
  canEdit: boolean;
  onRemove: (key: string) => void;
  removePending: boolean;
  variant?: "row" | "pill";
  /** Der typ-spezifische Hinzufügen-Picker (vom Aufrufer canEdit-gegated). */
  children?: ReactNode;
}) {
  return (
    <>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyText}</p>
      ) : variant === "pill" ? (
        <ul className="flex flex-wrap gap-1.5">
          {items.map((it) => (
            <li
              key={it.key}
              className="flex items-center gap-1 rounded-full border bg-card px-2 py-0.5 text-xs"
            >
              <span className="truncate">{it.label}</span>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => onRemove(it.key)}
                  disabled={removePending}
                  aria-label={it.removeLabel}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-50"
                >
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <ul className="space-y-1">
          {items.map((it) => (
            <li
              key={it.key}
              className="flex items-center gap-2 rounded-md border bg-card px-2 py-1.5 text-xs"
            >
              <div className="min-w-0 flex-1">
                {it.href ? (
                  <a href={it.href} className="truncate font-medium text-primary hover:underline">
                    {it.label}
                  </a>
                ) : (
                  <span className="block truncate font-medium">{it.label}</span>
                )}
                {it.subtitle && (
                  <p className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">
                    {it.subtitle}
                  </p>
                )}
              </div>
              {it.trailing}
              {canEdit && (
                <button
                  type="button"
                  onClick={() => onRemove(it.key)}
                  disabled={removePending}
                  aria-label={it.removeLabel}
                  className="grid size-5 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
                >
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {children}
    </>
  );
}
