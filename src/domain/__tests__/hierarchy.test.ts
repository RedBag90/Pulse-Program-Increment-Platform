import { describe, it, expect } from "vitest";
import { validateParentLevel, PARENT_LEVEL } from "@/domain/hierarchy";
import { InitiativeLevel } from "@/domain/types";
import { isOk, isErr } from "@/domain/errors";

describe("PARENT_LEVEL", () => {
  it("maps each level to its required parent (I1/I2)", () => {
    expect(PARENT_LEVEL[InitiativeLevel.EPIC]).toBeNull();
    expect(PARENT_LEVEL[InitiativeLevel.FEATURE]).toBe(InitiativeLevel.EPIC);
    expect(PARENT_LEVEL[InitiativeLevel.STORY]).toBe(InitiativeLevel.FEATURE);
    expect(PARENT_LEVEL[InitiativeLevel.TASK]).toBe(InitiativeLevel.STORY);
  });
});

describe("validateParentLevel", () => {
  it("accepts a Feature under an Epic", () => {
    const r = validateParentLevel(
      InitiativeLevel.FEATURE,
      { level: InitiativeLevel.EPIC },
      "epic-1",
    );
    expect(isOk(r)).toBe(true);
  });

  it("accepts a Story under a Feature and a Task under a Story", () => {
    expect(
      isOk(validateParentLevel(InitiativeLevel.STORY, { level: InitiativeLevel.FEATURE }, "f-1")),
    ).toBe(true);
    expect(
      isOk(validateParentLevel(InitiativeLevel.TASK, { level: InitiativeLevel.STORY }, "s-1")),
    ).toBe(true);
  });

  it("rejects a wrong-level parent with hierarchy_violation", () => {
    const r = validateParentLevel(InitiativeLevel.FEATURE, { level: InitiativeLevel.STORY }, "s-1");
    expect(isErr(r)).toBe(true);
    if (!isErr(r)) return;
    expect(r.error.kind).toBe("hierarchy_violation");
  });

  it("returns not_found when the parent row is missing", () => {
    const r = validateParentLevel(InitiativeLevel.STORY, null, "missing-id");
    expect(isErr(r)).toBe(true);
    if (!isErr(r)) return;
    expect(r.error.kind).toBe("not_found");
    if (r.error.kind !== "not_found") return;
    expect(r.error.id).toBe("missing-id");
  });
});
