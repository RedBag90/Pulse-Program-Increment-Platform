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

describe("filterGoalBranches — ganzer Ast", () => {
  const matchX = (x: N) => x.tag === "x";

  it("gibt [] zurück, wenn nichts matcht", () => {
    expect(filterGoalBranches(tree, () => false)).toEqual([]);
  });

  it("zeigt bei self-match den kompletten Unterbaum", () => {
    // nur A matcht direkt → A + A1 sichtbar; via Eltern-Pfad auch T.
    const out = filterGoalBranches(
      [n("root", undefined, [n("A", "x", [n("A1", undefined)])])],
      matchX,
    );
    expect(ids(out)).toEqual(["root", "A", "A1"]);
  });

  it("hält Eltern-Pfad zum Nachfahre-Treffer und prunt unbeteiligte Geschwister", () => {
    const out = filterGoalBranches(tree, matchX);
    // Treffer: A (self) → A+A1; B1 (self) → B1+B2b; Eltern-Pfade: T, B.
    // Weg: B2 (kein Treffer, kein Treffer-Nachfahre) und C/C1 (unbeteiligt).
    expect(ids(out)).toEqual(["T", "A", "A1", "B", "B1", "B2b"]);
  });

  it("zeigt bei Vorfahre-Match den ganzen Unterbaum (auch nicht-passende Kinder)", () => {
    // T matcht → alles darunter sichtbar, unabhängig von tag.
    const out = filterGoalBranches(tree, (x) => x.id === "T");
    expect(ids(out)).toEqual(["T", "A", "A1", "B", "B1", "B2b", "B2", "C", "C1"]);
  });

  it("mutiert die Eingabe nicht", () => {
    const before = ids(tree);
    filterGoalBranches(tree, matchX);
    expect(ids(tree)).toEqual(before);
    expect(tree[0]!.children).toHaveLength(3); // T behält im Original alle 3 Kinder
  });
});
