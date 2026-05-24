import { describe, it, expect } from "vitest";
import { fields } from "@/server/http/form-data";

function fd(entries: Record<string, string | string[]>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) {
    if (Array.isArray(v)) v.forEach((item) => f.append(k, item));
    else f.set(k, v);
  }
  return f;
}

describe("fields().string (required)", () => {
  it("returns the value when present", () => {
    expect(fields(fd({ id: "abc" })).string("id")).toBe("abc");
  });
  it("returns the empty string when present-empty (lets Zod min(1) reject)", () => {
    expect(fields(fd({ id: "" })).string("id")).toBe("");
  });
  it("returns null when absent", () => {
    expect(fields(fd({})).string("id")).toBeNull();
  });
});

describe("fields().optionalString (empty-preserving — old `?? undefined`)", () => {
  it("returns the value when present", () => {
    expect(fields(fd({ description: "hi" })).optionalString("description")).toBe("hi");
  });
  it("preserves the empty string (allows clearing a field)", () => {
    expect(fields(fd({ description: "" })).optionalString("description")).toBe("");
  });
  it("returns undefined when absent", () => {
    expect(fields(fd({})).optionalString("description")).toBeUndefined();
  });
});

describe("fields().nonEmptyString (empty-collapsing — old `|| undefined`)", () => {
  it("returns the value when present", () => {
    expect(fields(fd({ name: "Team A" })).nonEmptyString("name")).toBe("Team A");
  });
  it("collapses the empty string to undefined", () => {
    expect(fields(fd({ name: "" })).nonEmptyString("name")).toBeUndefined();
  });
  it("returns undefined when absent", () => {
    expect(fields(fd({})).nonEmptyString("name")).toBeUndefined();
  });
});

describe("fields().nullableString (presence-guarded — the rteId / SM / PO guard)", () => {
  it("returns the value when present and non-empty", () => {
    expect(fields(fd({ rteId: "user-1" })).nullableString("rteId")).toBe("user-1");
  });
  it("returns null when present but empty (clear the field)", () => {
    expect(fields(fd({ rteId: "" })).nullableString("rteId")).toBeNull();
  });
  it("returns undefined when absent (don't touch the field — the bug-fix case)", () => {
    expect(fields(fd({})).nullableString("rteId")).toBeUndefined();
  });
});

describe("fields().list", () => {
  it("returns all values for a repeated key", () => {
    expect(fields(fd({ ids: ["a", "b", "c"] })).list("ids")).toEqual(["a", "b", "c"]);
  });
  it("returns a single value as a one-element array", () => {
    expect(fields(fd({ ids: "only" })).list("ids")).toEqual(["only"]);
  });
  it("returns an empty array when absent", () => {
    expect(fields(fd({})).list("ids")).toEqual([]);
  });
});

describe("fields().raw / fd escape hatches", () => {
  it("raw returns the underlying entry", () => {
    expect(fields(fd({ payload: "{}" })).raw("payload")).toBe("{}");
  });
  it("exposes the underlying FormData", () => {
    const f = fd({ a: "1" });
    expect(fields(f).fd).toBe(f);
  });
});
