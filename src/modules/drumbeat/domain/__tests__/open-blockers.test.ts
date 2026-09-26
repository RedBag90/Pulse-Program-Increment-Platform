import { describe, it, expect } from "vitest";
import { openBlockers } from "@/modules/drumbeat/domain/open-blockers";

const b = (id: string, status = "in_progress") => ({ id, title: `Feature ${id}`, status });

describe("openBlockers", () => {
  it("eine eingehende blocks-Kante zählt", () => {
    expect(openBlockers({ blocksIn: [b("a")], dependsOnOut: [] })).toEqual([
      { id: "a", title: "Feature a" },
    ]);
  });

  it("eine ausgehende depends_on-Kante zählt", () => {
    expect(openBlockers({ blocksIn: [], dependsOnOut: [b("z")] })).toEqual([
      { id: "z", title: "Feature z" },
    ]);
  });

  it("erledigte Blocker blockieren nicht mehr", () => {
    expect(
      openBlockers({ blocksIn: [b("a", "completed")], dependsOnOut: [b("c", "cancelled")] }),
    ).toEqual([]);
  });

  it("derselbe Blocker über beide Kanten steht einmal da", () => {
    expect(openBlockers({ blocksIn: [b("a")], dependsOnOut: [b("a")] })).toHaveLength(1);
  });

  it("sortiert nach Titel und übergeht fehlende Endpunkte", () => {
    const r = openBlockers({ blocksIn: [b("c"), null], dependsOnOut: [b("a")] });
    expect(r.map((x) => x.id)).toEqual(["a", "c"]);
  });
});
