/**
 * Die Aufteilung des Wertstrom-Zuspruchs auf seine Positionen.
 *
 * Seit die PB-Liste **je Wertstrom eine Zeile** trägt, entscheidet die Runde nur
 * die Summe. Wie sie sich auf Betrieb und die ART-Epic-Budgets der ARTs
 * verteilt, entscheidet der Wertstrom danach — und aus dieser Aufteilung
 * entsteht der Topf, den ein ART auf seine ART-Epics verteilen darf.
 *
 * Rein, kein I/O.
 */

/** Eine Position, so weit die Aufteilung sie kennen muss. */
export interface AwardableItem {
  id: string;
  /** Richtwert dieser Position für das Halbjahr. */
  ask: number;
}

/**
 * **Vorbelegung**, nicht Ergebnis — dasselbe Verhältnis wie beim Median der
 * Gruppen: eine Zahl, über die jemand entscheidet, nicht eine, die entscheidet.
 *
 * Anteilig am Richtwert. Deckt der Zuspruch den Antrag, bekommt jede Position
 * exakt ihren Richtwert zurück; ist er kleiner, verlieren alle im selben
 * Verhältnis.
 *
 * Der Rundungsrest geht an die größte Position, damit die Summe **exakt** dem
 * Zuspruch entspricht. Andernfalls behauptete die Fläche einen Rest, den es
 * nicht gibt — oder verschenkte einen Euro.
 */
export function proportionalAwards(
  items: readonly AwardableItem[],
  awarded: number,
): Record<string, number> {
  const out: Record<string, number> = {};
  if (items.length === 0) return out;
  if (awarded <= 0) {
    for (const i of items) out[i.id] = 0;
    return out;
  }

  const total = items.reduce((s, i) => s + Math.max(0, i.ask), 0);
  // Ohne Richtwerte gibt es kein Verhältnis — dann zu gleichen Teilen.
  if (total <= 0) {
    const each = Math.floor(awarded / items.length);
    for (const i of items) out[i.id] = each;
  } else {
    for (const i of items) {
      out[i.id] = Math.floor((Math.max(0, i.ask) / total) * awarded);
    }
  }

  const assigned = Object.values(out).reduce((s, v) => s + v, 0);
  const rest = awarded - assigned;
  if (rest !== 0) {
    const largest = [...items].sort((a, b) => b.ask - a.ask)[0]!;
    out[largest.id] = (out[largest.id] ?? 0) + rest;
  }
  return out;
}

/**
 * `null` = die Aufteilung passt. Sonst der Grund — wie
 * `potWindowClosedReason`: sagen, warum nicht, statt nur „nein".
 */
export function awardSplitDeniedReason(sum: number, awarded: number): string | null {
  if (sum < 0) return "Beträge müssen ≥ 0 sein.";
  if (sum > awarded) {
    return `Die Aufteilung überschreitet den Zuspruch um ${Math.round(sum - awarded)} €.`;
  }
  return null;
}
