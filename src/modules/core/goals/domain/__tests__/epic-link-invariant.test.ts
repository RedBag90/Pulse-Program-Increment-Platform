import { describe, it, expect } from "vitest";
import { checkEpicLink, type CheckEpicLinkInput } from "@/modules/core/goals/domain/epic-link-invariant";
import { isOk, isErr } from "@/modules/core/kernel/domain/errors";

const base: CheckEpicLinkInput = {
  target: { objectiveId: "obj1", kpiId: null, conversionFactor: null },
  existing: null,
  chosenKpiLinkedElsewhere: false,
  chosenKpiBelongsToEpic: false,
};

describe("checkEpicLink", () => {
  it("legacy € link (no kpi) to a fresh goal ⇒ create", () => {
    const r = checkEpicLink(base);
    expect(isOk(r) && r.value.kind).toBe("create");
  });

  it("updates when the (epic, goal) pair already exists", () => {
    const r = checkEpicLink({ ...base, existing: { kpiId: null } });
    expect(isOk(r) && r.value.kind).toBe("update");
  });

  it("links an epic to two goals via different KPIs (multi-goal allowed)", () => {
    const link = (objectiveId: string, kpiId: string): CheckEpicLinkInput => ({
      target: { objectiveId, kpiId, conversionFactor: 10000 },
      existing: null,
      chosenKpiLinkedElsewhere: false,
      chosenKpiBelongsToEpic: true,
    });
    expect(isOk(checkEpicLink(link("g1", "kA")))).toBe(true);
    expect(isOk(checkEpicLink(link("g2", "kB")))).toBe(true);
  });

  it("rejects a chosen KPI that already drives another goal", () => {
    const r = checkEpicLink({
      ...base,
      target: { objectiveId: "obj1", kpiId: "k1", conversionFactor: 5 },
      chosenKpiBelongsToEpic: true,
      chosenKpiLinkedElsewhere: true,
    });
    expect(isErr(r) && r.error.kind).toBe("conflict");
  });

  it("rejects a link with a kpi but no conversion factor (validation)", () => {
    const r = checkEpicLink({
      ...base,
      target: { objectiveId: "obj1", kpiId: "k1", conversionFactor: null },
      chosenKpiBelongsToEpic: true,
    });
    expect(isErr(r) && r.error.kind).toBe("validation");
  });

  it("rejects a link whose chosen KPI does not belong to the epic (validation)", () => {
    const r = checkEpicLink({
      ...base,
      target: { objectiveId: "obj1", kpiId: "k1", conversionFactor: 5 },
      chosenKpiBelongsToEpic: false,
    });
    expect(isErr(r) && r.error.kind).toBe("validation");
  });

  it("deletes when unlinking an existing (epic, goal) link", () => {
    const r = checkEpicLink({ ...base, target: null, existing: { kpiId: "k1" } });
    expect(isOk(r) && r.value.kind).toBe("delete");
  });

  it("is a noop when unlinking a pair that is not linked", () => {
    const r = checkEpicLink({ ...base, target: null, existing: null });
    expect(isOk(r) && r.value.kind).toBe("noop");
  });
});
