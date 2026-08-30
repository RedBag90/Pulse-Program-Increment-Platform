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

  it("lässt L0 weg, wenn createdAt hinter den fachlichen Gates liegt", () => {
    // Nachtraeglich gepflegtes Portfolio: die Zeile ist juenger als die Gates,
    // die sie beschreibt. Ein L0-Punkt hinter L5 waere ein Ruecksprung.
    const tl = buildEpicStageTimeline({
      ...baseInput,
      createdAt: "2026-08-30",
      selectedForDetailingAt: "2021-11-27",
      businessCaseApprovedAt: "2022-01-06",
      implementationStartedAt: "2022-01-26",
      impactRecognizedAt: "2022-08-04",
    });
    expect(tl.map((t) => t.gate)).not.toContain("L0");
    expect(tl.at(-1)).toMatchObject({ gate: "L5", month: m(2022, 8) });
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

describe("stageAtMonth — Ratsche: kein Rückfall auf ein niedrigeres Gate", () => {
  it("hält ein L5-Epic auch nach einem später datierten L0-Punkt auf L5", () => {
    // Der gemeldete Fall: die Uebergangsliste enthaelt L0 (createdAt) ganz am
    // Ende. „Letzter gewinnt" haette hier ab 2026-08 L0 geliefert.
    const tl = [
      { gate: "L1" as const, month: m(2021, 11) },
      { gate: "L4" as const, month: m(2022, 1) },
      { gate: "L5" as const, month: m(2022, 8) },
      { gate: "L0" as const, month: m(2026, 8) },
    ];
    expect(stageAtMonth(tl, m(2026, 12))).toBe("L5");
    expect(stageAtMonth(tl, m(2026, 8))).toBe("L5");
    expect(stageAtMonth(tl, m(2022, 2))).toBe("L4"); // Historie bleibt gestuft
    expect(stageAtMonth(tl, m(2021, 5))).toBe("L0"); // vor allem: Grundzustand
  });

  it("faellt nicht zurueck, wenn Estimates out-of-order gepflegt sind", () => {
    // L4-Estimate vor dem L2-Estimate — die Liste ist nach Datum sortiert, das
    // Gate darf danach trotzdem nicht wieder sinken.
    const tl = buildEpicStageTimeline({
      ...baseInput,
      createdAt: "2026-01-01",
      timeline: {
        estimates: { implementation_started: "2026-03-01", business_case: "2026-06-01" },
      },
    });
    expect(stageAtMonth(tl, m(2026, 3))).toBe("L4");
    expect(stageAtMonth(tl, m(2026, 6))).toBe("L4"); // nicht zurueck auf L2
  });
});
