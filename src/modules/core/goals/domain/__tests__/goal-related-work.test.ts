import { describe, it, expect } from "vitest";
import {
  isRelatedWorkKind,
  RELATED_WORK_KINDS,
} from "@/modules/core/goals/domain/goal-related-work";

describe("isRelatedWorkKind", () => {
  it("accepts feature and pi", () => {
    expect(RELATED_WORK_KINDS).toEqual(["feature", "pi"]);
    expect(isRelatedWorkKind("feature")).toBe(true);
    expect(isRelatedWorkKind("pi")).toBe(true);
  });
  it("rejects other kinds", () => {
    for (const k of ["epic", "team", "", "PI", "story"]) expect(isRelatedWorkKind(k)).toBe(false);
  });
});
