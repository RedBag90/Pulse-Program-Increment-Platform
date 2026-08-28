import { describe, it, expect } from "vitest";
import {
  buildFeatureDetailModel,
  wsjfTier,
  type FeatureDetailInput,
} from "@/modules/drumbeat/server/views/feature-detail";

const base = (over: Partial<FeatureDetailInput> = {}): FeatureDetailInput => ({
  id: "f1",
  title: "Test Feature",
  description: null,
  status: "approved",
  stageGate: null,
  parentId: null,
  parentTitle: null,
  parentStageGate: null,
  artId: null,
  artName: null,
  valueStreamId: null,
  valueStreamName: null,
  piId: null,
  piName: null,
  piStartDate: null,
  piEndDate: null,
  ownerId: null,
  ownerLabel: null,
  wsjfBusinessValue: null,
  wsjfTimeCriticality: null,
  wsjfRiskReduction: null,
  wsjfJobSize: null,
  wsjfComputed: null,
  acceptanceCriteria: [],
  featureType: null,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-02"),
  ...over,
});

describe("wsjfTier", () => {
  it("klassifiziert nach Schwellwerten", () => {
    expect(wsjfTier(null)).toBe("unscored");
    expect(wsjfTier(3.9)).toBe("low");
    expect(wsjfTier(4)).toBe("medium");
    expect(wsjfTier(7.9)).toBe("medium");
    expect(wsjfTier(8)).toBe("high");
    expect(wsjfTier(20)).toBe("high");
  });
});

describe("buildFeatureDetailModel", () => {
  it("erlaubt approved → in_progress + cancelled", () => {
    const m = buildFeatureDetailModel(base({ status: "approved" }));
    expect(m.allowedTransitions).toEqual(["in_progress", "cancelled"]);
  });

  it("erlaubt in_progress → blocked, completed, cancelled", () => {
    const m = buildFeatureDetailModel(base({ status: "in_progress" }));
    expect(m.allowedTransitions).toEqual(["blocked", "completed", "cancelled"]);
  });

  it("liefert leere Transitions fuer completed (Terminal)", () => {
    const m = buildFeatureDetailModel(base({ status: "completed" }));
    expect(m.allowedTransitions).toEqual([]);
  });

  it("liefert leere Transitions fuer QS-States (draft / in_review)", () => {
    expect(buildFeatureDetailModel(base({ status: "draft" })).allowedTransitions).toEqual([]);
    expect(buildFeatureDetailModel(base({ status: "in_review" })).allowedTransitions).toEqual([]);
  });

  it("schiebt Parent/ART/VS/PI nur durch, wenn beide Felder gefuellt sind", () => {
    const start = new Date("2026-01-06");
    const end = new Date("2026-03-27");
    const m = buildFeatureDetailModel(
      base({
        stageGate: "L3",
        parentId: "e1",
        parentTitle: "Parent Epic",
        parentStageGate: "L2",
        artId: "a1",
        artName: "ART 1",
        valueStreamId: "vs1",
        valueStreamName: "VS 1",
        piId: "p1",
        piName: "PI 2026-Q1",
        piStartDate: start,
        piEndDate: end,
      }),
    );
    expect(m.stageGate).toBe("L3");
    expect(m.parent).toEqual({ id: "e1", title: "Parent Epic", stageGate: "L2" });
    expect(m.art).toEqual({ id: "a1", name: "ART 1" });
    expect(m.valueStream).toEqual({ id: "vs1", name: "VS 1" });
    expect(m.pi).toEqual({ id: "p1", name: "PI 2026-Q1", startDate: start, endDate: end });
  });

  it("traegt PI-Daten als null, wenn das PI keine Termine hat", () => {
    const m = buildFeatureDetailModel(base({ piId: "p1", piName: "PI ohne Termine" }));
    expect(m.pi).toEqual({ id: "p1", name: "PI ohne Termine", startDate: null, endDate: null });
  });

  it("setzt Parent auf null, wenn Title fehlt (Soft-Delete-Edge-Case)", () => {
    const m = buildFeatureDetailModel(base({ parentId: "e1", parentTitle: null }));
    expect(m.parent).toBeNull();
  });

  it("klassifiziert WSJF-Tier korrekt am Model", () => {
    const high = buildFeatureDetailModel(base({ wsjfComputed: 10 }));
    expect(high.wsjf.tier).toBe("high");

    const med = buildFeatureDetailModel(base({ wsjfComputed: 5 }));
    expect(med.wsjf.tier).toBe("medium");

    const unscored = buildFeatureDetailModel(base({ wsjfComputed: null }));
    expect(unscored.wsjf.tier).toBe("unscored");
  });
});
