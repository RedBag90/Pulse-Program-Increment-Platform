/**
 * Reine Aggregat-Hilfen für die Finance-Finalisierung: aus den €-Vorschlägen der
 * Gruppen je Kandidat ein Vorbefüllungs-Wert (Median — robust gegen Ausreißer).
 * Kein I/O.
 */

/** Median einer Zahlenliste; leere Liste → 0. Gerade Anzahl → Mittel der Mitte. */
export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

/** Reserve = verteilbarer Topf − Σ finalisierte Beträge. */
export function computeReserve(distributable: number, finals: number[]): number {
  return distributable - finals.reduce((s, v) => s + v, 0);
}
