import { describe, it, expect } from "vitest";
import { matchesQuery } from "@/modules/work/lib/row-filter";

describe("matchesQuery", () => {
  it("matches everything when the query is empty", () => {
    expect(matchesQuery(["anything"], "")).toBe(true);
    expect(matchesQuery([null, undefined], "")).toBe(true);
    expect(matchesQuery([], "")).toBe(true);
  });

  it("is case-insensitive on both needle and haystack", () => {
    expect(matchesQuery(["Zahlungsabwicklung"], "zahlung")).toBe(true);
    expect(matchesQuery(["zahlungsabwicklung"], "ZAHLUNG")).toBe(true);
  });

  it("skips null/undefined haystacks", () => {
    expect(matchesQuery([null, undefined, "Owner Name"], "owner")).toBe(true);
    expect(matchesQuery([null, undefined], "owner")).toBe(false);
  });

  it("returns false when no haystack contains the query", () => {
    expect(matchesQuery(["Titel", "Wertstrom"], "xyz")).toBe(false);
  });
});
