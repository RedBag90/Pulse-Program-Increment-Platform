import { describe, it, expect } from "vitest";
import { buildFeaturesListModel } from "@/server/views/features-list";

const feature = (
  over: Partial<{
    id: string;
    title: string;
    status: string;
    artId: string;
    piId: string | null;
    parent: { id: string; title: string } | null;
    pi: { id: string; name: string } | null;
    wsjfBusinessValue: number | null;
    wsjfTimeCriticality: number | null;
    wsjfRiskReduction: number | null;
    wsjfJobSize: number | null;
    wsjfComputed: number | null;
    acceptanceCriteria: string[];
    createdAt: Date;
  }>,
) => ({
  id: "f1",
  title: "Feature 1",
  status: "draft",
  artId: "art-default",
  piId: null,
  parent: { id: "e1", title: "Epic 1" },
  pi: null,
  wsjfBusinessValue: null,
  wsjfTimeCriticality: null,
  wsjfRiskReduction: null,
  wsjfJobSize: null,
  wsjfComputed: null,
  acceptanceCriteria: [],
  createdAt: new Date("2026-01-01T00:00:00Z"),
  ...over,
});

describe("buildFeaturesListModel", () => {
  it("emits every funnel status slot even when empty", () => {
    const m = buildFeaturesListModel({
      features: [
        feature({ id: "a", status: "draft" }),
        feature({ id: "b", status: "approved" }),
        feature({ id: "c", status: "draft" }),
      ],
      epics: [],
      pis: [],
      blockedFeatureIds: new Set(),
      showWsjf: false,
    });
    expect(m.funnelCounts).toEqual({
      draft: 2,
      approved: 1,
      in_progress: 0,
      completed: 0,
    });
  });

  it("classifies WSJF tier on the configured thresholds", () => {
    const m = buildFeaturesListModel({
      features: [
        feature({ id: "high", wsjfComputed: 8 }),
        feature({ id: "med", wsjfComputed: 3 }),
        feature({ id: "low", wsjfComputed: 1 }),
        feature({ id: "none", wsjfComputed: null }),
      ],
      epics: [],
      pis: [],
      blockedFeatureIds: new Set(),
      showWsjf: true,
    });
    const tiers = Object.fromEntries(m.rows.map((r) => [r.id, r.wsjfTier]));
    expect(tiers).toEqual({ high: "high", med: "medium", low: "low", none: "none" });
  });

  it("marks features as blocked when listed in blockedFeatureIds", () => {
    const m = buildFeaturesListModel({
      features: [feature({ id: "blocked" }), feature({ id: "ok", title: "F2" })],
      epics: [],
      pis: [],
      blockedFeatureIds: new Set(["blocked"]),
      showWsjf: false,
    });
    expect(m.rows.find((r) => r.id === "blocked")!.isBlocked).toBe(true);
    expect(m.rows.find((r) => r.id === "ok")!.isBlocked).toBe(false);
  });

  it("emits only Epics that actually parent a feature (no orphan chips)", () => {
    const m = buildFeaturesListModel({
      features: [
        feature({ id: "a", parent: { id: "e1", title: "Used" } }),
        feature({ id: "b", parent: { id: "e1", title: "Used" } }),
      ],
      epics: [
        { id: "e1", title: "Used" },
        { id: "e2", title: "Orphan — no features here" },
      ],
      pis: [],
      blockedFeatureIds: new Set(),
      showWsjf: false,
    });
    expect(m.epicOptions.map((e) => e.id)).toEqual(["e1"]);
  });

  it("splits PIs into options vs assignable (completed PIs excluded)", () => {
    const m = buildFeaturesListModel({
      features: [],
      epics: [],
      pis: [
        { id: "pi1", name: "Active PI", status: "active" },
        { id: "pi2", name: "Planned PI", status: "planned" },
        { id: "pi3", name: "Done PI", status: "completed" },
      ],
      blockedFeatureIds: new Set(),
      showWsjf: false,
    });
    expect(m.piOptions.map((p) => p.id)).toEqual(["pi1", "pi2", "pi3"]);
    expect(m.assignablePis.map((p) => p.id)).toEqual(["pi1", "pi2"]);
  });

  it("counts acceptance-criteria length per row", () => {
    const m = buildFeaturesListModel({
      features: [
        feature({ id: "a", acceptanceCriteria: ["one", "two", "three"] }),
        feature({ id: "b", acceptanceCriteria: [] }),
      ],
      epics: [],
      pis: [],
      blockedFeatureIds: new Set(),
      showWsjf: false,
    });
    expect(m.rows.find((r) => r.id === "a")!.acceptanceCriteriaCount).toBe(3);
    expect(m.rows.find((r) => r.id === "b")!.acceptanceCriteriaCount).toBe(0);
  });
});
