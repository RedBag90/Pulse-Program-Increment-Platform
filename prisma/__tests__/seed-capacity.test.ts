import { describe, it, expect } from "vitest";
import {
  assertPiCapacity,
  capacityFromLoad,
  piLoad,
  type DeliveredFeature,
  type PiCapacityRow,
} from "../seed-delivery";

/**
 * **Die Kapazität eines PI entsteht aus seiner Last — nicht aus einer Formel.**
 *
 * Bis September 2026 stand `capacityJobSize: 70 + i·3` neben Features, die
 * nach einer anderen Regel verteilt wurden. Auf einer Timeline mit einem
 * einzigen geplanten PI landeten alle dort: „158 / 79 JS", rot, im
 * Demo-Datensatz. `assertPiQuotas` prüfte nur abgeschlossene PIs; ein
 * geplantes PI mit dem Doppelten seiner Kapazität verletzte nichts.
 */

const f = (piId: string | null, jobSize: number): DeliveredFeature => ({
  piId,
  jobSize,
  status: "approved",
  completedAt: null,
});
const pi = (id: string, status: PiCapacityRow["status"], cap: number | null): PiCapacityRow => ({
  id,
  name: id,
  status,
  capacityJobSize: cap,
});

describe("piLoad", () => {
  it("summiert die Job Size je PI und lässt den Backlog aus", () => {
    const last = piLoad([f("a", 5), f("a", 8), f("b", 3), f(null, 13)]);
    expect(last.get("a")).toBe(13);
    expect(last.get("b")).toBe(3);
    expect(last.has("null")).toBe(false);
    expect(last.size).toBe(2);
  });
});

describe("capacityFromLoad", () => {
  it("gibt 15 % Luft, aufgerundet", () => {
    expect(capacityFromLoad(100)).toBe(115);
    expect(capacityFromLoad(79)).toBe(91);
    expect(capacityFromLoad(0)).toBe(0);
  });

  it("liegt nie unter der Last", () => {
    for (const l of [1, 7, 13, 158, 791]) expect(capacityFromLoad(l)).toBeGreaterThanOrEqual(l);
  });
});

describe("assertPiCapacity", () => {
  it("lässt eine Saat durch, deren Kapazität aus der Last kommt", () => {
    const features = [f("p", 5), f("p", 8)];
    expect(() =>
      assertPiCapacity(features, [pi("p", "planned", capacityFromLoad(13))], "test"),
    ).not.toThrow();
  });

  it("**meldet den gemeldeten Fall**: 158 in einem PI mit 79", () => {
    const features = Array.from({ length: 26 }, () => f("werk4", 6));
    expect(() => assertPiCapacity(features, [pi("werk4", "planned", 79)], "test")).toThrow(
      /werk4 \(156 \/ 79\)/,
    );
  });

  it("prüft laufende PIs mit, abgeschlossene nicht", () => {
    const features = [f("aktiv", 100), f("fertig", 100)];
    expect(() => assertPiCapacity(features, [pi("aktiv", "active", 50)], "test")).toThrow();
    // Ein abgeschlossenes PI hat seine Quote — die Kapazität ist dort keine
    // Aussage mehr.
    expect(() => assertPiCapacity(features, [pi("fertig", "completed", 50)], "test")).not.toThrow();
  });

  it("übergeht PIs ohne Kapazität — ohne Grenze keine Überbuchung", () => {
    expect(() => assertPiCapacity([f("p", 999)], [pi("p", "planned", null)], "test")).not.toThrow();
  });
});
