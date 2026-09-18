import { describe, it, expect } from "vitest";
import {
  resolveInitiativeValueStreamId,
  type InitiativeValueStreamSource,
} from "@/modules/core/kernel/domain/initiative-value-stream";

const src = (over: Partial<InitiativeValueStreamSource> = {}): InitiativeValueStreamSource => ({
  parentValueStreamId: null,
  ownValueStreamId: null,
  artValueStreamId: null,
  ...over,
});

describe("resolveInitiativeValueStreamId", () => {
  /**
   * Die Reihenfolge ist die eigentliche Zusicherung: mit dem Elternteil an
   * erster Stelle bleibt jede der 425 bestehenden Feature-Zeilen unverändert.
   * Das ART ist ein **zusätzlicher** letzter Halt, keine Neuberechnung.
   */
  it("nimmt den Wertstrom des Eltern-Epics, wenn es eins gibt", () => {
    expect(
      resolveInitiativeValueStreamId(
        src({ parentValueStreamId: "vs-eltern", artValueStreamId: "vs-art" }),
      ),
    ).toBe("vs-eltern");
  });

  it("nimmt die eigene Spalte, wenn kein Elternteil da ist", () => {
    expect(
      resolveInitiativeValueStreamId(
        src({ ownValueStreamId: "vs-eigen", artValueStreamId: "vs-art" }),
      ),
    ).toBe("vs-eigen");
  });

  /**
   * **Der Fall, für den es die Funktion gibt.** Ein Feature ohne Epic hat weder
   * Elternteil noch eigene Spalte — bisher blieb der Wertstrom damit leer, und
   * ein leeres Scope-Feld erfüllt in `authorize.ts` jede Eingrenzung.
   */
  it("fällt auf das ART zurück, wenn beides fehlt", () => {
    expect(resolveInitiativeValueStreamId(src({ artValueStreamId: "vs-art" }))).toBe("vs-art");
  });

  /**
   * `Art.valueStreamId` ist NOT NULL. Steht ein ART an der Zeile, ist das
   * Ergebnis deshalb **nie** null — genau das schließt die Lücke.
   */
  it("ist nie null, solange ein ART dransteht", () => {
    for (const over of [
      { artValueStreamId: "vs-art" },
      { ownValueStreamId: "vs-eigen", artValueStreamId: "vs-art" },
      { parentValueStreamId: "vs-eltern", artValueStreamId: "vs-art" },
    ]) {
      expect(resolveInitiativeValueStreamId(src(over))).not.toBeNull();
    }
  });

  /** Ohne jede Quelle bleibt es leer — die Funktion erfindet nichts. */
  it("bleibt leer, wenn es nichts abzuleiten gibt", () => {
    expect(resolveInitiativeValueStreamId(src())).toBeNull();
  });
});
