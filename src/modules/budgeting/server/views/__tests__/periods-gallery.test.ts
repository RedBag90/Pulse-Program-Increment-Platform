import { describe, it, expect } from "vitest";
import {
  buildPeriodsGallery,
  type PeriodRoundInput,
} from "@/modules/budgeting/server/views/periods-gallery";

const NOW = new Date("2026-03-01T00:00:00.000Z");

function round(p: Partial<PeriodRoundInput> & { id: string }): PeriodRoundInput {
  return {
    cycleKey: "2026-H1",
    status: "draft",
    poolTotal: 1000,
    startDate: null,
    endDate: null,
    submissionDeadline: null,
    participantCount: 0,
    groupCount: 0,
    submittedCount: 0,
    reserveAmount: 0,
    ...p,
  };
}

describe("buildPeriodsGallery", () => {
  it("trennt Fokus (nicht abgeschlossen) von Vergangen (closed)", () => {
    const m = buildPeriodsGallery(
      [
        round({ id: "a", status: "running" }),
        round({ id: "b", status: "closed" }),
        round({ id: "c", status: "draft" }),
      ],
      true,
      NOW,
    );
    expect(m.focus.map((t) => t.id).sort()).toEqual(["a", "c"]);
    expect(m.past.map((t) => t.id)).toEqual(["b"]);
    expect(m.canManage).toBe(true);
  });

  it("listet nur abgeschlossene Kacheln mit offener Reserve als übertragbar", () => {
    const m = buildPeriodsGallery(
      [
        round({ id: "a", status: "closed", cycleKey: "2026-H1", reserveAmount: 150_000 }),
        round({ id: "b", status: "closed", cycleKey: "2026-H2", reserveAmount: 0 }),
        round({ id: "c", status: "running", cycleKey: "2027-H1", reserveAmount: 999 }),
      ],
      true,
      NOW,
    );
    expect(m.carriableReserves).toEqual([
      { cycleKey: "2026-H1", label: "H1 2026", startDate: null, amount: 150_000 },
    ]);
  });

  it("markiert Zukunfts-Zeiträume als upcoming", () => {
    const m = buildPeriodsGallery(
      [
        round({ id: "future", status: "running", startDate: new Date("2026-07-01T00:00:00.000Z") }),
        round({
          id: "current",
          status: "running",
          startDate: new Date("2026-01-01T00:00:00.000Z"),
        }),
      ],
      false,
      NOW,
    );
    const byId = new Map(m.focus.map((t) => [t.id, t]));
    expect(byId.get("future")!.upcoming).toBe(true);
    expect(byId.get("current")!.upcoming).toBe(false);
  });

  it("sortiert nach Start-Termin, späteste zuerst", () => {
    const m = buildPeriodsGallery(
      [
        round({ id: "early", startDate: new Date("2026-01-01T00:00:00.000Z") }),
        round({ id: "late", startDate: new Date("2026-07-01T00:00:00.000Z") }),
      ],
      true,
      NOW,
    );
    expect(m.focus.map((t) => t.id)).toEqual(["late", "early"]);
  });

  it("Abgabe-Kennzahlen wandern in die Kachel", () => {
    const m = buildPeriodsGallery(
      [
        round({
          id: "a",
          status: "running",
          groupCount: 4,
          submittedCount: 2,
          participantCount: 12,
        }),
      ],
      true,
      NOW,
    );
    expect(m.focus[0]).toMatchObject({ groupCount: 4, submittedCount: 2, participantCount: 12 });
  });
});
