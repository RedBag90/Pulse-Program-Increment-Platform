/**
 * Der **empirische €-Satz je Job-Size-Punkt** eines ARTs — was ein Punkt bei
 * *diesem* Zug tatsächlich gekostet hat, statt was er im Durchschnitt aller
 * ARTs kosten soll.
 *
 * ```
 * Satz = Ø Budget der letzten zwei abgeschlossenen Zyklen
 *        ────────────────────────────────────────────────
 *        Σ Job Size der in diesen Zyklen fertiggestellten Features
 * ```
 *
 * Der tenant-weite `costPerJobSizePoint` bleibt der Rückfall. Er wird heute
 * gepflegt und angezeigt, aber **nirgends multipliziert** — die Fläche, für die
 * er gebaut wurde, gibt es nicht mehr.
 *
 * Der Satz ist eine **Beobachtung, keine Vorgabe**. Deshalb trägt das Ergebnis
 * seine Herkunft mit: Zeitraum, Budget, Punkte, Zahl der Features — und die
 * Vorbehalte, die man kennen muss, um ihn nicht für gesetzt zu halten.
 *
 * Rein, kein I/O.
 */

export interface ThroughputCycle {
  cycleKey: string;
  /** Zugeteiltes Budget dieses ARTs im Zyklus. */
  budget: number;
  /** Σ Job Size der in diesem Zyklus fertiggestellten Features. */
  jobSize: number;
  featureCount: number;
}

export type RateSource = "empirical" | "tenantDefault" | "none";

export interface JobSizeRate {
  source: RateSource;
  /** €/Punkt. `null`, wenn weder empirisch noch als Tenant-Wert verfügbar. */
  rate: number | null;
  /** Die Zyklen, aus denen der Satz stammt — leer beim Rückfall. */
  cycles: ThroughputCycle[];
  budgetSum: number;
  jobSizeSum: number;
  featureCount: number;
  /**
   * Warum der Satz mit Vorsicht zu lesen ist. Leer heißt nicht „belastbar",
   * sondern nur „keine der bekannten Verzerrungen".
   */
  caveats: string[];
}

/** Unterhalb dieser Punktzahl schwankt der Satz bei jedem einzelnen Feature erheblich. */
export const THIN_JOB_SIZE = 100;

/** Anzahl abgeschlossener Zyklen, über die gemittelt wird. */
export const RATE_WINDOW = 2;

export interface RateInput {
  /** Abgeschlossene Zyklen, beliebige Reihenfolge. */
  cycles: readonly ThroughputCycle[];
  tenantDefault: number | null;
  /** Features ohne Abschlussdatum **und** ohne PI-Ende — sie fehlen im Nenner. */
  undatedFeatures: number;
  /** Features mit dem Schnellanlage-Platzhalter Job Size 3. */
  placeholderJobSize: number;
}

/**
 * Ermittelt den Satz aus den letzten `RATE_WINDOW` abgeschlossenen Zyklen.
 *
 * Ist der Nenner 0 — keine Abschlüsse, oder keine Zyklen —, greift der
 * Tenant-Wert. Ist auch der nicht gesetzt, gibt es keinen Satz; die Fläche zeigt
 * dann die Last in Punkten statt in Euro, statt eine Zahl zu erfinden.
 */
export function deriveJobSizeRate(input: RateInput): JobSizeRate {
  const cycles = [...input.cycles]
    .sort((a, b) => b.cycleKey.localeCompare(a.cycleKey))
    .slice(0, RATE_WINDOW);
  const budgetSum = cycles.reduce((s, c) => s + c.budget, 0);
  const jobSizeSum = cycles.reduce((s, c) => s + c.jobSize, 0);
  const featureCount = cycles.reduce((s, c) => s + c.featureCount, 0);

  const caveats: string[] = [];
  if (input.undatedFeatures > 0) {
    caveats.push(
      `${input.undatedFeatures} abgeschlossene Features ohne Abschlussdatum und ohne PI-Ende fallen aus der Rechnung.`,
    );
  }
  if (input.placeholderJobSize > 0) {
    caveats.push(
      `${input.placeholderJobSize} Features tragen Job Size 3 aus der Schnellanlage — einen Platzhalter, keine Schätzung.`,
    );
  }

  if (jobSizeSum === 0 || cycles.length === 0) {
    return {
      source: input.tenantDefault != null ? "tenantDefault" : "none",
      rate: input.tenantDefault,
      cycles: [],
      budgetSum: 0,
      jobSizeSum: 0,
      featureCount: 0,
      caveats: [
        cycles.length === 0
          ? "Kein abgeschlossener Zyklus — der Satz lässt sich nicht aus der Historie ableiten."
          : "In den letzten Zyklen wurde nichts fertiggestellt — der Satz lässt sich nicht ableiten.",
        ...caveats,
      ],
    };
  }

  if (cycles.length < RATE_WINDOW) {
    caveats.push(`Nur ${cycles.length} abgeschlossener Zyklus — der Satz ist vorläufig.`);
  }
  if (jobSizeSum < THIN_JOB_SIZE) {
    caveats.push(
      `Nur ${jobSizeSum} Job-Size-Punkte im Fenster — der Satz schwankt bei jedem einzelnen Feature erheblich.`,
    );
  }

  return {
    source: "empirical",
    rate: budgetSum / cycles.length / (jobSizeSum / cycles.length),
    cycles,
    budgetSum,
    jobSizeSum,
    featureCount,
    caveats,
  };
}

/** Die eingeplante Last in Geld — `null`, solange kein Satz vorliegt. */
export function loadInEuro(jobSize: number, rate: JobSizeRate): number | null {
  return rate.rate == null ? null : jobSize * rate.rate;
}
