import { describe, it, expect } from "vitest";
import {
  standardPiSchedule,
  selectFreeStandardPis,
  type PiStandardSpec,
} from "@/domain/pi-standard";

const utc = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);

// The captured "Event Management Travel ART" standard: anchored Jan 14, 8-week
// cadence, 6 PIs.
const captured: PiStandardSpec = { anchorMonth: 1, anchorDay: 14, cadenceWeeks: 8, piCount: 6 };

describe("standardPiSchedule", () => {
  it("reproduces the captured 2026 dates (6 contiguous 8-week PIs)", () => {
    const s = standardPiSchedule(captured, 2026);
    expect(s.map((p) => p.name)).toEqual(["PI 1", "PI 2", "PI 3", "PI 4", "PI 5", "PI 6"]);
    expect(s.map((p) => [iso(p.startDate), iso(p.endDate)])).toEqual([
      ["2026-01-14", "2026-03-10"],
      ["2026-03-11", "2026-05-05"],
      ["2026-05-06", "2026-06-30"],
      ["2026-07-01", "2026-08-25"],
      ["2026-08-26", "2026-10-20"],
      ["2026-10-21", "2026-12-15"],
    ]);
  });

  it("makes each PI exactly cadence-weeks long and contiguous", () => {
    const s = standardPiSchedule(captured, 2026);
    for (const pi of s) {
      const days = (pi.endDate.getTime() - pi.startDate.getTime()) / (24 * 3600 * 1000) + 1;
      expect(days).toBe(56);
    }
    for (let i = 1; i < s.length; i++) {
      const gap = (s[i]!.startDate.getTime() - s[i - 1]!.endDate.getTime()) / (24 * 3600 * 1000);
      expect(gap).toBe(1); // next starts the day after the previous ends
    }
  });
});

describe("selectFreeStandardPis", () => {
  it("keeps only the PIs whose range does not overlap an existing PI", () => {
    const schedule = standardPiSchedule(captured, 2026);
    // A manual PI 01.06–01.08 overlaps PI 3 (06.05–30.06) and PI 4 (01.07–25.08).
    const free = selectFreeStandardPis(schedule, [
      { startDate: utc("2026-06-01"), endDate: utc("2026-08-01") },
    ]);
    expect(free.map((p) => p.name)).toEqual(["PI 1", "PI 2", "PI 5", "PI 6"]);
  });

  it("returns the whole schedule when nothing exists yet", () => {
    const schedule = standardPiSchedule(captured, 2026);
    expect(selectFreeStandardPis(schedule, [])).toHaveLength(6);
  });

  it("is idempotent — re-applying against the schedule's own copies keeps nothing", () => {
    const schedule = standardPiSchedule(captured, 2026);
    expect(selectFreeStandardPis(schedule, schedule)).toEqual([]);
  });

  it("treats touching edges as overlap (inclusive bounds)", () => {
    const schedule = standardPiSchedule(captured, 2026);
    // Existing PI ends exactly on PI 1's start (2026-01-14) → PI 1 is skipped.
    const free = selectFreeStandardPis(schedule, [
      { startDate: utc("2026-01-01"), endDate: utc("2026-01-14") },
    ]);
    expect(free.map((p) => p.name)).not.toContain("PI 1");
    expect(free.map((p) => p.name)).toContain("PI 2");
  });
});
