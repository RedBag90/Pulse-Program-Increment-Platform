import { formatDate } from "@/lib/formatting";
import type { Locale } from "@/i18n/routing";

/**
 * **Wie eine Kachel heisst: nach ihrem Zeitraum.**
 *
 * Sie hiess bis September 2026 nach ihrem `cycleKey` — dem Halbjahr, in das
 * ihr **Start** fällt. Der Zeitraum ist aber frei, und die Vorgabe beim
 * Anlegen ist „Start + 6 Kalendermonate": beides deckt sich nur, wenn eine
 * Kachel am 1. Januar oder 1. Juli beginnt. Eine Kachel vom 01.10.2026 bis
 * 31.03.2027 stand deshalb als „H2 2026" da, obwohl sie bis weit in H1 2027
 * reicht. Der Name sagte die halbe Wahrheit, und die Kachel widersprach sich
 * selbst: zwei Zeilen tiefer stand ihr wirklicher Zeitraum.
 *
 * **Der `cycleKey` bleibt davon unberührt.** Er ist kein Anzeigewert, sondern
 * der Schlüssel, unter dem das Geld liegt — vier Tabellen sind über ihn
 * eindeutig, und `BudgetAllocation.allocations` ist eine JSON-Karte mit ihm
 * als Schlüssel. Hier geht es allein um die Beschriftung.
 *
 * `fallback` trägt genau einen Fall: eine Kachel **ohne** Zeitraum. Die
 * Spalten sind nullbar (Altbestand vor dem Kachel-Modell), und wer keine
 * Daten hat, lässt sich nur über sein Halbjahr benennen.
 *
 * Liegt hier und nicht in der Domäne, weil `formatDate` aus `@/lib` kommt und
 * kein Domain-Modul die Formatierung importiert — dieselbe Begründung wie bei
 * `intended-class-options.ts`.
 *
 * Rein, kein I/O.
 */
export function periodName(
  startDate: Date | null,
  endDate: Date | null,
  fallback: string,
  locale?: Locale,
): string {
  if (startDate == null || endDate == null) return fallback;
  return `${formatDate(startDate, "date", locale)} – ${formatDate(endDate, "date", locale)}`;
}
