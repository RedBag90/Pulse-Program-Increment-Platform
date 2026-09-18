import { describe, it, expect } from "vitest";
import { epicFilterWhere, NO_EPIC } from "@/modules/drumbeat/domain/epic-filter";

describe("epicFilterWhere", () => {
  it("schränkt ohne Auswahl gar nichts ein", () => {
    expect(epicFilterWhere([])).toEqual({});
  });

  it("filtert auf die gewählten Epics", () => {
    expect(epicFilterWhere(["e1", "e2"])).toEqual({ parentId: { in: ["e1", "e2"] } });
  });

  /** Die Frage, die das Cockpit bisher nicht stellen konnte. */
  it("findet die eigenständigen Features", () => {
    expect(epicFilterWhere([NO_EPIC])).toEqual({ parentId: null });
  });

  /**
   * Beides zusammen muss gehen — sonst müsste man zwischen „ein Epic" und
   * „ohne Epic" hin- und herschalten, statt beides nebeneinander zu sehen.
   */
  it("lässt sich kombinieren", () => {
    expect(epicFilterWhere(["e1", NO_EPIC])).toEqual({
      OR: [{ parentId: { in: ["e1"] } }, { parentId: null }],
    });
  });

  /** Der Merkwert darf nie als Epic-Id in einer Abfrage landen. */
  it("schleust den Merkwert nicht als Id durch", () => {
    const where = epicFilterWhere(["e1", NO_EPIC]);
    expect(JSON.stringify(where)).not.toContain(NO_EPIC);
  });
});
