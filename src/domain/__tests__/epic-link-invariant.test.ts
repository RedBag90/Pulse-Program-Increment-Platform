import { describe, it, expect } from "vitest";
import { checkEpicLink } from "@/domain/epic-link-invariant";
import { isOk, isErr } from "@/domain/errors";

const krTarget = { objectiveId: null, keyResultId: "kr1" };
const objTarget = { objectiveId: "obj1", keyResultId: null };

describe("checkEpicLink", () => {
  it("links an unbound epic to a key result (create)", () => {
    const r = checkEpicLink({
      epicId: "e1",
      target: krTarget,
      existing: null,
      boundKpiCount: 0,
    });
    expect(isOk(r) && r.value.kind).toBe("create");
  });

  it("links an unbound epic to an objective (create)", () => {
    const r = checkEpicLink({
      epicId: "e1",
      target: objTarget,
      existing: null,
      boundKpiCount: 0,
    });
    expect(isOk(r) && r.value.kind).toBe("create");
  });

  it("is a noop when already linked to the same target", () => {
    const r = checkEpicLink({
      epicId: "e1",
      target: krTarget,
      existing: { epicId: "e1", objectiveId: null, keyResultId: "kr1" },
      boundKpiCount: 0,
    });
    expect(isOk(r) && r.value.kind).toBe("noop");
  });

  it("rebinds when moving to a different target and reports the old one", () => {
    const r = checkEpicLink({
      epicId: "e1",
      target: krTarget,
      existing: { epicId: "e1", objectiveId: "obj1", keyResultId: null },
      boundKpiCount: 0,
    });
    expect(isOk(r)).toBe(true);
    if (isOk(r) && r.value.kind === "rebind") {
      expect(r.value.from).toEqual(objTarget);
    } else {
      throw new Error("expected rebind");
    }
  });

  it("deletes when unlinking an existing link", () => {
    const r = checkEpicLink({
      epicId: "e1",
      target: null,
      existing: { epicId: "e1", objectiveId: null, keyResultId: "kr1" },
      boundKpiCount: 0,
    });
    expect(isOk(r) && r.value.kind).toBe("delete");
  });

  it("is a noop when unlinking an epic that is not linked", () => {
    const r = checkEpicLink({
      epicId: "e1",
      target: null,
      existing: null,
      boundKpiCount: 0,
    });
    expect(isOk(r) && r.value.kind).toBe("noop");
  });

  it("rejects linking when the epic's KPIs are already individually KR-bound (count-once)", () => {
    const r = checkEpicLink({
      epicId: "e1",
      target: krTarget,
      existing: null,
      boundKpiCount: 2,
    });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.kind).toBe("conflict");
  });

  it("still allows unlinking even if KPIs appear bound (count-once only guards linking)", () => {
    const r = checkEpicLink({
      epicId: "e1",
      target: null,
      existing: { epicId: "e1", objectiveId: null, keyResultId: "kr1" },
      boundKpiCount: 3,
    });
    expect(isOk(r) && r.value.kind).toBe("delete");
  });
});
