import { describe, it, expect } from "vitest";
import { buildProcessRail, type ProcessStep } from "@/modules/budgeting/server/views/process-rail";

const base = {
  poolTotal: 0,
  stagedCount: 0,
  allocatedTotal: 0,
  artRowCount: 0,
  latestIsCurrentCycle: false,
};

function get(steps: ProcessStep[], key: string): ProcessStep {
  const s = steps.find((x) => x.key === key);
  if (!s) throw new Error(`step ${key} missing`);
  return s;
}

describe("buildProcessRail", () => {
  it("empty tenant: nothing done; downstream steps blocked by missing preconditions", () => {
    const steps = buildProcessRail(base);
    expect(get(steps, "topf")).toMatchObject({ done: false, blocked: false });
    expect(get(steps, "vormerken")).toMatchObject({ done: false, blocked: false });
    expect(get(steps, "zuteilen")).toMatchObject({ done: false, blocked: true }); // no pool
    expect(get(steps, "arts")).toMatchObject({ done: false, blocked: true }); // no allocation
    expect(get(steps, "snapshot")).toMatchObject({ done: false, blocked: true }); // no allocation
  });

  it("pool set unblocks Zuteilen but not ARTs/Snapshot", () => {
    const steps = buildProcessRail({ ...base, poolTotal: 42000 });
    expect(get(steps, "topf").done).toBe(true);
    expect(get(steps, "zuteilen")).toMatchObject({ done: false, blocked: false });
    expect(get(steps, "arts").blocked).toBe(true);
    expect(get(steps, "snapshot").blocked).toBe(true);
  });

  it("allocation done unblocks ARTs and Snapshot", () => {
    const steps = buildProcessRail({ ...base, poolTotal: 42000, allocatedTotal: 40000 });
    expect(get(steps, "zuteilen").done).toBe(true);
    expect(get(steps, "arts")).toMatchObject({ done: false, blocked: false });
    expect(get(steps, "snapshot")).toMatchObject({ done: false, blocked: false });
  });

  it("staging + ART rows + current snapshot mark their steps done", () => {
    const steps = buildProcessRail({
      poolTotal: 42000,
      stagedCount: 4,
      allocatedTotal: 40000,
      artRowCount: 2,
      latestIsCurrentCycle: true,
    });
    expect(get(steps, "vormerken").done).toBe(true);
    expect(get(steps, "arts").done).toBe(true);
    expect(get(steps, "snapshot").done).toBe(true);
    expect(steps).toHaveLength(5);
  });
});
