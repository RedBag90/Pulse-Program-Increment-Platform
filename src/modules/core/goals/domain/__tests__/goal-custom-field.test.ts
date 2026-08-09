import { describe, it, expect } from "vitest";
import {
  isCustomFieldType,
  parseOptions,
  validateCustomFieldValue,
} from "@/modules/core/goals/domain/goal-custom-field";
import { isOk, isErr } from "@/domain/errors";

describe("isCustomFieldType", () => {
  it("accepts the three known types", () => {
    for (const t of ["text", "number", "select"]) expect(isCustomFieldType(t)).toBe(true);
  });
  it("rejects anything else", () => {
    for (const t of ["date", "", "TEXT", "boolean"]) expect(isCustomFieldType(t)).toBe(false);
  });
});

describe("parseOptions", () => {
  it("reads a string array, dropping non-strings", () => {
    expect(parseOptions(["a", 1, "b", null])).toEqual(["a", "b"]);
  });
  it("returns [] for non-arrays", () => {
    expect(parseOptions(null)).toEqual([]);
    expect(parseOptions("a,b")).toEqual([]);
    expect(parseOptions(undefined)).toEqual([]);
  });
});

describe("validateCustomFieldValue", () => {
  it("treats an empty/whitespace value as a clear signal (ok '')", () => {
    expect(isOk(validateCustomFieldValue("text", "   ", []))).toBe(true);
    const r = validateCustomFieldValue("number", "", []);
    expect(isOk(r) && r.value).toBe("");
  });

  it("text: any non-empty value passes, trimmed", () => {
    const r = validateCustomFieldValue("text", "  hallo  ", []);
    expect(isOk(r) && r.value).toBe("hallo");
  });

  it("number: numeric passes, non-numeric fails", () => {
    const ok1 = validateCustomFieldValue("number", "42", []);
    expect(isOk(ok1) && ok1.value).toBe("42");
    expect(isOk(validateCustomFieldValue("number", "-3.5", []))).toBe(true);
    const bad = validateCustomFieldValue("number", "abc", []);
    expect(isErr(bad)).toBe(true);
    if (isErr(bad)) expect(bad.error.kind).toBe("validation");
  });

  it("select: value must be one of the options", () => {
    expect(isOk(validateCustomFieldValue("select", "hoch", ["hoch", "mittel", "niedrig"]))).toBe(
      true,
    );
    const bad = validateCustomFieldValue("select", "sehr hoch", ["hoch", "mittel"]);
    expect(isErr(bad)).toBe(true);
  });
});
