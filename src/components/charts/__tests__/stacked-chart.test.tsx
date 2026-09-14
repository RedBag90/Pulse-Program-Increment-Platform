import { describe, it, expect } from "vitest";
import { stackedBars, stackedBarKey } from "@/components/charts/stacked-chart";
import type { Stack } from "@/components/charts/stack-tooltip";

/**
 * **Eine Serie am Stück.**
 *
 * Recharts stapelt in der Reihenfolge, in der die `<Bar>` deklariert sind. Die
 * Benefit Velocity legte erst über alle Serien die Basis und danach über alle
 * Serien den Forecast — im Bild erschien dadurch jede Farbe **zweimal** in
 * derselben Säule, getrennt durch die Farbe der anderen Serie. Zwei gelbe und
 * zwei grüne Abschnitte, wo zwei Abschnitte hingehören.
 */
const stack = (id: string): Stack => ({ id, title: id, color: "#000", confirmed: true });

describe("stackedBars — Stapel-Reihenfolge", () => {
  it("setzt den Forecast direkt auf seine eigene Basis", () => {
    const keys = stackedBars([stack("L4"), stack("L5")], true).map(stackedBarKey);
    expect(keys).toEqual(["L4", "L4#up", "L5", "L5#up"]);
  });

  it("ohne Forecast bleibt es ein Balken je Serie", () => {
    const keys = stackedBars([stack("L4"), stack("L5")], false).map(stackedBarKey);
    expect(keys).toEqual(["L4", "L5"]);
  });

  it("keine Serie ist unterbrochen — ihre Segmente liegen zusammen", () => {
    const stacks = [stack("a"), stack("b"), stack("c")];
    const keys = stackedBars(stacks, true).map(stackedBarKey);
    for (const s of stacks) {
      const positionen = keys
        .map((k, i) => (k === s.id || k === `${s.id}#up` ? i : -1))
        .filter((i) => i >= 0);
      expect(positionen[1]! - positionen[0]!, `Serie ${s.id} ist unterbrochen`).toBe(1);
    }
  });

  it("markiert genau ein Segment je Serie als Forecast", () => {
    const entries = stackedBars([stack("a"), stack("b")], true);
    expect(entries.filter((e) => e.forecast)).toHaveLength(2);
    expect(entries.filter((e) => !e.forecast)).toHaveLength(2);
  });
});
