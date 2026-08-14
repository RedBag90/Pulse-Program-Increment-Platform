import { describe, it, expect } from "vitest";
import { summarizePiOverview, type PiOverviewInput } from "@/modules/drumbeat/domain/pi-overview";

const EMPTY: PiOverviewInput = {
  features: [],
  impediments: [],
};

describe("summarizePiOverview", () => {
  it("returns zeroed metrics for empty input", () => {
    const s = summarizePiOverview(EMPTY);
    expect(s.impediments).toEqual({ open: 0, escalated: 0 });
    expect(s.featureStatus).toEqual([]);
  });

  it("counts open and escalated impediments separately, ignoring resolved", () => {
    const s = summarizePiOverview({
      ...EMPTY,
      impediments: [
        { status: "open" },
        { status: "open" },
        { status: "escalated" },
        { status: "resolved" },
      ],
    });
    expect(s.impediments).toEqual({ open: 2, escalated: 1 });
  });

  it("groups features by status", () => {
    const s = summarizePiOverview({
      ...EMPTY,
      features: [{ status: "draft" }, { status: "in_progress" }, { status: "in_progress" }],
    });
    expect(s.featureStatus).toEqual(
      expect.arrayContaining([
        { status: "draft", count: 1 },
        { status: "in_progress", count: 2 },
      ]),
    );
    expect(s.featureStatus).toHaveLength(2);
  });
});
