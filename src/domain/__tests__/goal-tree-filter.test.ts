import { describe, it, expect } from "vitest";
import { filterGoalBranches } from "@/domain/goal-tree-filter";

interface N {
  id: string;
  tag?: string | undefined;
  children: N[];
}

const n = (id: string, tag: string | undefined, children: N[] = []): N => ({ id, tag, children });

/** Baum:
 *  T ─ A (tag=x) ─ A1
 *    └ B ─ B1 (tag=x)
 *         └ B2
 *    └ C ─ C1
 */
const tree: N[] = [
  n("T", undefined, [
    n("A", "x", [n("A1", undefined)]),
    n("B", undefined, [n("B1", "x", [n("B2b", undefined)]), n("B2", undefined)]),
    n("C", undefined, [n("C1", undefined)]),
  ]),
];

const ids = (nodes: N[]): string[] => nodes.flatMap((x) => [x.id, ...ids(x.children)]);

describe("filterGoalBranches — strikt (nur Treffer + Eltern-Pfad)", () => {
  const matchX = (x: N) => x.tag === "x";

  it("gibt [] zurück, wenn nichts matcht", () => {
    expect(filterGoalBranches(tree, () => false)).toEqual([]);
  });

  it("self-match zeigt den Knoten OHNE nicht-passende Kinder", () => {
    // A matcht, A1 nicht → nur A (+ Eltern-Pfad root); A1 fällt weg.
    const out = filterGoalBranches(
      [n("root", undefined, [n("A", "x", [n("A1", undefined)])])],
      matchX,
    );
    expect(ids(out)).toEqual(["root", "A"]);
  });

  it("hält Eltern-Pfad zum Treffer, prunt nicht-passende Geschwister UND Nachfahren", () => {
    const out = filterGoalBranches(tree, matchX);
    // Treffer: A (self), B1 (self). Eltern-Pfade: T, B.
    // Weg: A1 (unter Treffer A, kein Match), B2b (unter Treffer B1, kein Match),
    //      B2 und C/C1 (unbeteiligt).
    expect(ids(out)).toEqual(["T", "A", "B", "B1"]);
  });

  it("Vorfahr-Match zieht NICHT den ganzen Unterbaum mit", () => {
    // Nur T matcht → nur T (keine passenden Nachfahren).
    const out = filterGoalBranches(tree, (x) => x.id === "T");
    expect(ids(out)).toEqual(["T"]);
  });

  it("mutiert die Eingabe nicht", () => {
    const before = ids(tree);
    filterGoalBranches(tree, matchX);
    expect(ids(tree)).toEqual(before);
    expect(tree[0]!.children).toHaveLength(3); // T behält im Original alle 3 Kinder
  });
});
