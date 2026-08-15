import { describe, it, expect } from "vitest";
import { summarizePiOverview, type PiOverviewInput } from "@/modules/drumbeat/domain/pi-overview";

const EMPTY: PiOverviewInput = {
  features: [],
  openIssues: 0,
};

describe("summarizePiOverview", () => {
  it("returns zeroed metrics for empty input", () => {
    const s = summarizePiOverview(EMPTY);
    expect(s.openIssues).toBe(0);
    expect(s.featureStatus).toEqual([]);
  });

  it("passes the pre-counted open issues through", () => {
    const s = summarizePiOverview({ ...EMPTY, openIssues: 3 });
    expect(s.openIssues).toBe(3);
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
