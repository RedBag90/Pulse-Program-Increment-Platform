/**
 * Der **empirische €-Satz je Job-Size-Punkt** eines ARTs — was ein Punkt bei
 * *diesem* Zug tatsächlich gekostet hat, statt was er im Durchschnitt aller
 * ARTs kosten soll.
 *
 * ```
 * Satz = Σ Budget der letzten zwei Halbjahre
 *        ───────────────────────────────────────────────────────
 *        Σ Job Size der in diesen Halbjahren fertiggestellten Features
 * ```
 *
 * **Halbjahre, nicht Erfolge.** Das Fenster sind die zwei Zeitraeume vor dem
 * gewaehlten — auch wenn in einem davon nichts fertig wurde. Sein Budget zaehlt
 * dann trotzdem: wer ein Halbjahr lang Geld ausgibt und nichts liefert, hat
 * teure Punkte, nicht gar keine. Bis September 2026 wurden solche Halbjahre
 * uebersprungen, und der Satz griff auf aeltere zurueck.
 *
 * Ohne Historie greift die **Schätzung je ART**. Einen tenant-weiten
 * Rückfall (`Tenant.costPerJobSizePoint`) gab es bis September 2026; er ist
 * entfallen — ein Satz für alle ARTs kannte keines davon.
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
  /**
   * Der Anteil davon, der an **keinem Epic** hängt — eigenständige Features.
   *
   * Er verändert den Satz **nicht**: das ART-Budget finanziert alles, was das
   * ART tut, also gehört auch alles in den Nenner. Die Zahl beantwortet eine
   * andere Frage — „wie viel unserer Lieferung hängt an keinem Vorhaben" — und
   * steht deshalb daneben, nicht darin.
   */
  standaloneJobSize: number;
  standaloneFeatureCount: number;
}

/**
 * Woher der Satz kommt. `artEstimate` — eine Schätzung, die jemand für dieses
 * ART eingetragen hat, weil die Historie keinen Satz hergibt.
 */
export type RateSource = "empirical" | "artEstimate" | "none";

export interface JobSizeRate {
  source: RateSource;
  /**
   * Die gespeicherte Schätzung dieses ARTs, **ob sie greift oder nicht** — die
   * Fläche zeigt sie zum Ändern, und bei `empirical` den Hinweis, dass sie
   * nicht mehr gebraucht wird. `null` = keine eingetragen.
   */
  artEstimate: number | null;
  /** €/Punkt. `null`, wenn weder empirisch noch als Tenant-Wert verfügbar. */
  rate: number | null;
  /** Die Zyklen, aus denen der Satz stammt — leer beim Rückfall. */
  cycles: ThroughputCycle[];
  budgetSum: number;
  jobSizeSum: number;
  featureCount: number;
  /** Herkunft, nicht Rechnung: wie viel des Nenners eigenständig war. */
  standaloneJobSizeSum: number;
  standaloneFeatureCount: number;
  /**
   * Warum der Satz mit Vorsicht zu lesen ist. Leer heißt nicht „belastbar",
   * sondern nur „keine der bekannten Verzerrungen".
   */
  caveats: RateCaveat[];
}

/**
 * **Ein Vorbehalt als Code, nicht als Satz.** Die Fläche übersetzt ihn
 * (`budgeting.rateCaveat.<code>`). Bis September 2026 standen hier fertige
 * deutsche Sätze — die englische Oberfläche zeigte sie deutsch.
 */
export type RateCaveatCode =
  | "undated"
  | "placeholder"
  | "noCycle"
  | "noCompletions"
  | "emptyCycles"
  | "fewCycles"
  | "thinJobSize";

export interface RateCaveat {
  code: RateCaveatCode;
  /** Die Zahlen im Satz (`count`, `empty`, `total`, `jobSize`). */
  values: Record<string, number>;
}

/** Unterhalb dieser Punktzahl schwankt der Satz bei jedem einzelnen Feature erheblich. */
export const THIN_JOB_SIZE = 100;

/** Anzahl abgeschlossener Zyklen, über die gemittelt wird. */
export const RATE_WINDOW = 2;

export interface RateInput {
  /** Abgeschlossene Zyklen, beliebige Reihenfolge. */
  cycles: readonly ThroughputCycle[];
  /**
   * Die Schätzung dieses ARTs (`Art.jobSizeRateEstimate`). Sie greift **nur**,
   * wenn die Historie keinen Satz hergibt.
   */
  artEstimate?: number | null;
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
  const standaloneJobSizeSum = cycles.reduce((s, c) => s + c.standaloneJobSize, 0);
  const standaloneFeatureCount = cycles.reduce((s, c) => s + c.standaloneFeatureCount, 0);

  const caveats: RateCaveat[] = [];
  if (input.undatedFeatures > 0) {
    caveats.push({ code: "undated", values: { count: input.undatedFeatures } });
  }
  if (input.placeholderJobSize > 0) {
    caveats.push({ code: "placeholder", values: { count: input.placeholderJobSize } });
  }

  const artEstimate = input.artEstimate != null && input.artEstimate > 0 ? input.artEstimate : null;

  if (jobSizeSum === 0 || cycles.length === 0) {
    return {
      source: artEstimate != null ? "artEstimate" : "none",
      rate: artEstimate,
      artEstimate,
      cycles: [],
      budgetSum: 0,
      jobSizeSum: 0,
      featureCount: 0,
      standaloneJobSizeSum: 0,
      standaloneFeatureCount: 0,
      caveats: [
        cycles.length === 0
          ? { code: "noCycle", values: {} }
          : { code: "noCompletions", values: {} },
        ...caveats,
      ],
    };
  }

  const leere = cycles.filter((c) => c.jobSize === 0).length;
  if (leere > 0) {
    // Ohne diesen Satz sieht ein hoher €-Satz willkuerlich aus. Er ist die
    // haeufigste Erklaerung dafuer — und zugleich die interessanteste Auskunft
    // ueber das ART.
    caveats.push({ code: "emptyCycles", values: { empty: leere, total: cycles.length } });
  }
  if (cycles.length < RATE_WINDOW) {
    caveats.push({ code: "fewCycles", values: { count: cycles.length } });
  }
  if (jobSizeSum < THIN_JOB_SIZE) {
    caveats.push({ code: "thinJobSize", values: { jobSize: jobSizeSum } });
  }

  return {
    source: "empirical",
    rate: budgetSum / cycles.length / (jobSizeSum / cycles.length),
    artEstimate,
    cycles,
    budgetSum,
    jobSizeSum,
    featureCount,
    standaloneJobSizeSum,
    standaloneFeatureCount,
    caveats,
  };
}

/** Die eingeplante Last in Geld — `null`, solange kein Satz vorliegt. */
export function loadInEuro(jobSize: number, rate: JobSizeRate): number | null {
  return rate.rate == null ? null : jobSize * rate.rate;
}
