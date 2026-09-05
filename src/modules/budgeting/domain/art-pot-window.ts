/**
 * Wann der ART-Rahmen verteilt werden darf.
 *
 * **Laufendes und nächstes Halbjahr.** Vorausschauend, damit ein Vorhaben
 * vorbereitet werden kann, bevor sein Halbjahr beginnt — aber vergangene Zyklen
 * bleiben gesperrt: die Zuteilungshistorie speist die Kostenkurve und den
 * eingefrorenen Budget-Plan, und was dort steht, muss stehen bleiben.
 *
 * Dasselbe Muster wie `windowClosedReason` der Gruppen-Verteilung: eine reine
 * Funktion, die den Grund nennt, statt nur „nein" zu sagen.
 *
 * Rein, kein I/O.
 */

import { parseHalfYearKey } from "@/modules/core/kernel/domain/calendar";
import { openCycles } from "@/modules/budgeting/domain/cycle";

/** `null` = offen. Sonst der Grund, warum nicht. */
export function potWindowClosedReason(cycleKey: string, now: Date): string | null {
  const target = parseHalfYearKey(cycleKey);
  if (!target) return "Unbekanntes Halbjahr.";

  const [current, next] = openCycles(now);

  if (cycleKey === current || cycleKey === next) return null;
  if (cycleKey < current) {
    return "Vergangene Halbjahre sind gesperrt — die Zuteilungshistorie bleibt unbeweglich.";
  }
  return "Erst ab dem übernächsten Halbjahr planbar, wenn dessen Kachel steht.";
}
