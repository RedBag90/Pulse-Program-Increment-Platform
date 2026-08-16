import { describe, it, expect } from "vitest";
import { computeAllocationScheduleUpdate } from "@/modules/budgeting/domain/allocation-schedule";

const day = (d: Date | null) => d?.toISOString().slice(0, 10) ?? null;

describe("computeAllocationScheduleUpdate", () => {
  it("a funded window sets both dates + mirrors the timeline estimates (preserving actuals)", () => {
    const result = computeAllocationScheduleUpdate(
      { "2026-H1": 50000, "2026-H2": 70000 },
      { estimates: { detailing: "2025-11-01" }, actuals: { backlog: "2026-02-15" } },
    );

    expect(day(result.plannedStartAt)).toBe("2026-01-01");
    expect(day(result.plannedEndAt)).toBe("2026-12-31");

    // The funded window is mirrored onto the backlog/implementation estimates,
    expect(result.timeline?.estimates.backlog).toBe("2026-01-01");
    expect(result.timeline?.estimates.implementation).toBe("2026-12-31");
    // …while other estimate fields and the owner's actuals survive.
    expect(result.timeline?.estimates.detailing).toBe("2025-11-01");
    expect(result.timeline?.actuals.backlog).toBe("2026-02-15");
  });

  it("EMPTY allocations clear BOTH dates and omit the timeline (clear-on-empty invariant)", () => {
    const result = computeAllocationScheduleUpdate(
      {},
      { estimates: { backlog: "2026-01-01", implementation: "2026-12-31" } },
    );

    expect(result.plannedStartAt).toBeNull();
    expect(result.plannedEndAt).toBeNull();
    // No funded window → the timeline is left untouched (key absent, not undefined value).
    expect("timeline" in result).toBe(false);
  });

  it("all-zero allocations are treated as unfunded (clear both dates, omit timeline)", () => {
    const result = computeAllocationScheduleUpdate({ "2026-H1": 0, "2026-H2": 0 }, {});

    expect(result.plannedStartAt).toBeNull();
    expect(result.plannedEndAt).toBeNull();
    expect("timeline" in result).toBe(false);
  });

  it("a partial (single-period) allocation windows just that one half-year", () => {
    const result = computeAllocationScheduleUpdate({ "2027-H1": 40000 }, {});

    expect(day(result.plannedStartAt)).toBe("2027-01-01");
    expect(day(result.plannedEndAt)).toBe("2027-06-30");
    expect(result.timeline?.estimates.backlog).toBe("2027-01-01");
    expect(result.timeline?.estimates.implementation).toBe("2027-06-30");
  });
});
