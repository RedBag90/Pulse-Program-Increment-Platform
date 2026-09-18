import { describe, it, expect } from "vitest";
import {
  resolveRtbToArts,
  resolvedTotal,
  type ResolvableRtbPosition,
} from "@/modules/budgeting/domain/rtb-art-resolution";

/**
 * Die drei Wege, auf denen Betriebsgeld an einem ART landet — und die zwei, auf
 * denen es das nicht tut.
 */

const A1 = "art-1";
const A2 = "art-2";
const STREAM = [A1, A2];

const pos = (over: Partial<ResolvableRtbPosition> = {}): ResolvableRtbPosition => ({
  id: "p1",
  artId: null,
  solutionId: null,
  amount: 100,
  ...over,
});

describe("resolveRtbToArts", () => {
  it("nimmt den ART, der an der Position steht", () => {
    const r = resolveRtbToArts([pos({ artId: A1 })], {}, STREAM);
    expect(r.byArt).toEqual({ [A1]: 100, [A2]: 0 });
    expect(r.unresolved).toEqual([]);
  });

  it("löst über die Solution auf, wenn die Position kein ART trägt", () => {
    const r = resolveRtbToArts([pos({ solutionId: "s1" })], { s1: A2 }, STREAM);
    expect(r.byArt).toEqual({ [A1]: 0, [A2]: 100 });
  });

  it("schlüsselt Wertstrom-Geld gleichmässig", () => {
    const r = resolveRtbToArts([pos({ amount: 90 })], {}, STREAM);
    expect(r.byArt).toEqual({ [A1]: 45, [A2]: 45 });
  });

  /**
   * **Der Fall, für den die Pflicht-Spalte kommt.** Eine Solution ohne ART wird
   * *nicht* geschlüsselt: die Position ist Solution-Geld mit einer Lücke in den
   * Stammdaten, nicht Wertstrom-Geld. Gleichmässig verteilen wäre bequem und
   * würde genau die Lücke unsichtbar machen, die behoben werden soll.
   */
  it("schlüsselt eine Solution ohne ART **nicht** — es bleibt offen", () => {
    const r = resolveRtbToArts([pos({ solutionId: "s1" })], { s1: null }, STREAM);
    expect(r.byArt).toEqual({ [A1]: 0, [A2]: 0 });
    expect(r.unresolved).toEqual([{ id: "p1", amount: 100, reason: "solutionWithoutArt" }]);
  });

  it("behandelt eine unbekannte Solution wie eine ohne ART", () => {
    const r = resolveRtbToArts([pos({ solutionId: "gibt-es-nicht" })], {}, STREAM);
    expect(r.unresolved[0]?.reason).toBe("solutionWithoutArt");
  });

  /**
   * Ein ART aus einem fremden Strom ist keine Zuordnung **dieses** Stroms —
   * sonst stünde fremdes Geld in einer Summe, die den Namen dieses Wertstroms
   * trägt. Die Position fällt auf die Solution-Regel zurück; ohne Solution ist
   * sie Wertstrom-Geld.
   */
  it("zählt einen ART aus einem fremden Strom nicht mit", () => {
    const r = resolveRtbToArts([pos({ artId: "fremd", amount: 80 })], {}, STREAM);
    expect(r.byArt).toEqual({ [A1]: 40, [A2]: 40 });
  });

  it("meldet Wertstrom-Geld als offen, wenn der Strom kein ART hat", () => {
    const r = resolveRtbToArts([pos()], {}, []);
    expect(r.byArt).toEqual({});
    expect(r.unresolved).toEqual([{ id: "p1", amount: 100, reason: "noArtsInStream" }]);
  });

  it("nennt jeden gefragten ART, auch den ohne Betriebsgeld", () => {
    const r = resolveRtbToArts([], {}, STREAM);
    expect(Object.keys(r.byArt).sort()).toEqual([A1, A2]);
  });

  /**
   * **Kein Euro entsteht und keiner verschwindet.** Bei einem Schlüssel ist das
   * die Frage, die man sich stellt — und die einzige, die eine Rundung
   * beantworten muss: hier wird bewusst nicht gerundet, damit die Summe stimmt.
   */
  it("verliert beim Schlüsseln nichts", () => {
    const drei = ["a", "b", "c"];
    const r = resolveRtbToArts([pos({ amount: 100 })], {}, drei);
    expect(resolvedTotal(r)).toBeCloseTo(100, 10);
  });

  it("verteilt gemischte Lagen jede nach ihrer Regel", () => {
    const r = resolveRtbToArts(
      [
        pos({ id: "direkt", artId: A1, amount: 10 }),
        pos({ id: "solution", solutionId: "s1", amount: 20 }),
        pos({ id: "strom", amount: 40 }),
        pos({ id: "luecke", solutionId: "s2", amount: 5 }),
      ],
      { s1: A2, s2: null },
      STREAM,
    );
    expect(r.byArt).toEqual({ [A1]: 30, [A2]: 40 });
    expect(r.unresolved).toEqual([{ id: "luecke", amount: 5, reason: "solutionWithoutArt" }]);
  });
});
