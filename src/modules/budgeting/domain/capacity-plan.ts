/**
 * **Wie viel Arbeit kann sich dieses ART leisten — und wie ist sie verteilt?**
 *
 * Guardrail 2 rechnete bis September 2026 in Prozenten des geschaetzten
 * Business-Case-Geldes je **Epic**-Typ. Zwei Dinge stimmten daran nicht: die
 * Schaetzung ist keine Entscheidung, und ein Epic ist keine Arbeitseinheit — es
 * ist ein Behaelter fuer Features, und die sind es, die Kapazitaet verbrauchen.
 *
 * ```
 * Kapazitaet  =  Veraenderungsgeld des Halbjahres  ÷  €-Satz je Job-Size-Punkt
 * Verfuegbar  =  Kapazitaet × Ziel%                    (je Arbeitstyp)
 * Geplant     =  Σ Job Size der eingeplanten Features  (je Arbeitstyp)
 * ```
 *
 * Der Satz kommt aus `art-throughput.ts` und ist eine **Beobachtung** aus der
 * Historie genau dieses ARTs — deshalb wird hier auch nichts erfunden, wenn er
 * fehlt: `available` und `delta` sind dann `null`, die geplanten Punkte stehen
 * trotzdem da. Eine Guardrail, die ohne Datengrundlage eine Ampel zeigt, ist
 * schlimmer als eine, die schweigt.
 *
 * **Warum hier und nicht in `work`:** die Rechnung braucht den €-Satz, und der
 * gehoert Budgeting. Budgeting darf `work` lesen (ADR-0013), umgekehrt nicht.
 *
 * Rein, kein I/O.
 */

import type { JobSizeRate } from "@/modules/budgeting/domain/art-throughput";
import { CAPACITY_BUCKETS, type CapacityBucket } from "@/modules/work/domain/portfolio-guardrails";

/** Σ Job Size und Anzahl — dieselbe Form wie `LoadCell` in `art-budget.ts`. */
export interface PointCell {
  count: number;
  jobSize: number;
}

export const emptyPointCell = (): PointCell => ({ count: 0, jobSize: 0 });

/**
 * **Die Umkehrung von `loadInEuro`.** Dort: Punkte × Satz = Geld. Hier: Geld ÷
 * Satz = Punkte.
 *
 * `null` heisst „nicht berechenbar", nicht „null Punkte" — ohne Satz gibt es
 * keine Kapazitaetszahl. Ein Satz von 0 faellt in denselben Fall: er entstuende
 * nur aus einem Budget von 0 und wuerde sonst durch Null teilen.
 *
 * **Nur der empirische Satz zaehlt — der mandantenweite Rueckfall nicht.**
 * `deriveJobSizeRate` faellt auf `Tenant.costPerJobSizePoint` zurueck, wenn im
 * Fenster nichts fertig wurde. Fuer die Deckungs-Karte ist das richtig: sie
 * **schaetzt**, was eine Last ungefaehr kostet, und ein geliehener Satz ist
 * dafuer brauchbar.
 *
 * Die Guardrail verteilt dagegen ein **Kontingent**, und da kehrt sich das um.
 * Gemessen: der Rueckfallwert liegt bei 1.500 €/Punkt, die empirischen Saetze
 * derselben Mandanten bei 9.000–11.000 €. Ein ART, das ein Jahr lang nichts
 * abgeschlossen hat, bekaeme damit **90 Punkte** — mehr als die 19 des ARTs
 * daneben, das tatsaechlich liefert. Die Guardrail wuerde Untaetigkeit belohnen.
 *
 * Ohne empirischen Satz gilt deshalb, was ohnehin entschieden ist: Punkte
 * zeigen, Umrechnung weglassen, das ART benennen.
 */
export function capacityInPoints(budget: number, rate: JobSizeRate): number | null {
  if (rate.source !== "empirical") return null;
  if (rate.rate == null || rate.rate <= 0) return null;
  return budget / rate.rate;
}

/** Eine Zeile der Guardrail: ein Arbeitstyp, sein Soll und sein Ist. */
export interface CapacityRow {
  bucket: CapacityBucket;
  /** Ziel-Anteil als Bruch (0..1) — aus den Prozentwerten abgeleitet. */
  targetShare: number;
  /** Punkte, die dieser Typ laut Ziel bekommt. `null` ohne Satz. */
  available: number | null;
  planned: PointCell;
  /** `planned.jobSize − available`; positiv = ueberplant. `null` ohne Satz. */
  delta: number | null;
}

export interface CapacityPlan {
  /** Das Veraenderungsgeld, das der Rechnung zugrunde liegt. */
  budget: number;
  /** `budget ÷ Satz`. `null`, wenn kein Satz vorliegt. */
  capacity: number | null;
  rows: CapacityRow[];
  /** Features, deren Arbeitstyp nicht gesetzt ist — nie in einer Zeile. */
  unclassified: PointCell;
  /** Σ ueber alle Typen **und** die Unklassifizierten. */
  totalPlanned: PointCell;
}

export interface CapacityPlanInput {
  budget: number;
  capacity: number | null;
  targets: Record<CapacityBucket, number>;
  plannedByBucket: Record<CapacityBucket, PointCell>;
  unclassified: PointCell;
}

/**
 * Baut den Plan aus fertigen Zahlen — das Beschaffen bleibt beim Aufrufer.
 *
 * **Die Unklassifizierten stehen daneben, nicht darin.** Ein Feature ohne
 * Arbeitstyp gegen einen der drei Eimer zu rechnen hiesse, ihm einen Typ zu
 * unterstellen; es aus `totalPlanned` zu lassen hiesse, Arbeit verschwinden zu
 * lassen. Beides waere falsch, also steht es getrennt und zaehlt in der Summe
 * mit — dieselbe Regel wie bei `computeMixAxis`.
 */
export function buildCapacityPlan(input: CapacityPlanInput): CapacityPlan {
  const targetSum = CAPACITY_BUCKETS.reduce((sum, b) => sum + input.targets[b], 0);

  const rows: CapacityRow[] = CAPACITY_BUCKETS.map((bucket) => {
    // Gegen die tatsaechliche Summe teilen, nicht gegen 100: ein Ziel-Set, das
    // (noch) nicht auf 100 summiert, soll die Punkte nicht ueber- oder
    // unterzeichnen. Die Validierung verhindert das beim Speichern; ein
    // Bestands-JSON kann es trotzdem tragen.
    const targetShare = targetSum > 0 ? input.targets[bucket] / targetSum : 0;
    const planned = input.plannedByBucket[bucket];
    const available = input.capacity == null ? null : input.capacity * targetShare;
    return {
      bucket,
      targetShare,
      available,
      planned,
      delta: available == null ? null : planned.jobSize - available,
    };
  });

  const totalPlanned = [...rows.map((r) => r.planned), input.unclassified].reduce(
    (acc, cell) => ({ count: acc.count + cell.count, jobSize: acc.jobSize + cell.jobSize }),
    emptyPointCell(),
  );

  return {
    budget: input.budget,
    capacity: input.capacity,
    rows,
    unclassified: input.unclassified,
    totalPlanned,
  };
}

/**
 * Mehrere Plaene zu einem zusammenziehen — ein Wertstrom aus seinen ARTs, ein
 * Portfolio aus seinen Wertstroemen.
 *
 * **Die Ziele werden nicht gemittelt, die Punkte werden addiert.** Ein
 * gemittelter Ziel-Anteil waere eine Zahl, die niemand gesetzt hat. Der
 * ausgewiesene Anteil der Summe ergibt sich hinterher aus den Punkten selbst.
 *
 * Ein Plan **ohne** Kapazitaet (ART ohne Satz) traegt seine geplanten Punkte
 * bei, aber keine verfuegbaren — sonst zaehlte die Summe Last gegen eine
 * Kapazitaet, die diesen Teil nie enthielt. Wer die Luecke benennen will,
 * braucht die Namen; die haelt der Aufrufer.
 */
export function sumCapacityPlans(plans: readonly CapacityPlan[]): CapacityPlan {
  const withRate = plans.filter((p) => p.capacity != null);

  const rows: CapacityRow[] = CAPACITY_BUCKETS.map((bucket, i) => {
    const planned = plans.reduce(
      (acc, p) => ({
        count: acc.count + p.rows[i]!.planned.count,
        jobSize: acc.jobSize + p.rows[i]!.planned.jobSize,
      }),
      emptyPointCell(),
    );
    const available =
      withRate.length === 0
        ? null
        : withRate.reduce((sum, p) => sum + (p.rows[i]!.available ?? 0), 0);
    return {
      bucket,
      // Der Anteil der Summe, gemessen an den verfuegbaren Punkten — nicht der
      // Durchschnitt der Vorgaben.
      targetShare: 0,
      available,
      planned,
      delta: available == null ? null : planned.jobSize - available,
    };
  });

  const capacity =
    withRate.length === 0 ? null : withRate.reduce((s, p) => s + (p.capacity ?? 0), 0);
  for (const row of rows) {
    row.targetShare = capacity != null && capacity > 0 ? (row.available ?? 0) / capacity : 0;
  }

  const unclassified = plans.reduce(
    (acc, p) => ({
      count: acc.count + p.unclassified.count,
      jobSize: acc.jobSize + p.unclassified.jobSize,
    }),
    emptyPointCell(),
  );
  const totalPlanned = plans.reduce(
    (acc, p) => ({
      count: acc.count + p.totalPlanned.count,
      jobSize: acc.jobSize + p.totalPlanned.jobSize,
    }),
    emptyPointCell(),
  );

  return {
    // **Nur das umrechenbare Budget.** Die Flaeche schreibt „X € → Y Punkte";
    // das gilt nur, wenn X das Geld der ARTs ist, aus dem Y entstanden ist.
    // Gemessen standen sonst 345.600 € neben 19 Punkten, obwohl nur 210.600 €
    // dahinter lagen — die restlichen 135.000 € gehoeren einem ART ohne Satz.
    budget: withRate.reduce((s, p) => s + p.budget, 0),
    capacity,
    rows,
    unclassified,
    totalPlanned,
  };
}
