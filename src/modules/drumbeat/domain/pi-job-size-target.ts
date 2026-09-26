/**
 * **Das Job-Size-Ziel eines PI — aus einer Formel, nicht aus einer Eingabe.**
 *
 * Bis September 2026 war das Ziel eine Zahl, die jemand eintippte
 * (`ProgramIncrement.capacityJobSize`). Nichts leitete sie her, und niemand
 * konnte sagen, warum es 80 und nicht 120 waren.
 *
 * Jetzt trägt das ART je PI eine **Kapazitätszahl** (`ArtPiCapacity`, Einheit
 * frei: Personen, Personentage — sie muss nur über die PIs gleich bleiben).
 * Daraus:
 *
 *   JS je Kapazität (eines PI) = geliefertes Job-Size ÷ Kapazität
 *   Ziel = Ø JS je Kapazität der letzten 4 PIs × Kapazität dieses PI × 0,8
 *
 * **Geliefert, nicht verplant.** Gezählt werden abgeschlossene Features. Wer
 * verplantes JS nähme, hätte ein Ziel, das mit jeder Überplanung wächst.
 *
 * **Das Mittel der Quoten**, nicht Σ geliefert ÷ Σ Kapazität: so ist es
 * verlangt, und jedes PI wiegt gleich — auch ein kleines.
 *
 * **0,8** ist Puffer für Ungeplantes; die Zahl steht hier und nirgends sonst.
 *
 * Rein, ohne DB — dieselbe Bauweise wie der €-Satz
 * (`budgeting/domain/art-throughput.ts`).
 */

/** So viele Vorgänger-PIs gehen in das Mittel ein. */
export const TARGET_WINDOW = 4;
/** Puffer: geplant wird auf 80 % dessen, was die Historie hergibt. */
export const TARGET_FACTOR = 0.8;

/** Ein Vorgänger-PI, wie das Laden ihn liefert. */
export interface PiDeliveryRecord {
  piId: string;
  name: string;
  startDate: Date;
  status: string;
  /** Kapazitätszahl des ARTs in diesem PI; `null` = keine eingetragen. */
  capacity: number | null;
  /** Σ Job Size der abgeschlossenen Features dieses ARTs in diesem PI. */
  delivered: number;
}

export interface JobSizeTargetBasis {
  piId: string;
  name: string;
  capacity: number;
  delivered: number;
  /** delivered ÷ capacity */
  ratio: number;
}

export interface JobSizeTarget {
  /** Ganze Punkte; `null` ohne Kapazität oder ohne Historie. */
  target: number | null;
  /** Ø JS je Kapazität über `basis`; `null` ohne Historie. */
  perCapacity: number | null;
  /** Die Vorgänger, die eingegangen sind — höchstens `TARGET_WINDOW`, jüngster zuerst. */
  basis: JobSizeTargetBasis[];
  reason: "ok" | "noCapacity" | "noHistory";
}

/**
 * Welche PIs zählen als Vorgänger: **abgeschlossen**, **vor** dem aktuellen
 * begonnen, mit einer Kapazität größer 0. Ohne Kapazität gibt es keine Quote
 * — ein solches PI wird übersprungen, nicht als 0 gezählt.
 */
export function eligiblePredecessors(
  history: readonly PiDeliveryRecord[],
  before: Date,
): JobSizeTargetBasis[] {
  return history
    .filter(
      (p) =>
        p.status === "completed" &&
        p.startDate.getTime() < before.getTime() &&
        p.capacity != null &&
        p.capacity > 0,
    )
    .sort((a, b) => b.startDate.getTime() - a.startDate.getTime())
    .slice(0, TARGET_WINDOW)
    .map((p) => ({
      piId: p.piId,
      name: p.name,
      capacity: p.capacity!,
      delivered: p.delivered,
      ratio: p.delivered / p.capacity!,
    }));
}

export function deriveJobSizeTarget(input: {
  /** Start des PI, für das das Ziel gilt — die Grenze für „Vorgänger". */
  startDate: Date;
  /** Kapazitätszahl dieses PI; `null` = keine eingetragen. */
  capacity: number | null;
  history: readonly PiDeliveryRecord[];
}): JobSizeTarget {
  const basis = eligiblePredecessors(input.history, input.startDate);
  const perCapacity =
    basis.length === 0 ? null : basis.reduce((s, b) => s + b.ratio, 0) / basis.length;

  if (input.capacity == null || input.capacity <= 0) {
    return { target: null, perCapacity, basis, reason: "noCapacity" };
  }
  if (perCapacity == null) {
    return { target: null, perCapacity: null, basis, reason: "noHistory" };
  }
  return {
    target: Math.round(perCapacity * input.capacity * TARGET_FACTOR),
    perCapacity,
    basis,
    reason: "ok",
  };
}
