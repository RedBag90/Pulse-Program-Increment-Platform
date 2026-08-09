import { describe, it, expect } from "vitest";
import {
  MONTHS_PER_HALF_YEAR,
  distributeAmountAcrossHalfYearMonths,
} from "@/modules/core/kernel/domain/period-axis";

describe("distributeAmountAcrossHalfYearMonths", () => {
  it("spreizt einen Half-Year-Betrag gleichmaessig auf 6 Monate", () => {
    const out = new Array(12).fill(0);
    distributeAmountAcrossHalfYearMonths(120, 0, 12, out);
    expect(out.slice(0, 6)).toEqual([20, 20, 20, 20, 20, 20]);
    expect(out.slice(6)).toEqual([0, 0, 0, 0, 0, 0]);
  });

  it("akkumuliert additiv (mehrere Periods auf derselben Achse)", () => {
    const out = new Array(12).fill(0);
    distributeAmountAcrossHalfYearMonths(60, 0, 12, out);
    distributeAmountAcrossHalfYearMonths(60, 6, 12, out);
    expect(out).toEqual([10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10]);
  });

  it("clippt Slots ausserhalb der Achse (negativer Start)", () => {
    const out = new Array(6).fill(0);
    distributeAmountAcrossHalfYearMonths(120, -3, 6, out);
    expect(out).toEqual([20, 20, 20, 0, 0, 0]);
  });

  it("clippt Slots ausserhalb der Achse (Start nahe Ende)", () => {
    const out = new Array(6).fill(0);
    distributeAmountAcrossHalfYearMonths(120, 3, 6, out);
    expect(out).toEqual([0, 0, 0, 20, 20, 20]);
  });

  it("ein Betrag von 0 hinterlaesst die Achse unveraendert (kein NaN)", () => {
    const out = new Array(6).fill(0);
    distributeAmountAcrossHalfYearMonths(0, 0, 6, out);
    expect(out).toEqual([0, 0, 0, 0, 0, 0]);
  });

  it("MONTHS_PER_HALF_YEAR ist 6 (Vertragsdokumentation)", () => {
    expect(MONTHS_PER_HALF_YEAR).toBe(6);
  });
});
