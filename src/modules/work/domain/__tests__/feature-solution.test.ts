import { describe, it, expect } from "vitest";
import { resolveFeatureSolution } from "@/modules/work/domain/feature-solution";

describe("resolveFeatureSolution", () => {
  it("nimmt die eigene Zuordnung, wenn es eine gibt", () => {
    expect(resolveFeatureSolution({ own: "sol-eigen", parent: "sol-epic" })).toBe("sol-eigen");
  });

  /**
   * Der Bestand: 425 Features, kein einziges mit eigener Zuordnung. Für sie
   * muss sich nichts ändern — die Solution kommt weiter vom Epic.
   */
  it("fällt auf die Solution des Epics zurück", () => {
    expect(resolveFeatureSolution({ own: null, parent: "sol-epic" })).toBe("sol-epic");
    expect(resolveFeatureSolution({ own: undefined, parent: "sol-epic" })).toBe("sol-epic");
  });

  /** Ein eigenständiges Feature ohne eigene Zuordnung hat schlicht keine. */
  it("bleibt leer, wenn beides fehlt", () => {
    expect(resolveFeatureSolution({ own: null, parent: null })).toBeNull();
  });

  /** Die Funktion trägt beliebige Gestalten — Name, Id oder ganze Referenz. */
  it("arbeitet auf Referenzen genauso wie auf Namen", () => {
    const ref = { id: "s1", name: "Betrieb" };
    expect(resolveFeatureSolution({ own: ref, parent: null })).toBe(ref);
  });
});
