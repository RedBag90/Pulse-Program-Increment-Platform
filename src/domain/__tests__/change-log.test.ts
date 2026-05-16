import { describe, it, expect } from "vitest";
import { buildChangelog } from "@/domain/change-log";

describe("buildChangelog", () => {
  it("returns empty map when no fields changed", () => {
    const result = buildChangelog({ name: "PI-1", status: "planned" }, { name: "PI-1" }, ["name"]);
    expect(result).toEqual({});
  });

  it("records a changed field with before and after values", () => {
    const result = buildChangelog({ name: "PI-1", status: "planned" }, { name: "PI-2" }, [
      "name",
      "status",
    ]);
    expect(result).toEqual({ name: { before: "PI-1", after: "PI-2" } });
  });

  it("records multiple changed fields", () => {
    const result = buildChangelog(
      { name: "PI-1", status: "planned" },
      { name: "PI-2", status: "active" },
      ["name", "status"],
    );
    expect(result).toEqual({
      name: { before: "PI-1", after: "PI-2" },
      status: { before: "planned", after: "active" },
    });
  });

  it("treats missing key in after as 'not in update' (not a change)", () => {
    // Passing an empty partial — no keys present means nothing to change
    const result = buildChangelog({ name: "PI-1", status: "planned" }, {}, ["name", "status"]);
    expect(result).toEqual({});
  });

  it("only tracks keys specified in the keys array", () => {
    const result = buildChangelog(
      { name: "PI-1", status: "planned" },
      { name: "PI-2", status: "active" },
      ["name"],
    );
    expect(result).toEqual({ name: { before: "PI-1", after: "PI-2" } });
    expect(result["status"]).toBeUndefined();
  });

  it("works with numeric before values", () => {
    const result = buildChangelog({ count: 0, label: "a" }, { count: 5 }, ["count"]);
    expect(result).toEqual({ count: { before: 0, after: 5 } });
  });
});
