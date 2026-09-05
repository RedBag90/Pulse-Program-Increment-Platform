/**
 * Der **Budgeting-Zyklus** — das Halbjahr als Begriff, nicht als Zeichenkette.
 *
 * Bis hierhin war `cycleKey` ein nackter `string` in ~45 Signaturen. Es gab
 * Module, die *über* Halbjahre rechneten, aber keines, das den Begriff
 * **besaß**. Die Folgen standen verstreut im Code:
 *
 *  - Das Format wurde in zwei Zod-Schemas geprüft und sonst nirgends.
 *  - Die Sortierung war an zwei Stellen als String-Vergleich **unterstellt**
 *    (`key < cycleKey`, `.sort().reverse()`) — richtig, aber nirgends gesagt
 *    und nirgends geprüft.
 *  - „Welches Halbjahr meint diese Anfrage" lösten drei Seiten mit demselben
 *    Fünfzeiler auf, und die offenen Aufgaben mit einer **vierten** Auslegung.
 *
 * Dieses Modul beantwortet die vier Fragen an einer Stelle. Es rechnet nicht
 * selbst mit Daten — die Primitiven bleiben im Kalender des Kernels; hier wohnt,
 * was Budgeting daraus macht.
 *
 * Rein, kein I/O.
 */

import { halfYearKey, halfYearLabel, addHalfYears } from "@/modules/core/kernel/domain/calendar";

/** `2026-H1` / `2026-H2`. Die einzige Stelle, an der das Format steht. */
export const CYCLE_KEY_PATTERN = /^\d{4}-H[12]$/;

export interface CycleOption {
  key: string;
  label: string;
}

/** Trägt die Zeichenkette ein gültiges Halbjahr? */
export function isCycleKey(raw: string | null | undefined): boolean {
  return raw != null && CYCLE_KEY_PATTERN.test(raw);
}

/** Beschriftung eines Zyklus — der eine Import statt drei. */
export function cycleLabel(key: string): string {
  return halfYearLabel(key);
}

/**
 * Die Ordnung zweier Zyklen: negativ, wenn `a` früher liegt.
 *
 * Sie **ist** der lexikographische Vergleich — `2026-H1 < 2026-H2 < 2027-H1` —,
 * weil das Format mit fester Stellenzahl beginnt. Genau deshalb steht sie hier
 * als benannte, geprüfte Funktion: die Annahme war zweimal im Code unterstellt
 * und würde still brechen, sobald jemand das Format ändert.
 */
export function compareCycles(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Sortierte, deduplizierte Zyklen — aufsteigend, oder absteigend auf Wunsch. */
export function sortCycles(keys: Iterable<string>, direction: "asc" | "desc" = "asc"): string[] {
  const sorted = [...new Set(keys)].sort(compareCycles);
  return direction === "asc" ? sorted : sorted.reverse();
}

/**
 * Die beiden Halbjahre, in denen Budgeting arbeitet: das **laufende** und das
 * **nächste**.
 *
 * Vorausschauend, damit ein Vorhaben vorbereitet werden kann, bevor sein
 * Halbjahr beginnt. Warum darüber hinaus nichts geht, sagt
 * `potWindowClosedReason` — das ist die Regel; dies hier ist die Achse.
 */
export function openCycles(now: Date): [string, string] {
  return [halfYearKey(now), halfYearKey(addHalfYears(now, 1))];
}

/** Der laufende Zyklus — die Antwort auf „jetzt". */
export function currentCycle(now: Date): string {
  return halfYearKey(now);
}

/**
 * Welches Halbjahr meint diese Anfrage?
 *
 * Nimmt den rohen `?cycle=`-Parameter und gibt den gültigen Zyklus samt der
 * Auswahl für den Umschalter. Ein unbekannter, abgelaufener oder fehlender Wert
 * fällt auf das laufende Halbjahr zurück — **stumm**, weil ein Halbjahr aus
 * einer URL keine Fehlermeldung wert ist.
 *
 * Diese fünf Zeilen standen wortgleich auf drei Seiten; die offenen Aufgaben
 * hatten sich davon unbemerkt entkoppelt und nahmen immer das laufende.
 */
export function resolveCycle(
  raw: string | null | undefined,
  now: Date,
): { cycleKey: string; options: CycleOption[] } {
  const open = openCycles(now);
  const cycleKey = raw != null && open.includes(raw) ? raw : open[0];
  return {
    cycleKey,
    options: open.map((key) => ({ key, label: cycleLabel(key) })),
  };
}
