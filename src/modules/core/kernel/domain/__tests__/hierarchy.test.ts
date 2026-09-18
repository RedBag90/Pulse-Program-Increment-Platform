import { describe, it, expect } from "vitest";
import { validateParentLevel, PARENT_LEVEL } from "@/modules/core/kernel/domain/hierarchy";
import { InitiativeLevel } from "@/modules/core/kernel/domain/types";
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

  /**
   * **Das eigenständige Feature.** Elternlos ist erlaubt — aber nur, wo der
   * Aufrufer es ausdrücklich sagt. Die Vorgabe bleibt streng, und der Test
   * darüber beweist es: derselbe Aufruf ohne Option ergibt weiter `not_found`.
   */
  it("lässt ein elternloses Feature zu, wenn der Aufrufer es zulässt", () => {
    const r = validateParentLevel(InitiativeLevel.FEATURE, null, "", { allowOrphan: true });
    expect(isOk(r)).toBe(true);
  });

  /**
   * **Ein Tippfehler darf nicht zu einem eigenständigen Feature werden.** Wer
   * eine Id angibt, meint ein Epic — wird keins gefunden, ist das ein Fehler,
   * auch wenn elternlos grundsätzlich erlaubt wäre.
   */
  it("lässt eine angegebene, aber unauffindbare Id nicht durch", () => {
    const r = validateParentLevel(InitiativeLevel.FEATURE, null, "gibt-es-nicht", {
      allowOrphan: true,
    });
    expect(isErr(r)).toBe(true);
    if (!isErr(r)) return;
    expect(r.error.kind).toBe("not_found");
  });

  it("bleibt ohne die Option streng", () => {
    expect(isErr(validateParentLevel(InitiativeLevel.FEATURE, null, ""))).toBe(true);
    expect(isErr(validateParentLevel(InitiativeLevel.FEATURE, null, "", {}))).toBe(true);
    expect(
      isErr(validateParentLevel(InitiativeLevel.FEATURE, null, "", { allowOrphan: false })),
    ).toBe(true);
  });

  /**
   * Die Option lockert **nur** das fehlende Elternteil. Ein Epic mit Elternteil
   * bleibt ein Hierarchie-Verstoss, und ein Feature unter einem Feature auch —
   * sonst wäre aus einer Erlaubnis ein Freibrief geworden.
   */
  it("lockert nichts ausser dem fehlenden Elternteil", () => {
    const epicMitEltern = validateParentLevel(
      InitiativeLevel.EPIC,
      { level: InitiativeLevel.FEATURE },
      "f-1",
      { allowOrphan: true },
    );
    expect(isErr(epicMitEltern)).toBe(true);
    if (!isErr(epicMitEltern)) return;
    expect(epicMitEltern.error.kind).toBe("hierarchy_violation");

    const featureUnterFeature = validateParentLevel(
      InitiativeLevel.FEATURE,
      { level: InitiativeLevel.FEATURE },
      "f-2",
      { allowOrphan: true },
    );
    expect(isErr(featureUnterFeature)).toBe(true);
  });
});
