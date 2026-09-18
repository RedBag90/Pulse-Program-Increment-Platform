import { describe, it, expect } from "vitest";
import { planFeatureReparent } from "@/modules/work/domain/feature-parent";
import { isOk, isErr } from "@/modules/core/kernel/domain/errors";
import { derivedInitiativePath } from "@/modules/core/kernel/domain/initiative-path";

const base = { featureId: "f1", artValueStreamId: "vs1" };

describe("planFeatureReparent", () => {
  /** Lösen nimmt niemandem etwas weg — es ist immer erlaubt. */
  it("löst ein Feature heraus und macht seinen Pfad zur Wurzel", () => {
    const r = planFeatureReparent({ ...base, newParent: null });
    expect(isOk(r)).toBe(true);
    if (!isOk(r)) return;
    expect(r.value).toEqual({ parentId: null, path: "f1" });
  });

  it("ordnet einem Epic aus demselben Wertstrom zu", () => {
    const r = planFeatureReparent({
      ...base,
      newParent: { id: "e1", path: "e1", valueStreamId: "vs1" },
    });
    expect(isOk(r)).toBe(true);
    if (!isOk(r)) return;
    expect(r.value).toEqual({ parentId: "e1", path: "e1.f1" });
  });

  /**
   * Ein Feature gehört zu genau einem ART, ein ART zu genau einem Wertstrom.
   * Ein Epic aus einem fremden Wertstrom darf es nicht aufnehmen — dieselbe
   * Regel, die beim Anlegen gilt.
   */
  it("weist ein Epic aus einem fremden Wertstrom ab", () => {
    const r = planFeatureReparent({
      ...base,
      newParent: { id: "e2", path: "e2", valueStreamId: "vs2" },
    });
    expect(isErr(r)).toBe(true);
    if (!isErr(r)) return;
    expect(r.error.kind).toBe("conflict");
  });

  /** Altbestand: ein Epic ohne Wertstrom wird durchgelassen, wie beim Anlegen. */
  it("lässt ein Epic ohne Wertstrom zu", () => {
    const r = planFeatureReparent({
      ...base,
      newParent: { id: "e3", path: "e3", valueStreamId: null },
    });
    expect(isOk(r)).toBe(true);
  });

  /**
   * Der Pfad kommt aus derselben Funktion wie beim Anlegen. Ohne diese Zeile
   * könnte das Umhängen eine zweite Trennzeichen-Konvention erfinden — und
   * genau das ist im Haus schon einmal passiert.
   */
  it("bildet den Pfad nach derselben Regel wie das Anlegen", () => {
    const r = planFeatureReparent({
      ...base,
      newParent: { id: "e1", path: "e1", valueStreamId: "vs1" },
    });
    if (!isOk(r)) throw new Error("erwartet ok");
    expect(r.value.path).toBe(derivedInitiativePath("e1", "f1"));
  });
});
