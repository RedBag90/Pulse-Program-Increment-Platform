import { addHalfYears, halfYearKey, parseHalfYearKey } from "@/modules/core/kernel/domain/calendar";
import { appliedPeriod, type PeriodFacts } from "@/modules/budgeting/domain/period-validity";
import {
  cycleLabel,
  openCycles,
  sortCycles,
  type CycleOption,
} from "@/modules/budgeting/domain/cycle";

/**
 * **Der Budget-Stichtag — welches Budget gilt an diesem Tag, und was folgt
 * daraus.**
 *
 * Bis September 2026 beantworteten fünf Regeln die Frage „welche Kachel gilt
 * jetzt", und jeder Aufrufer griff eine heraus: das Kalender-Halbjahr,
 * `appliedPeriod`, die zeitlich laufende Kachel, die Kachel mit Status
 * „running" und „die neueste mit Daten". Auf dem Portfolio Sync standen drei
 * davon nebeneinander — der Funding-Snapshot auf der geltenden Kachel, der
 * Job-Size-Verlauf auf der zeitlich laufenden, sein €-Satz auf dem Kalender.
 * Eine fortgeltende Kachel galt fürs Geld und war fürs Verteilen gesperrt.
 *
 * Jetzt gibt es **eine** Antwort, und die übrigen Fragen leiten sich daraus ab:
 *
 *  - **applied** — die geltende Kachel. Nur eine finalisierte gilt
 *    (`appliedPeriod`), in einer Lücke gilt die zuletzt abgelaufene fort. Liegt
 *    der Tag in einer unfertigen Kachel, gilt **keine**: für einen halbfertigen
 *    Rahmen steht kein Geld da.
 *  - **focusKey** — worauf eine Fläche ohne ausdrückliche Wahl steht: das
 *    Halbjahr der geltenden Kachel, ohne sie das Kalender-Halbjahr.
 *  - **openKeys / distributionClosedReason** — welche Halbjahre offen sind
 *    (verteilbar, im Umschalter wählbar): das laufende, das nächste und das der
 *    geltenden Kachel, auch wenn sie fortgilt.
 *  - **resolveCycle** — welches Halbjahr eine Anfrage meint (`?cycle=`): ein
 *    offenes, sonst `focusKey`.
 *
 * Rein, kein I/O; `now` kommt herein. Den Stichtag eines Requests lädt
 * `server/services/budget-stichtag.ts` — einmal, gecacht.
 */

const DAY = 86_400_000;

/** Die Kachel-Felder, die der Stichtag braucht — strukturell getippt. */
export interface StichtagPeriod extends PeriodFacts {
  cycleKey: string;
}

/** Die geltende Kachel als Zeitfenster. */
export interface AppliedTile {
  id: string;
  /** Schlüssel des Geldes der Kachel (`BudgetRound.cycleKey`). */
  cycleKey: string;
  /** Erster Tag. */
  start: Date;
  /** Erster Tag **nach** der Kachel — die Grenze, nicht der letzte Tag. */
  end: Date;
  /** `true` = der Zeitraum ist vorbei; sie gilt in einer Lücke fort. */
  extended: boolean;
}

export interface BudgetStichtag {
  now: Date;
  /** `null` = an diesem Tag gilt kein Budget. */
  applied: AppliedTile | null;
  /** Das Halbjahr, auf dem Flächen ohne eigene Wahl stehen. */
  focusKey: string;
  /** Die offenen Halbjahre, aufsteigend. */
  openKeys: string[];
  /** Der rohe `?cycle=`-Wert → ein offenes Halbjahr (stumm `focusKey`) plus die Auswahl. */
  resolveCycle(raw: string | null | undefined): { cycleKey: string; options: CycleOption[] };
  /** `null` = offen fürs Verteilen; sonst der Grund, warum nicht. */
  distributionClosedReason(cycleKey: string): string | null;
}

export function budgetStichtag(periods: readonly StichtagPeriod[], now: Date): BudgetStichtag {
  const hit = appliedPeriod(periods, now);
  const round = hit ? periods.find((p) => p.id === hit.period.id)! : null;
  const applied = round ? toTile(round, hit!.extended) : null;
  const focusKey = applied?.cycleKey ?? halfYearKey(now);
  const openKeys = sortCycles([...new Set([...openCycles(now), focusKey])]);

  return {
    now,
    applied,
    focusKey,
    openKeys,
    resolveCycle: (raw) => ({
      cycleKey: raw != null && openKeys.includes(raw) ? raw : focusKey,
      options: openKeys.map((key) => ({ key, label: cycleLabel(key) })),
    }),
    distributionClosedReason: (cycleKey) => closedReason(cycleKey, now, openKeys),
  };
}

function toTile(p: StichtagPeriod, extended: boolean): AppliedTile {
  // Eine geltende Kachel hat Daten (sonst deckte sie keinen Tag ab); fehlt der
  // Start dennoch, steht das Halbjahr ihres Schlüssels ein.
  const halfYear = parseHalfYearKey(p.cycleKey);
  const start = p.startDate ?? halfYear ?? new Date(0);
  const end = p.endDate
    ? new Date(p.endDate.getTime() + DAY)
    : halfYear
      ? addHalfYears(halfYear, 1)
      : start;
  return { id: p.id, cycleKey: p.cycleKey, start, end, extended };
}

/**
 * **Wann ein ART-Rahmen verteilt werden darf.** Das laufende und das nächste
 * Halbjahr — vorausschauend, damit ein Vorhaben vorbereitet werden kann — und
 * die geltende Kachel, solange sie gilt. Vergangenes bleibt gesperrt: die
 * Zuteilungshistorie speist die Kostenkurve und den eingefrorenen Budget-Plan.
 */
function closedReason(cycleKey: string, now: Date, openKeys: readonly string[]): string | null {
  if (!parseHalfYearKey(cycleKey)) return "Unbekanntes Halbjahr.";
  if (openKeys.includes(cycleKey)) return null;
  if (cycleKey < halfYearKey(now)) {
    return "Vergangene Halbjahre sind gesperrt — die Zuteilungshistorie bleibt unbeweglich.";
  }
  return "Erst ab dem übernächsten Halbjahr planbar, wenn dessen Kachel steht.";
}
