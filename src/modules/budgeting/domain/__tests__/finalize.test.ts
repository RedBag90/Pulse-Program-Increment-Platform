import { describe, it, expect } from "vitest";
import { median, computeReserve } from "@/modules/budgeting/domain/finalize";

describe("median", () => {
  it("leere Liste → 0", () => expect(median([])).toBe(0));
  it("ungerade Anzahl → mittlerer Wert", () => expect(median([300, 100, 200])).toBe(200));
  it("gerade Anzahl → Mittel der beiden mittleren", () => expect(median([100, 200, 300, 400])).toBe(250));
  it("Ausreißer-robust", () => expect(median([100, 100, 100, 1_000_000])).toBe(100));
});

describe("computeReserve", () => {
  it("verteilbar − Σ final", () => expect(computeReserve(1000, [400, 300])).toBe(300));
  it("negativ bei Überallokation", () => expect(computeReserve(500, [400, 300])).toBe(-200));
});
