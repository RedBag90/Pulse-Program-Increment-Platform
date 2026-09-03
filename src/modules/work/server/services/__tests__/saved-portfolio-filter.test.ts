import { describe, it, expect } from "vitest";
import { parseSavedFilterCriteria } from "@/modules/work/server/services/saved-portfolio-filter";

/**
 * Unit tests for the tolerant criteria parser (the DB stores criteria as an
 * untyped JSON blob, so reads must be defensive). The service's DB paths are
 * covered by the integration suite (requires DATABASE_URL_TEST).
 */
describe("parseSavedFilterCriteria", () => {
  it("reads the string arrays from a well-formed blob", () => {
    expect(
      parseSavedFilterCriteria({
        vs: ["a", "b"],
        gate: ["L3"],
        status: ["blocked"],
        owner: ["u1"],
        cls: ["art"],
      }),
    ).toEqual({
      vs: ["a", "b"],
      gate: ["L3"],
      status: ["blocked"],
      owner: ["u1"],
      cls: ["art"],
    });
  });

  // `cls` kam später dazu — vor der Facette gespeicherte Filter dürfen dadurch
  // nicht ungültig werden.
  it("liest einen vor der Klassen-Facette gespeicherten Filter unverändert", () => {
    expect(
      parseSavedFilterCriteria({ vs: ["a"], gate: [], status: [], owner: ["u1"] }),
    ).toMatchObject({ vs: ["a"], owner: ["u1"], cls: [] });
  });

  it("defaults missing keys to empty arrays", () => {
    expect(parseSavedFilterCriteria({ vs: ["a"] })).toEqual({
      vs: ["a"],
      gate: [],
      status: [],
      owner: [],
      cls: [],
    });
  });

  it("is tolerant of null, non-objects and non-string entries", () => {
    const empty = { vs: [], gate: [], status: [], owner: [], cls: [] };
    expect(parseSavedFilterCriteria(null)).toEqual(empty);
    expect(parseSavedFilterCriteria("nope")).toEqual(empty);
    expect(parseSavedFilterCriteria({ vs: ["ok", 1, null, "x"], gate: "notArray" })).toEqual({
      ...empty,
      vs: ["ok", "x"],
    });
  });
});
