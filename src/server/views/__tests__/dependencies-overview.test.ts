import { describe, it, expect } from "vitest";
import { buildDependenciesOverviewModel } from "@/server/views/dependencies-overview";

const features = [
  { id: "fA", title: "A", status: "in_progress", artId: "art-1", piId: "pi-q1" },
  { id: "fB", title: "B", status: "approved", artId: "art-2", piId: "pi-q2" },
  { id: "fC", title: "C", status: "completed", artId: "art-1", piId: "pi-q1" },
  { id: "fD", title: "D", status: "blocked", artId: "art-2", piId: null },
];

const arts = [
  { id: "art-1", name: "Banking" },
  { id: "art-2", name: "Payments" },
  { id: "art-empty", name: "Niemand" },
];

const pis = [
  { id: "pi-q1", name: "2026-Q1", status: "completed" },
  { id: "pi-q2", name: "2026-Q2", status: "active" },
  { id: "pi-q3", name: "2026-Q3", status: "planned" },
];

const dep = (
  over: Partial<{
    id: string;
    type: string;
    fromId: string;
    toId: string;
    createdAt: Date;
  }>,
) => ({
  id: "d1",
  type: "blocks",
  fromId: "fA",
  toId: "fB",
  createdAt: new Date("2026-05-01T00:00:00Z"),
  ...over,
});

const now = new Date("2026-06-06T00:00:00Z");

describe("buildDependenciesOverviewModel", () => {
  it("buckets dependencies into the three type slots", () => {
    const m = buildDependenciesOverviewModel({
      dependencies: [
        dep({ id: "a", type: "blocks" }),
        dep({ id: "b", type: "depends_on" }),
        dep({ id: "c", type: "depends_on" }),
        dep({ id: "d", type: "relates_to" }),
      ],
      features,
      arts,
      pis,
      now,
    });
    expect(m.funnelCounts).toEqual({ blocks: 1, depends_on: 2, relates_to: 1 });
  });

  it("flags isCrossArt when from + to land in different ARTs", () => {
    const m = buildDependenciesOverviewModel({
      dependencies: [
        dep({ id: "x", fromId: "fA", toId: "fB" }),
        dep({ id: "y", fromId: "fA", toId: "fC" }),
      ],
      features,
      arts,
      pis,
      now,
    });
    expect(m.rows[0]!.isCrossArt).toBe(true);
    expect(m.rows[1]!.isCrossArt).toBe(false);
  });

  it("flags isCrossPi when from + to live in different PIs", () => {
    const m = buildDependenciesOverviewModel({
      dependencies: [
        dep({ id: "x", fromId: "fA", toId: "fB" }),
        dep({ id: "y", fromId: "fA", toId: "fC" }),
      ],
      features,
      arts,
      pis,
      now,
    });
    expect(m.rows[0]!.isCrossPi).toBe(true);
    expect(m.rows[1]!.isCrossPi).toBe(false);
  });

  it("isCriticalPath = blocks + target in an active PI", () => {
    const m = buildDependenciesOverviewModel({
      dependencies: [
        // to is fB, pi-q2 = active → critical
        dep({ id: "x", type: "blocks", fromId: "fA", toId: "fB" }),
        // to is fC, pi-q1 = completed → not critical
        dep({ id: "y", type: "blocks", fromId: "fA", toId: "fC" }),
        // type relates_to → not critical even when to is in an active PI
        dep({ id: "z", type: "relates_to", fromId: "fA", toId: "fB" }),
      ],
      features,
      arts,
      pis,
      now,
    });
    expect(m.rows.find((r) => r.id === "x")!.isCriticalPath).toBe(true);
    expect(m.rows.find((r) => r.id === "y")!.isCriticalPath).toBe(false);
    expect(m.rows.find((r) => r.id === "z")!.isCriticalPath).toBe(false);
  });

  it("filters ART + PI options down to those that carry a dependency endpoint", () => {
    const m = buildDependenciesOverviewModel({
      dependencies: [dep({ id: "x", fromId: "fA", toId: "fB" })],
      features,
      arts,
      pis,
      now,
    });
    expect(m.artOptions.map((a) => a.id).sort()).toEqual(["art-1", "art-2"]);
    expect(m.piOptions.map((p) => p.id).sort()).toEqual(["pi-q1", "pi-q2"]);
  });

  it("falls back to the placeholder when a feature id can't be resolved", () => {
    const m = buildDependenciesOverviewModel({
      dependencies: [dep({ id: "x", fromId: "fA", toId: "missing" })],
      features,
      arts,
      pis,
      now,
    });
    expect(m.rows[0]!.to.id).toBe("");
    expect(m.rows[0]!.to.title).toBe("Unbekanntes Feature");
  });
});
