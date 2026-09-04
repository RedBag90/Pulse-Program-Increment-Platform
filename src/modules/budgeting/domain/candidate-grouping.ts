/**
 * Gliederung die PB-Liste-Kandidaten: **Run/Grow → Wertstrom → Solution**.
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

// ---------------------------------------------------------------------------
// Arbeitsblatt: Abschnitte
// ---------------------------------------------------------------------------

/**
 * Ein Abschnitt des Arbeitsblatts — die Ebene, die man am Stück abarbeitet.
 *
 * Run wird **ein** Abschnitt über alle Wertströme hinweg (der Wertstrom steht am
 * Titel der Zeile): der Betrieb ist ein Block, den man als Ganzes betrachtet,
 * kein Thema je Wertstrom. Grow zerfällt dagegen in einen Abschnitt je
 * Wertstrom — das ist die Einheit, in der Menschen die Verteilung denken.
 */
export interface WorksheetSection<T> {
  key: string;
  label: string;
  kind: BusinessKind;
  /** Σ über alle Zeilen des Abschnitts, mit der Sortier-Betragsfunktion. */
  total: number;
  /** Solutions mit ihren Zeilen; `heading` steuert die Zwischenüberschrift. */
  solutions: SolutionGroup<T>[];
  items: T[];
}

/** Alle Zeilen unterhalb einer Gruppe — Grundlage der Spalten-Zwischensummen. */
export function groupItems<T>(
  g:
    | Pick<BusinessGroup<T>, "valueStreams">
    | Pick<ValueStreamGroup<T>, "solutions">
    | Pick<SolutionGroup<T>, "items">
    | Pick<WorksheetSection<T>, "items">,
): T[] {
  if ("items" in g) return [...g.items];
  if ("solutions" in g) return g.solutions.flatMap((s) => s.items);
  return g.valueStreams.flatMap((vs) => vs.solutions.flatMap((s) => s.items));
}

/** Faltet gleichnamige Solution-Gruppen zusammen und sortiert nach Betrag. */
function mergeByName<T>(groups: readonly SolutionGroup<T>[]): SolutionGroup<T>[] {
  const merged = new Map<string, SolutionGroup<T>>();
  for (const g of groups) {
    const prev = merged.get(g.name);
    if (prev) {
      prev.total += g.total;
      prev.items = [...prev.items, ...g.items];
    } else {
      merged.set(g.name, { ...g, items: [...g.items] });
    }
  }
  return [...merged.values()].sort(byTotalDesc);
}

/**
 * Setzt die Zwischenüberschriften eines Abschnitts.
 *
 * Neben der Zwei-Zeilen-Regel fällt eine weitere weg: eine **einzelne**
 * namenlose Gruppe („ohne Solution") als einzige des Abschnitts trägt nichts
 * bei — der Abschnitt selbst ist dann schon die Überschrift.
 */
function withHeadings<T>(groups: readonly SolutionGroup<T>[]): SolutionGroup<T>[] {
  const lonelyUnnamed = groups.length === 1 && groups[0]!.name === NO_SOLUTION;
  return groups.map((g) => ({ ...g, heading: g.heading && !lonelyUnnamed }));
}

/**
 * Die Abschnitte des Arbeitsblatts, in Arbeitsreihenfolge: **Run zuerst** (der
 * Pflichtblock, den man nicht übersieht), danach die Grow-Wertströme nach
 * Betrag absteigend — so wie sie schon aus `groupCandidates` kommen.
 */
export function worksheetSections<T extends GroupableCandidate>(
  groups: readonly BusinessGroup<T>[],
): WorksheetSection<T>[] {
  const out: WorksheetSection<T>[] = [];

  for (const kind of BUSINESS_KINDS) {
    const g = groups.find((x) => x.kind === kind);
    if (!g) continue;

    if (kind === "run") {
      // Ein Abschnitt über alle Wertströme. Gleichnamige Solutions müssen dabei
      // verschmelzen — sonst trüge der Abschnitt je Wertstrom eine eigene
      // Überschrift „ohne Solution".
      const solutions = withHeadings(mergeByName(g.valueStreams.flatMap((vs) => vs.solutions)));
      out.push({
        key: "run",
        label: g.label,
        kind,
        total: g.total,
        solutions,
        items: solutions.flatMap((s) => s.items),
      });
      continue;
    }

    for (const vs of g.valueStreams) {
      out.push({
        key: `${kind}:${vs.name}`,
        label: vs.name,
        kind,
        total: vs.total,
        solutions: withHeadings(vs.solutions),
        items: groupItems(vs),
      });
    }
  }

  return out;
}
