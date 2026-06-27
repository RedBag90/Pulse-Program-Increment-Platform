/**
 * Portfolio-Guardrails — die Regeln hinter den SAFe-Guardrails-Achsen
 * (Investment by Horizon, Capacity Allocation by Type). Klassifikations-
 * Konstanten + Type-Guards leben in `portfolio-guardrails.ts`; *hier* lebt
 * die Berechnung "Pro Achse: zaehlen, summieren, Anteil, Delta zum Target,
 * Max-Drift".
 *
 * Die view `portfolio-guardrails-view.ts` reimplementierte das Pattern zwei
 * Mal (einmal fuer Horizon, einmal fuer Capacity) und drohte beim
 * Hinzufuegen einer dritten Achse (z. B. Type-Mix nach FeatureType) erneut
 * zu duplizieren. `computeMixAxis<B>` ist die generische Naht: jeder neue
 * Caller liefert nur `buckets`, `classify`, `targets`.
 */

export interface MixRow {
  count: number;
  /** Anteil dieser Bucket an allen *classified* Items (0..1). */
  countShare: number;
  amount: number;
  /** Anteil dieser Bucket an der summierten *classified* Amount (0..1). */
  amountShare: number;
  /** Target-Anteil (0..1), aus den `targets`-Prozentwerten abgeleitet. */
  target: number;
  /** Drift gegenueber Target — positive = ueber Target, negative = darunter. */
  deltaCount: number;
  deltaAmount: number;
}

export interface MixAxisResult<B extends string> {
  rows: Record<B, MixRow>;
  unclassifiedCount: number;
  unclassifiedAmount: number;
  classifiedCount: number;
  classifiedAmount: number;
  /** Groesste Absolut-Drift ueber alle Buckets — fuer das Diagramm-Scaling. */
  maxAbsCount: number;
  maxAbsAmount: number;
}

function share(part: number, total: number): number {
  return total > 0 ? part / total : 0;
}

/**
 * Generische Mix-Achse: items werden via `classify` einem Bucket zugeordnet
 * (oder als unclassified gezaehlt). Pro Bucket entstehen Count + Amount,
 * Anteile relativ zur classified-Summe, und die Drift gegenueber `targets`.
 *
 * `targets` traegt Prozentwerte (summieren idealerweise auf 100); intern
 * werden sie zu Fraktionen / 100 umgerechnet.
 */
export function computeMixAxis<TItem, B extends string>(args: {
  items: readonly TItem[];
  buckets: readonly B[];
  classify: (item: TItem) => B | null;
  amountOf: (item: TItem) => number | null;
  targets: Record<B, number>;
}): MixAxisResult<B> {
  const { items, buckets, classify, amountOf, targets } = args;

  const counts = Object.fromEntries(buckets.map((b) => [b, 0])) as Record<B, number>;
  const amounts = Object.fromEntries(buckets.map((b) => [b, 0])) as Record<B, number>;
  let unclassifiedCount = 0;
  let unclassifiedAmount = 0;
  let classifiedCount = 0;
  let classifiedAmount = 0;

  for (const item of items) {
    const amt = amountOf(item) ?? 0;
    const bucket = classify(item);
    if (bucket != null) {
      counts[bucket] += 1;
      amounts[bucket] += amt;
      classifiedCount += 1;
      classifiedAmount += amt;
    } else {
      unclassifiedCount += 1;
      unclassifiedAmount += amt;
    }
  }

  const rows = {} as Record<B, MixRow>;
  let maxAbsCount = 0;
  let maxAbsAmount = 0;
  for (const b of buckets) {
    const target = targets[b] / 100;
    const countShare = share(counts[b], classifiedCount);
    const amountShare = share(amounts[b], classifiedAmount);
    const dc = countShare - target;
    const da = amountShare - target;
    if (Math.abs(dc) > maxAbsCount) maxAbsCount = Math.abs(dc);
    if (Math.abs(da) > maxAbsAmount) maxAbsAmount = Math.abs(da);
    rows[b] = {
      count: counts[b],
      countShare,
      amount: amounts[b],
      amountShare,
      target,
      deltaCount: dc,
      deltaAmount: da,
    };
  }

  return {
    rows,
    unclassifiedCount,
    unclassifiedAmount,
    classifiedCount,
    classifiedAmount,
    maxAbsCount,
    maxAbsAmount,
  };
}
