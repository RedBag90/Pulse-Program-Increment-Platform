import { describe, it, expect } from "vitest";
import {
  derivedInitiativePath,
  INITIATIVE_PATH_SEPARATOR,
} from "@/modules/core/kernel/domain/initiative-path";

describe("derivedInitiativePath", () => {
  /**
   * Diese beiden Zusicherungen pinnen das heutige Verhalten von
   * `createInitiativeWithDerivedPath` **wörtlich**. Sie sind der Beleg dafür,
   * dass das Herausziehen nichts verschiebt — und der Wächter dafür, dass das
   * Umhängen später keine zweite Konvention erfindet.
   */
  it("gibt einer Wurzel ihre eigene Id", () => {
    expect(derivedInitiativePath(null, "id-1")).toBe("id-1");
    expect(derivedInitiativePath(undefined, "id-1")).toBe("id-1");
  });

  it("hängt ein Kind an den Pfad seines Elternteils", () => {
    expect(derivedInitiativePath("epic-1", "feat-1")).toBe("epic-1.feat-1");
    expect(INITIATIVE_PATH_SEPARATOR).toBe(".");
  });

  /**
   * Ein leerer Elternpfad ist kein Elternpfad. Ohne diese Zeile führte ein
   * versehentliches `""` zu einem Pfad, der mit dem Trennzeichen beginnt — und
   * damit zu einem Segment ohne Id.
   */
  it("behandelt einen leeren Elternpfad wie keinen", () => {
    expect(derivedInitiativePath("", "id-1")).toBe("id-1");
  });
});
