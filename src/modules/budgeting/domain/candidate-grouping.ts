/**
 * Gliederung der Ballot-Kandidaten: **Run/Grow → Wertstrom → Solution**.
 *
 * Die Liste ist die Grundlage der Verteilung — wer abstimmt, muss die Blöcke
 * erkennen: was ist Betrieb, was ist Veränderung, welcher Wertstrom und welches
 * Produkt fragt wie viel an. Vorher lief sie an fünf Stellen flach durch, und
 * die Verteil-Seite trug ihre eigene, zweite Gruppierung nach Wertstrom.
 *
 * Rein, kein I/O. Sortiert auf jeder Ebene absteigend nach Betrag: was den Topf
 * trägt, steht oben.
 */

export const BUSINESS_KINDS = ["run", "grow"] as const;
export type BusinessKind = (typeof BUSINESS_KINDS)[number];

export const BUSINESS_KIND_LABELS: Record<BusinessKind, string> = {
  run: "Run the Business",
  grow: "Grow the Business",
};

export const NO_VALUE_STREAM = "Ohne Wertstrom";
export const NO_SOLUTION = "ohne Solution";

/** Ein Kandidat, so weit die Gliederung ihn kennen muss. */
export interface GroupableCandidate {
  /** `"rtb"` ⇒ Run, alles andere (`"epic"`) ⇒ Grow. */
  kind: string;
  valueStreamName: string | null;
  solutionName: string | null;
}

export interface SolutionGroup<T> {
  name: string;
  total: number;
  items: T[];
  /**
   * `true` ⇒ eigene Zwischenüberschrift mit Σ. Bei genau einer Zeile bleibt sie
   * weg — eine Überschrift über einer einzelnen Zeile trägt nichts bei und
   * bläht die Liste auf.
   */
  heading: boolean;
}

export interface ValueStreamGroup<T> {
  name: string;
  total: number;
  solutions: SolutionGroup<T>[];
}

export interface BusinessGroup<T> {
  kind: BusinessKind;
  label: string;
  total: number;
  valueStreams: ValueStreamGroup<T>[];
}

/** Mindestzahl an Zeilen, ab der eine Solution ihre eigene Überschrift bekommt. */
const HEADING_FROM = 2;

const kindOf = (c: GroupableCandidate): BusinessKind => (c.kind === "rtb" ? "run" : "grow");
const byTotalDesc = (a: { total: number }, b: { total: number }): number => b.total - a.total;

/**
 * Faltet die Kandidaten in die drei Ebenen. Leere Ebenen entstehen nicht: eine
 * Gruppe erscheint nur, wenn sie mindestens einen Kandidaten trägt.
 */
export function groupCandidates<T extends GroupableCandidate>(
  items: readonly T[],
  amount: (item: T) => number,
): BusinessGroup<T>[] {
  const buckets = new Map<BusinessKind, Map<string, Map<string, T[]>>>();

  for (const item of items) {
    const kind = kindOf(item);
    const vs = item.valueStreamName ?? NO_VALUE_STREAM;
    const sol = item.solutionName ?? NO_SOLUTION;

    const byVs = buckets.get(kind) ?? new Map<string, Map<string, T[]>>();
    buckets.set(kind, byVs);
    const bySol = byVs.get(vs) ?? new Map<string, T[]>();
    byVs.set(vs, bySol);
    bySol.set(sol, [...(bySol.get(sol) ?? []), item]);
  }

  const sum = (list: readonly T[]): number => list.reduce((s, i) => s + amount(i), 0);

  return BUSINESS_KINDS.flatMap((kind) => {
    const byVs = buckets.get(kind);
    if (!byVs) return [];

    const valueStreams: ValueStreamGroup<T>[] = [...byVs.entries()]
      .map(([name, bySol]) => {
        const solutions: SolutionGroup<T>[] = [...bySol.entries()]
          .map(([solName, list]) => ({
            name: solName,
            total: sum(list),
            items: [...list].sort((a, b) => amount(b) - amount(a)),
            heading: list.length >= HEADING_FROM,
          }))
          .sort(byTotalDesc);
        return {
          name,
          total: solutions.reduce((s, g) => s + g.total, 0),
          solutions,
        };
      })
      .sort(byTotalDesc);

    return [
      {
        kind,
        label: BUSINESS_KIND_LABELS[kind],
        total: valueStreams.reduce((s, g) => s + g.total, 0),
        valueStreams,
      },
    ];
  });
}
