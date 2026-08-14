import { describe, it, expect } from "vitest";
import { parseSavedFilterCriteria } from "@/modules/work/server/services/saved-portfolio-filter";

/**
 * Unit tests for the tolerant criteria parser (the DB stores criteria as an
 * untyped JSON blob, so reads must be defensive). The service's DB paths are
 * covered by the integration suite (requires DATABASE_URL_TEST).
 */
describe("parseSavedFilterCriteria", () => {
  it("reads the four string arrays from a well-formed blob", () => {
    expect(
      parseSavedFilterCriteria({ vs: ["a", "b"], gate: ["L3"], status: ["blocked"], owner: ["u1"] }),
    ).toEqual({ vs: ["a", "b"], gate: ["L3"], status: ["blocked"], owner: ["u1"] });
  });

  it("defaults missing keys to empty arrays", () => {
    expect(parseSavedFilterCriteria({ vs: ["a"] })).toEqual({
      vs: ["a"],
      gate: [],
      status: [],
      owner: [],
    });
  });

  it("is tolerant of null, non-objects and non-string entries", () => {
    expect(parseSavedFilterCriteria(null)).toEqual({ vs: [], gate: [], status: [], owner: [] });
    expect(parseSavedFilterCriteria("nope")).toEqual({ vs: [], gate: [], status: [], owner: [] });
    expect(parseSavedFilterCriteria({ vs: ["ok", 1, null, "x"], gate: "notArray" })).toEqual({
      vs: ["ok", "x"],
      gate: [],
      status: [],
      owner: [],
    });
  });
});
