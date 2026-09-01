import { describe, it, expect } from "vitest";
import {
  activeCycleFromRounds,
  resolveWindowSize,
  nextCycle,
  DEFAULT_WINDOW_SIZE,
  type CycleRound,
} from "@/modules/budgeting/domain/budget-cycle";

const now = new Date("2026-08-01T00:00:00.000Z"); // → 2026-H2

const round = (cycleKey: string, status: string, startDate: string | null = null): CycleRound => ({
  cycleKey,
  status,
  startDate: startDate ? new Date(startDate) : null,
});

describe("activeCycleFromRounds", () => {
  it("nimmt die laufende Kachel", () => {
    expect(
      activeCycleFromRounds(
        [round("2027-H1", "draft", "2027-01-01"), round("2026-H1", "running", "2026-01-01")],
        now,
      ),
    ).toBe("2026-H1");
  });

  it("ohne laufende Kachel die jüngste", () => {
    expect(
      activeCycleFromRounds(
        [round("2026-H1", "closed", "2026-01-01"), round("2027-H1", "draft", "2027-01-01")],
        now,
      ),
    ).toBe("2027-H1");
  });

  it("ohne Start-Termin entscheidet der Zyklus-Schlüssel", () => {
    expect(
      activeCycleFromRounds([round("2026-H1", "closed"), round("2026-H2", "draft")], now),
    ).toBe("2026-H2");
  });

  it("ganz ohne Kacheln gilt das heutige Halbjahr", () => {
    expect(activeCycleFromRounds([], now)).toBe("2026-H2");
  });
});

describe("resolveWindowSize", () => {
  it("defaults to 4 when unset", () => {
    expect(resolveWindowSize({ budgetWindowSize: null })).toBe(DEFAULT_WINDOW_SIZE);
  });
  it("clamps below the minimum and above the maximum", () => {
    expect(resolveWindowSize({ budgetWindowSize: 1 })).toBe(2);
    expect(resolveWindowSize({ budgetWindowSize: 99 })).toBe(8);
  });
  it("passes a valid size through", () => {
    expect(resolveWindowSize({ budgetWindowSize: 6 })).toBe(6);
  });
});

describe("nextCycle", () => {
  it("rolls H1 → H2 within the year", () => {
    expect(nextCycle("2026-H1")).toBe("2026-H2");
  });
  it("rolls H2 → H1 of the next year", () => {
    expect(nextCycle("2026-H2")).toBe("2027-H1");
  });
});
