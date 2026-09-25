import { describe, it, expect } from "vitest";
import { buildBreakdownGraph } from "@/modules/drumbeat/server/views/breakdown-network-view";

const feature = (over: Partial<{ id: string; wsjfComputed: number | null }> = {}) => ({
  id: over.id ?? "f1",
  title: `Title ${over.id ?? "f1"}`,
  status: "draft",
  artName: "ART A",
  featureType: "feature" as string | null,
  wsjfComputed: over.wsjfComputed ?? null,
  wsjfBusinessValue: null,
  wsjfTimeCriticality: null,
  wsjfRiskReduction: null,
  wsjfJobSize: null,
  piId: null,
});

describe("buildBreakdownGraph", () => {
  it("baut nodes aus den features und uebersetzt wsjf-tier", () => {
    const m = buildBreakdownGraph({
      features: [
        feature({ id: "a", wsjfComputed: 10 }),
        feature({ id: "b", wsjfComputed: 5 }),
        feature({ id: "c", wsjfComputed: 1 }),
        feature({ id: "d", wsjfComputed: null }),
      ],
      dependencies: [],
    });
    expect(m.nodes).toHaveLength(4);
    expect(m.nodes.find((n) => n.id === "a")?.wsjfTier).toBe("high");
    expect(m.nodes.find((n) => n.id === "b")?.wsjfTier).toBe("medium");
    expect(m.nodes.find((n) => n.id === "c")?.wsjfTier).toBe("low");
    expect(m.nodes.find((n) => n.id === "d")?.wsjfTier).toBe("unscored");
  });

  it("uebernimmt nur dependencies mit beiden endpunkten im scope", () => {
    const m = buildBreakdownGraph({
      features: [feature({ id: "a" }), feature({ id: "b" })],
      dependencies: [
        { id: "e1", fromId: "a", toId: "b", type: "depends_on" },
        {
          id: "e2",
          fromId: "a",
          toId: "outside",
          type: "depends_on",
          to: { id: "outside", title: "Outside-T", parent: { id: "ep2", title: "Other Epic" } },
        },
        {
          id: "e3",
          fromId: "outside",
          toId: "b",
          type: "blocks",
          from: { id: "outside", title: "Outside-S", parent: { id: "ep3", title: "External" } },
        },
      ],
    });
    // P6: cross-epic-edges bleiben jetzt drin (mit ghost-endpunkten).
    expect(m.edges.map((e) => e.id).sort()).toEqual(["e1", "e2", "e3"]);
    expect(m.droppedEdgeCount).toBe(0);
    expect(m.ghostNodes).toHaveLength(2);
    const successor = m.ghostNodes.find((g) => g.role === "successor");
    const predecessor = m.ghostNodes.find((g) => g.role === "predecessor");
    // Die Id traegt die **Rolle**, nicht nur die Initiative — dieselbe
    // Initiative kann fuer dasselbe Epic Vorgaenger und Nachfolger sein.
    expect(successor?.id).toBe("ghost:successor:outside");
    expect(successor?.initiativeId).toBe("outside");
    expect(successor?.epicTitle).toBe("Other Epic");
    expect(predecessor?.epicTitle).toBe("External");
  });

  /**
   * **Zwei Rollen, zwei Knoten.** Die Geister-Id war die rohe Initiative-Id:
   * ein Feature, das fuer dieses Epic zugleich Vorgaenger und Nachfolger ist,
   * ergab zwei Eintraege mit derselben Id — und zwei ReactFlow-Knoten mit
   * einer Id sind ein Knoten. Der zweite ueberschrieb den ersten.
   */
  it("trennt ein externes Feature, das beide Rollen hat", () => {
    const m = buildBreakdownGraph({
      features: [feature({ id: "a" })],
      dependencies: [
        {
          id: "e1",
          fromId: "beides",
          toId: "a",
          type: "blocks",
          from: { id: "beides", title: "Beides", parent: { id: "ep9", title: "Fremd" } },
        },
        {
          id: "e2",
          fromId: "a",
          toId: "beides",
          type: "depends_on",
          to: { id: "beides", title: "Beides", parent: { id: "ep9", title: "Fremd" } },
        },
      ],
    });

    expect(m.ghostNodes.map((g) => g.id).sort()).toEqual([
      "ghost:predecessor:beides",
      "ghost:successor:beides",
    ]);
    // Und die Kanten zeigen auf den jeweils richtigen der beiden.
    expect(m.edges.find((e) => e.id === "e1")?.source).toBe("ghost:predecessor:beides");
    expect(m.edges.find((e) => e.id === "e2")?.target).toBe("ghost:successor:beides");
  });

  it("ignoriert unbekannte dependency-types und zaehlt sie als dropped", () => {
    const m = buildBreakdownGraph({
      features: [feature({ id: "a" }), feature({ id: "b" })],
      dependencies: [
        { id: "e1", fromId: "a", toId: "b", type: "depends_on" },
        { id: "e2", fromId: "a", toId: "b", type: "frobnicates" },
      ],
    });
    expect(m.edges).toHaveLength(1);
    expect(m.droppedEdgeCount).toBe(1);
  });

  it("akzeptiert die drei gueltigen dependency-types", () => {
    const m = buildBreakdownGraph({
      features: [feature({ id: "a" }), feature({ id: "b" })],
      dependencies: [
        { id: "e1", fromId: "a", toId: "b", type: "blocks" },
        { id: "e2", fromId: "a", toId: "b", type: "depends_on" },
        { id: "e3", fromId: "a", toId: "b", type: "relates_to" },
      ],
    });
    expect(m.edges.map((e) => e.type)).toEqual(["blocks", "depends_on", "relates_to"]);
  });

  it("leeres scope → leere ausgabe", () => {
    const m = buildBreakdownGraph({ features: [], dependencies: [] });
    expect(m.nodes).toEqual([]);
    expect(m.edges).toEqual([]);
    expect(m.droppedEdgeCount).toBe(0);
  });
});
