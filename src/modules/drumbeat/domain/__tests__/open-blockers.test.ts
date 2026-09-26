import { describe, it, expect } from "vitest";
import { blockingOnly, classifyBlockers } from "@/modules/drumbeat/domain/open-blockers";

const b = (id: string, piId: string | null, status = "in_progress") => ({
  id,
  title: `Feature ${id}`,
  status,
  piId,
});

describe("classifyBlockers", () => {
  it("eine eingehende blocks-Kante aus einem anderen PI blockiert", () => {
    expect(classifyBlockers({ piId: "p2", blocksIn: [b("a", "p1")], dependsOnOut: [] })).toEqual([
      { id: "a", title: "Feature a", state: "blocking" },
    ]);
  });

  it("eine ausgehende depends_on-Kante in den Backlog blockiert", () => {
    const r = classifyBlockers({ piId: "p2", blocksIn: [], dependsOnOut: [b("z", null)] });
    expect(r[0]!.state).toBe("blocking");
  });

  it("ein offener Blocker im selben PI blockiert nicht", () => {
    const r = classifyBlockers({ piId: "p2", blocksIn: [b("a", "p2")], dependsOnOut: [] });
    expect(r[0]!.state).toBe("samePi");
  });

  it("ein Feature im Backlog hat kein „selbes PI“ — der Blocker im Backlog blockiert", () => {
    const r = classifyBlockers({ piId: null, blocksIn: [b("a", null)], dependsOnOut: [] });
    expect(r[0]!.state).toBe("blocking");
  });

  it("erledigte Blocker halten nichts mehr auf", () => {
    const r = classifyBlockers({
      piId: "p2",
      blocksIn: [b("a", "p1", "completed")],
      dependsOnOut: [b("c", "p3", "cancelled")],
    });
    expect(r.map((x) => x.state)).toEqual(["done", "done"]);
  });

  it("drei Kandidaten, einer blockiert — die blockierenden stehen vorn", () => {
    const r = classifyBlockers({
      piId: "p2",
      blocksIn: [b("a", "p2"), b("b", "p1", "completed")],
      dependsOnOut: [b("c", "p3")],
    });
    expect(r.map((x) => [x.id, x.state])).toEqual([
      ["c", "blocking"],
      ["a", "samePi"],
      ["b", "done"],
    ]);
    expect(blockingOnly(r)).toHaveLength(1);
  });

  it("derselbe Blocker über beide Kanten steht einmal da; fehlende Endpunkte fallen weg", () => {
    const r = classifyBlockers({
      piId: "p2",
      blocksIn: [b("a", "p1"), null],
      dependsOnOut: [b("a", "p1")],
    });
    expect(r).toHaveLength(1);
  });
});
