import { describe, it, expect } from "vitest";
import { buildDependenciesListModel } from "@/server/views/dependencies-list";

const now = new Date("2026-06-15T00:00:00Z");

const feature = (over: {
  id: string;
  title?: string;
  status?: string;
  artId?: string | null;
  piId?: string | null;
}) => ({
  id: over.id,
  title: over.title ?? `Feature ${over.id}`,
  status: over.status ?? "approved",
  artId: over.artId ?? null,
  parentId: null,
  piId: over.piId ?? null,
});

const dep = (over: {
  id: string;
  type: string;
  fromId: string;
  toId: string;
  createdAt?: Date;
}) => ({
  id: over.id,
  type: over.type,
  fromId: over.fromId,
  toId: over.toId,
  createdAt: over.createdAt ?? new Date("2026-06-01T00:00:00Z"),
});

describe("buildDependenciesListModel", () => {
  it("counts every dependency type slot even when empty", () => {
    const m = buildDependenciesListModel({
      dependencies: [
        dep({ id: "d1", type: "blocks", fromId: "f1", toId: "f2" }),
        dep({ id: "d2", type: "depends_on", fromId: "f2", toId: "f1" }),
        dep({ id: "d3", type: "blocks", fromId: "f3", toId: "f1" }),
      ],
      features: [feature({ id: "f1" }), feature({ id: "f2" }), feature({ id: "f3" })],
      arts: [],
      pis: [],
      piIdInScope: "pi1",
      orphanCount: 0,
      now,
    });
    expect(m.funnelCounts).toEqual({ blocks: 2, depends_on: 1, relates_to: 0 });
  });

  it("computes daysOpen from createdAt", () => {
    const m = buildDependenciesListModel({
      dependencies: [
        dep({
          id: "d1",
          type: "blocks",
          fromId: "f1",
          toId: "f2",
          createdAt: new Date("2026-06-08T00:00:00Z"),
        }),
      ],
      features: [feature({ id: "f1" }), feature({ id: "f2" })],
      arts: [],
      pis: [],
      piIdInScope: "pi1",
      orphanCount: 0,
      now,
    });
    expect(m.rows[0]!.daysOpen).toBe(7);
  });

  it("flags cross-ART deps when from + to live in different ARTs", () => {
    const m = buildDependenciesListModel({
      dependencies: [
        dep({ id: "d-cross", type: "blocks", fromId: "f1", toId: "f2" }),
        dep({ id: "d-same", type: "blocks", fromId: "f1", toId: "f3" }),
      ],
      features: [
        feature({ id: "f1", artId: "art1" }),
        feature({ id: "f2", artId: "art2" }),
        feature({ id: "f3", artId: "art1" }),
      ],
      arts: [
        { id: "art1", name: "Mobile" },
        { id: "art2", name: "Payments" },
      ],
      pis: [],
      piIdInScope: "pi1",
      orphanCount: 0,
      now,
    });
    expect(m.rows.find((r) => r.id === "d-cross")!.isCrossArt).toBe(true);
    expect(m.rows.find((r) => r.id === "d-same")!.isCrossArt).toBe(false);
  });

  it("flags critical-path when type=blocks AND to-endpoint is in the active PI", () => {
    const m = buildDependenciesListModel({
      dependencies: [
        dep({ id: "d-crit", type: "blocks", fromId: "f1", toId: "f-in" }),
        dep({ id: "d-blocks-out", type: "blocks", fromId: "f1", toId: "f-out" }),
        dep({ id: "d-soft", type: "relates_to", fromId: "f1", toId: "f-in" }),
      ],
      features: [
        feature({ id: "f1" }),
        feature({ id: "f-in", piId: "pi-active" }),
        feature({ id: "f-out", piId: "pi-other" }),
      ],
      arts: [],
      pis: [],
      piIdInScope: "pi-active",
      orphanCount: 0,
      now,
    });
    expect(m.rows.find((r) => r.id === "d-crit")!.isCriticalPath).toBe(true);
    expect(m.rows.find((r) => r.id === "d-blocks-out")!.isCriticalPath).toBe(false);
    expect(m.rows.find((r) => r.id === "d-soft")!.isCriticalPath).toBe(false);
  });

  it("emits feature options as the union of all referenced ids", () => {
    const m = buildDependenciesListModel({
      dependencies: [
        dep({ id: "d1", type: "blocks", fromId: "f1", toId: "f2" }),
        dep({ id: "d2", type: "depends_on", fromId: "f3", toId: "f1" }),
      ],
      features: [feature({ id: "f1" }), feature({ id: "f2" }), feature({ id: "f3" })],
      arts: [],
      pis: [],
      piIdInScope: "pi1",
      orphanCount: 0,
      now,
    });
    expect(m.featureOptions.map((f) => f.id).sort()).toEqual(["f1", "f2", "f3"]);
  });

  it("falls back to placeholder when a feature row is missing", () => {
    const m = buildDependenciesListModel({
      dependencies: [dep({ id: "d1", type: "blocks", fromId: "f1", toId: "missing" })],
      features: [feature({ id: "f1" })],
      arts: [],
      pis: [],
      piIdInScope: "pi1",
      orphanCount: 0,
      now,
    });
    expect(m.rows[0]!.to.title).toBe("Unbekanntes Feature");
  });
});
