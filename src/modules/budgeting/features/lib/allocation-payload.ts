"use client";

/**
 * Zahlen-Koerzion der Budget-Grids.
 *
 * Hier standen die typisierten Encoder für die Budget-Schreib-Actions (Topf,
 * Epic-Zuteilung, ART-Verteilung). Alle drei sind entfallen: der Topf lebt in
 * der Kachel, Zuteilung und ART-Budget entstehen aus ihrer Finalisierung. Übrig
 * bleibt die eine Hilfsfunktion, die die Grids weiterhin brauchen.
 */

/** Coerce an `<input>` string to a finite number (empty/NaN → 0). */
export function numOr0(s: string): number {
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}
