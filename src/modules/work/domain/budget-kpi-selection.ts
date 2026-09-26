/**
 * **Welche Budget-KPIs zeigt der Portfolio Sync?** — ein Wertstrom, und darin
 * entweder „gesamt" oder ein ART.
 *
 * Die URL trägt die Wahl (`?kpiVs=`, `?kpiArt=`). Was dort steht, ist eine
 * Bitte, keine Tatsache: ein Wertstrom, den der Betrachter nicht sehen darf,
 * oder ein ART aus einem anderen Wertstrom fällt auf die Vorgabe zurück, statt
 * eine leere Fläche zu zeigen.
 *
 * Ohne Wertstrom-Recht gibt es „gesamt" nicht (die Summen sind geschützt, wie
 * in „Nachsehen", REQ-3) — dann ist das erste sichtbare ART vorgewählt.
 *
 * Rein.
 */

export interface KpiValueStreamOption {
  id: string;
  name: string;
  /** Die ARTs, deren Zahlen der Betrachter sehen darf. */
  arts: readonly { id: string; name: string }[];
  /** Darf er die Wertstrom-Summen sehen? */
  showTotals: boolean;
}

export interface KpiSelection {
  valueStream: KpiValueStreamOption;
  /** `null` = „Wertstrom gesamt". */
  artId: string | null;
}

export function resolveKpiSelection(
  options: readonly KpiValueStreamOption[],
  rawVs: string | undefined,
  rawArt: string | undefined,
): KpiSelection | null {
  const valueStream = options.find((o) => o.id === rawVs) ?? options[0];
  if (!valueStream) return null;
  const art = valueStream.arts.find((a) => a.id === rawArt);
  if (art) return { valueStream, artId: art.id };
  if (valueStream.showTotals) return { valueStream, artId: null };
  return { valueStream, artId: valueStream.arts[0]?.id ?? null };
}
