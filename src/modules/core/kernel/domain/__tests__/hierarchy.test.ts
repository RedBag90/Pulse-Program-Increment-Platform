import { describe, it, expect } from "vitest";
import { validateParentLevel, PARENT_LEVEL } from "@/modules/core/kernel/domain/hierarchy";
import { InitiativeLevel } from "@/domain/types";
import { isOk, isErr } from "@/modules/core/kernel/domain/errors";

describe("PARENT_LEVEL", () => {
  it("maps each level to its required parent (I1/I2)", () => {
    expect(PARENT_LEVEL[InitiativeLevel.EPIC]).toBeNull();
    expect(PARENT_LEVEL[InitiativeLevel.FEATURE]).toBe(InitiativeLevel.EPIC);
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

  it("accepts an Epic with no parent", () => {
    const r = validateParentLevel(InitiativeLevel.EPIC, null, "");
    expect(isOk(r)).toBe(true);
  });

  it("rejects an Epic with a parent (I2 violation)", () => {
    const r = validateParentLevel(InitiativeLevel.EPIC, { level: InitiativeLevel.FEATURE }, "f-1");
    expect(isErr(r)).toBe(true);
    if (!isErr(r)) return;
    expect(r.error.kind).toBe("hierarchy_violation");
  });

  it("returns not_found when the Feature's Epic parent is missing", () => {
    const r = validateParentLevel(InitiativeLevel.FEATURE, null, "missing-epic-id");
    expect(isErr(r)).toBe(true);
    if (!isErr(r)) return;
    expect(r.error.kind).toBe("not_found");
    if (r.error.kind !== "not_found") return;
    expect(r.error.id).toBe("missing-epic-id");
  });
});
