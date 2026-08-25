import { describe, it, expect } from "vitest";
import { buildEpicStageTimeline, stageAtMonth } from "@/modules/work/domain/epic-stage-timeline";

/** yyyy-mm month-start (UTC) as a plain Date, for stageAtMonth queries. */
const m = (y: number, mo: number) => new Date(Date.UTC(y, mo - 1, 1));

const baseInput = {
  createdAt: "2026-01-15",
  selectedForDetailingAt: null,
  hypothesisApprovedAt: null,
  selectedForAnalyzingAt: null,
  businessCaseApprovedAt: null,
  implementationStartedAt: null,
  impactRecognizedAt: null,
  timeline: {},
};

describe("buildEpicStageTimeline — effektive Übergänge (Actual ?? Estimate)", () => {
  it("setzt L0 auf createdAt und sortiert aufsteigend", () => {
    const tl = buildEpicStageTimeline({
      ...baseInput,
      timeline: { estimates: { backlog: "2026-05-01", implementation: "2026-08-01" } },
    });
    expect(tl[0]).toMatchObject({ gate: "L0", month: m(2026, 1) });
    const times = tl.map((t) => t.month.getTime());
    expect(times).toEqual([...times].sort((a, b) => a - b));
    expect(tl.at(-1)).toMatchObject({ gate: "L4", month: m(2026, 8) });
  });

  it("bevorzugt das Actual-Datum vor dem Estimate derselben Phase", () => {
    const tl = buildEpicStageTimeline({
      ...baseInput,
      // Estimate detailing = Juni, aber Actual (selectedForDetailingAt) = Februar.
      selectedForDetailingAt: "2026-02-10",
      timeline: { estimates: { detailing: "2026-06-01" } },
    });
    const l1 = tl.filter((t) => t.gate === "L1");
    expect(l1).toHaveLength(1);
    expect(l1[0]!.month).toEqual(m(2026, 2)); // Actual gewinnt
  });

  it("lässt Phasen ohne Datum (weder Actual noch Estimate) weg", () => {
    const tl = buildEpicStageTimeline(baseInput);
    expect(tl.map((t) => t.gate)).toEqual(["L0"]);
  });
});

describe("stageAtMonth — Status je Kalendermonat", () => {
  const tl = buildEpicStageTimeline({
    ...baseInput,
    createdAt: "2026-01-01",
    timeline: { estimates: { backlog: "2026-04-01" } },
    implementationStartedAt: "2026-07-01", // L4 actual
  });

  it("liefert L0 vor dem ersten Übergang", () => {
    expect(stageAtMonth(tl, m(2026, 2))).toBe("L0");
  });

  it("liefert das jüngste Gate mit Datum ≤ Monat", () => {
    expect(stageAtMonth(tl, m(2026, 4))).toBe("L3"); // backlog
    expect(stageAtMonth(tl, m(2026, 6))).toBe("L3"); // noch vor L4
    expect(stageAtMonth(tl, m(2026, 8))).toBe("L4"); // implementation started
  });
});
