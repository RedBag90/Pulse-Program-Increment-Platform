import { describe, it, expect } from "vitest";
import { aggregateArtFeatureLoad, artBudgetRemaining } from "@/domain/art-budget";

const utc = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe("aggregateArtFeatureLoad", () => {
  it("buckets features by their PI's half-year and sums Job Size; no PI → Backlog", () => {
    const [a] = aggregateArtFeatureLoad(
      ["art1"],
      [
        { artId: "art1", piStart: utc("2026-02-01"), jobSize: 5 }, // 2026-H1
        { artId: "art1", piStart: utc("2026-04-01"), jobSize: 3 }, // 2026-H1
        { artId: "art1", piStart: utc("2026-09-01"), jobSize: 8 }, // 2026-H2
        { artId: "art1", piStart: null, jobSize: 2 }, // backlog
      ],
    );
    expect(a!.byPeriod["2026-H1"]).toEqual({ count: 2, jobSize: 8 });
    expect(a!.byPeriod["2026-H2"]).toEqual({ count: 1, jobSize: 8 });
    expect(a!.backlog).toEqual({ count: 1, jobSize: 2 });
    expect(a!.total).toEqual({ count: 4, jobSize: 18 });
  });

  it("returns a zeroed entry for an ART with no features", () => {
    const [a] = aggregateArtFeatureLoad(["empty"], []);
    expect(a).toEqual({
      artId: "empty",
      byPeriod: {},
      backlog: { count: 0, jobSize: 0 },
      total: { count: 0, jobSize: 0 },
    });
  });

  it("ignores features whose ART is not in the set", () => {
    const out = aggregateArtFeatureLoad(["art1"], [{ artId: "other", piStart: null, jobSize: 9 }]);
    expect(out).toHaveLength(1);
    expect(out[0]!.total).toEqual({ count: 0, jobSize: 0 });
  });
});

describe("artBudgetRemaining", () => {
  it("subtracts the sum of ART allocations from the VS budget per period", () => {
    const remaining = artBudgetRemaining(
      { "2026-H1": 100, "2026-H2": 50 },
      [{ "2026-H1": 60, "2026-H2": 20 }, { "2026-H1": 30 }],
      ["2026-H1", "2026-H2"],
    );
    expect(remaining["2026-H1"]).toBe(10); // 100 − (60 + 30)
    expect(remaining["2026-H2"]).toBe(30); // 50 − 20
  });

  it("goes negative when ARTs are over-allocated", () => {
    const remaining = artBudgetRemaining({ "2026-H1": 40 }, [{ "2026-H1": 70 }], ["2026-H1"]);
    expect(remaining["2026-H1"]).toBe(-30);
  });
});
