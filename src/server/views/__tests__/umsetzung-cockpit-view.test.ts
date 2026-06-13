import { describe, it, expect } from "vitest";
import { pickCurrentPiIndex, takePiWindow } from "@/server/views/umsetzung-cockpit-view";

const D = (s: string) => new Date(s);

describe("pickCurrentPiIndex", () => {
  const pis = [
    { startDate: D("2026-01-01"), endDate: D("2026-03-31") }, // PI 26-Q1
    { startDate: D("2026-04-01"), endDate: D("2026-06-30") }, // PI 26-Q2
    { startDate: D("2026-07-01"), endDate: D("2026-09-30") }, // PI 26-Q3
    { startDate: D("2026-10-01"), endDate: D("2026-12-31") }, // PI 26-Q4
  ];

  it("picks the PI whose window contains `now`", () => {
    expect(pickCurrentPiIndex(pis, D("2026-05-15").getTime())).toBe(1);
  });

  it("picks the next future PI when `now` is between two", () => {
    // Eine kleine Luecke ohne PI ist im echten Tenant unwahrscheinlich, der
    // Fallback ist trotzdem die naechste Zukunft.
    const withGap = [
      { startDate: D("2026-01-01"), endDate: D("2026-03-31") },
      { startDate: D("2026-07-01"), endDate: D("2026-09-30") },
    ];
    expect(pickCurrentPiIndex(withGap, D("2026-05-15").getTime())).toBe(1);
  });

  it("picks the last past PI when `now` is after everything", () => {
    expect(pickCurrentPiIndex(pis, D("2027-06-01").getTime())).toBe(3);
  });

  it("returns -1 for an empty list", () => {
    expect(pickCurrentPiIndex([], D("2026-05-15").getTime())).toBe(-1);
  });
});

describe("takePiWindow", () => {
  // Fenster-Konvention (Entscheidung #10): aktueller + 1 vor + 3 nach = 5 PIs.
  const allPis = ["A", "B", "C", "D", "E", "F", "G", "H"];

  it("returns full 5-PI window when current is mid-list", () => {
    // current = index 4 ("E") → start=3 ("D"), end=4+4=8 → D..H
    expect(takePiWindow(allPis, 4)).toEqual(["D", "E", "F", "G", "H"]);
  });

  it("clamps left when current is near the start", () => {
    // current = 0 → start=0, end=0+4=4 → A..D (nur 4 statt 5)
    expect(takePiWindow(allPis, 0)).toEqual(["A", "B", "C", "D"]);
  });

  it("clamps right when current is near the end", () => {
    // current = 7 (last) → start=6, end=min(8, 11)=8 → G..H
    expect(takePiWindow(allPis, 7)).toEqual(["G", "H"]);
  });

  it("returns [] when there is no current PI", () => {
    expect(takePiWindow(allPis, -1)).toEqual([]);
  });
});
