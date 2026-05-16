import { describe, it, expect } from "vitest";
import { generateSprints, validateDateRange } from "@/domain/pi-planning";
import { isErr, isOk } from "@/domain/errors";

const DAY = 24 * 60 * 60 * 1000;
const date = (offset: number, from = new Date("2024-01-01")) =>
  new Date(from.getTime() + offset * DAY);

const teams = [{ id: "team-a" }, { id: "team-b" }, { id: "team-c" }];

describe("validateDateRange", () => {
  it("returns ok when end is after start", () => {
    expect(isOk(validateDateRange(date(0), date(1)))).toBe(true);
  });

  it("returns conflict when end equals start", () => {
    const result = validateDateRange(date(0), date(0));
    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error.kind).toBe("conflict");
  });

  it("returns conflict when end is before start", () => {
    const result = validateDateRange(date(10), date(5));
    expect(isErr(result)).toBe(true);
  });
});

describe("generateSprints", () => {
  it("generates one sprint per team when PI is shorter than one sprint cycle", () => {
    const start = date(0);
    const end = date(10);
    const drafts = generateSprints(start, end, [{ id: "t1" }]);
    expect(drafts).toHaveLength(1);
    expect(drafts[0]!.indexInPi).toBe(1);
    expect(drafts[0]!.endDate).toEqual(end);
  });

  it("generates 3 sprints × 3 teams for a 42-day PI", () => {
    // ceil(42 / 14) = 3 sprints; 3 teams × 3 sprints = 9
    const start = date(0);
    const end = date(42);
    const drafts = generateSprints(start, end, teams);
    expect(drafts).toHaveLength(9);
  });

  it("caps the last sprint end date at the PI end date", () => {
    // 30-day PI → 2 sprints of 14 days, second ends at PI end (not day 28+)
    const start = date(0);
    const end = date(27);
    const drafts = generateSprints(start, end, [{ id: "t1" }]);
    expect(drafts[1]!.endDate).toEqual(end);
  });

  it("assigns correct teamId to each sprint", () => {
    const start = date(0);
    const end = date(28);
    const drafts = generateSprints(start, end, [{ id: "alpha" }, { id: "beta" }]);
    const alphaIds = drafts.filter((d) => d.teamId === "alpha");
    const betaIds = drafts.filter((d) => d.teamId === "beta");
    expect(alphaIds.length).toBeGreaterThan(0);
    expect(betaIds.length).toBeGreaterThan(0);
  });

  it("assigns sequential indexInPi starting from 1", () => {
    const start = date(0);
    const end = date(42);
    const drafts = generateSprints(start, end, [{ id: "t1" }]);
    const indices = drafts.map((d) => d.indexInPi);
    expect(indices[0]).toBe(1);
    expect(indices).toEqual([...Array(indices.length).keys()].map((i) => i + 1));
  });

  it("returns empty array when teams list is empty", () => {
    expect(generateSprints(date(0), date(60), [])).toHaveLength(0);
  });
});
