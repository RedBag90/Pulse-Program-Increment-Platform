import { describe, it, expect } from "vitest";
import { STAGE_GATE_KEYS } from "@/components/detail/initiative-labels";
import { GATE_STEP_KEYS } from "@/modules/work/domain/stage-gate";
import { catalogTranslate } from "@/test/helpers/catalog";

/*
 * **Liegt im Work-Modul, nicht neben `initiative-labels.ts`.**
 *
 * Der Test braucht beide Tabellen — die geteilte aus `components/detail` und
 * die des Work-Moduls. Nur eine Richtung ist erlaubt: ein Modul darf die
 * geteilte Schicht lesen, umgekehrt nicht (ADR-0013, P7). Neben der geteilten
 * Tabelle konnte er deshalb nicht bleiben.
 */
describe("Major-Gate-Labels", () => {
  /*
   * **Dieselbe Aussage wie vorher, eine Ebene tiefer geprüft.**
   *
   * Der Test hielt bis September 2026 fest, dass `STAGE_GATE_KEYS.L4` „L4
   * Implementierung" heisst. Seit die Tabellen Schlüssel führen, sagt das
   * nichts mehr — zwei verschiedene Schlüssel wären auch dann zwei, wenn
   * dahinter derselbe Text stünde. Geprüft wird deshalb beides: dass die
   * Schlüssel verschieden sind, **und** dass die Wörter dahinter es auch sind.
   */
  it("lässt L4 das Major-Gate bleiben — es umfasst L4.1 und L4.2", () => {
    expect(STAGE_GATE_KEYS.L4).not.toBe(GATE_STEP_KEYS.L4);

    for (const locale of ["de", "en"] as const) {
      const t = catalogTranslate(locale);
      const gate = t(STAGE_GATE_KEYS.L4!);
      const schritt = t(GATE_STEP_KEYS.L4);
      // Das Gate traegt die nackte Nummer, der Schritt die Unterstufe.
      expect(gate, locale).toContain("L4");
      expect(gate, locale).not.toContain("L4.1");
      expect(schritt, locale).toContain("L4.1");
    }
  });
});
