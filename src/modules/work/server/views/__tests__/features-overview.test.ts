import { describe, it, expect } from "vitest";
import { buildFeaturesOverviewModel } from "@/modules/work/server/views/features-overview";

const feature = (
  over: Partial<{
    id: string;
    title: string;
    status: string;
    piId: string | null;
    artId: string | null;
    parent: { id: string; title: string } | null;
    pi: { id: string; name: string } | null;
    wsjfComputed: number | null;
    wsjfBusinessValue: number | null;
    wsjfTimeCriticality: number | null;
    wsjfRiskReduction: number | null;
    wsjfJobSize: number | null;
    acceptanceCriteria: string[];
    createdAt: Date;
    featureType: string | null;
  }>,
) => ({
  id: "f1",
  title: "F1",
  status: "draft",
  piId: null,
  artId: "art-banking",
  parent: { id: "epic-1", title: "Open Banking" },
  pi: null,
  wsjfComputed: null,
  wsjfBusinessValue: null,
  wsjfTimeCriticality: null,
  wsjfRiskReduction: null,
  wsjfJobSize: null,
  acceptanceCriteria: [],
  createdAt: new Date("2026-01-01T00:00:00Z"),
  featureType: null,
  ...over,
});

const arts = [
  { id: "art-banking", name: "Banking Core", valueStreamId: "vs-banking" },
  { id: "art-payments", name: "Payments", valueStreamId: "vs-payments" },
  { id: "art-unused", name: "Niemand", valueStreamId: "vs-banking" },
];

const valueStreams = [
  { id: "vs-banking", name: "Banking" },
  { id: "vs-payments", name: "Payments" },
  { id: "vs-empty", name: "Leer" },
];

describe("buildFeaturesOverviewModel", () => {
  it("classifies WSJF tier on the configured thresholds", () => {
    const model = buildFeaturesOverviewModel({
      features: [
        feature({ id: "a", wsjfComputed: 8 }),
        feature({ id: "b", wsjfComputed: 3 }),
        feature({ id: "c", wsjfComputed: 1 }),
        feature({ id: "d", wsjfComputed: null }),
      ],
      arts,
      valueStreams,
      epics: [{ id: "epic-1", title: "Open Banking" }],
      pis: [],
      blockedFeatureIds: new Set(),
      showWsjf: true,
    });
    expect(model.rows.map((r) => r.wsjfTier)).toEqual(["high", "medium", "low", "none"]);
  });

  it("emits every funnel-status slot even when empty", () => {
    const model = buildFeaturesOverviewModel({
      features: [
        feature({ id: "a", status: "draft" }),
        feature({ id: "b", status: "draft" }),
        feature({ id: "c", status: "in_progress" }),
      ],
      arts,
      valueStreams,
      epics: [{ id: "epic-1", title: "Open Banking" }],
      pis: [],
      blockedFeatureIds: new Set(),
      showWsjf: false,
    });
    expect(model.funnelCounts).toEqual({
      draft: 2,
      approved: 0,
      in_progress: 1,
      completed: 0,
    });
  });

  it("joins ART + Value Stream onto each row via artId", () => {
    const model = buildFeaturesOverviewModel({
      features: [
        feature({ id: "a", artId: "art-banking" }),
        feature({ id: "b", artId: "art-payments" }),
      ],
      arts,
      valueStreams,
      epics: [{ id: "epic-1", title: "Open Banking" }],
      pis: [],
      blockedFeatureIds: new Set(),
      showWsjf: false,
    });
    expect(model.rows[0]!.art.name).toBe("Banking Core");
    expect(model.rows[0]!.valueStream?.name).toBe("Banking");
    expect(model.rows[1]!.art.name).toBe("Payments");
    expect(model.rows[1]!.valueStream?.name).toBe("Payments");
  });

  it("filters ART and Value-Stream options to those that carry features", () => {
    const model = buildFeaturesOverviewModel({
      features: [feature({ id: "a", artId: "art-banking" })],
      arts,
      valueStreams,
      epics: [{ id: "epic-1", title: "Open Banking" }],
      pis: [],
      blockedFeatureIds: new Set(),
      showWsjf: false,
    });
    expect(model.artOptions.map((a) => a.id)).toEqual(["art-banking"]);
    expect(model.valueStreamOptions.map((v) => v.id)).toEqual(["vs-banking"]);
  });

  it("marks a feature as blocked when its id appears in blockedFeatureIds", () => {
    const model = buildFeaturesOverviewModel({
      features: [feature({ id: "blocked" }), feature({ id: "free" })],
      arts,
      valueStreams,
      epics: [{ id: "epic-1", title: "Open Banking" }],
      pis: [],
      blockedFeatureIds: new Set(["blocked"]),
      showWsjf: false,
    });
    expect(model.rows.find((r) => r.id === "blocked")!.isBlocked).toBe(true);
    expect(model.rows.find((r) => r.id === "free")!.isBlocked).toBe(false);
  });

  it("falls back to a placeholder ART when artId resolves to no row", () => {
    const model = buildFeaturesOverviewModel({
      features: [feature({ id: "x", artId: "art-unknown" })],
      arts,
      valueStreams,
      epics: [{ id: "epic-1", title: "Open Banking" }],
      pis: [],
      blockedFeatureIds: new Set(),
      showWsjf: false,
    });
    expect(model.rows[0]!.art).toEqual({ id: "", name: "—" });
    expect(model.rows[0]!.valueStream).toBeNull();
  });
});
