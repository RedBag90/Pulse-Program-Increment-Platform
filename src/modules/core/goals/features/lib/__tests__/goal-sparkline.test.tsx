import { describe, it, expect } from "vitest";
import { sparklineGeometry } from "@/modules/core/goals/features/lib/goal-sparkline";
import type { ProgressChart } from "@/modules/core/goals/server/views/ziele-view";

const T0 = Date.UTC(2026, 6, 1);
const TAG = 86_400_000;
const opts = { width: 106, height: 26, nowMs: T0 + 50 * TAG, pad: 3 };
const chart = (over: Partial<ProgressChart> = {}): ProgressChart => ({
  mode: "percent",
  yDomain: [0, 100],
  pace: { fromMs: T0, toMs: T0 + 100 * TAG, from: 0, to: 100 },
  series: [
    { at: T0, value: 0, status: null, entry: false },
    { at: T0 + 50 * TAG, value: 50, status: "on_track", entry: false },
  ],
  ...over,
});

describe("sparklineGeometry", () => {
  it("leere Serie → nichts zu zeichnen", () => {
    expect(sparklineGeometry(chart({ series: [] }), opts)).toBeNull();
  });

  it("x folgt dem Zeitraum, y ist gespiegelt (oben = 100 %)", () => {
    const g = sparklineGeometry(chart(), opts)!;
    // Start links unten, Hälfte des Zeitraums in der Mitte auf halber Höhe.
    expect(g.line).toBe("M3 23 L53 13");
    expect(g.pace).toEqual({ x1: 3, y1: 23, x2: 103, y2: 3 });
    expect(g.today).toBe(53);
  });

  it("klemmt Punkte außerhalb des Zeitraums an den Rand", () => {
    const g = sparklineGeometry(
      chart({
        series: [
          { at: T0 - 10 * TAG, value: 10, status: null, entry: false },
          { at: T0 + 200 * TAG, value: 120, status: null, entry: false },
        ],
      }),
      opts,
    )!;
    expect(g.line).toBe("M3 21 L103 3");
  });

  it("ein Einzelpunkt wird zur Linie bis heute", () => {
    const g = sparklineGeometry(
      chart({ series: [{ at: T0 + 10 * TAG, value: 20, status: null, entry: false }] }),
      opts,
    )!;
    expect(g.line).toBe("M13 19 L53 19");
  });

  it("ohne Zeitraum: vom ersten Punkt bis heute, kein Heute-Strich", () => {
    const g = sparklineGeometry(chart({ pace: null }), { ...opts, nowMs: T0 + 50 * TAG })!;
    expect(g.pace).toBeNull();
    expect(g.line).toBe("M3 23 L103 13");
    expect(g.today).toBeNull();
  });

  it("zeigt alle Status-Punkte, statuslose übersprungen", () => {
    const s = ["on_track", null, "at_risk", "off_track", null, "on_track"].map((st, i) => ({
      at: T0 + i * 10 * TAG,
      value: i * 10,
      status: st,
      entry: st == null,
    }));
    const g = sparklineGeometry(chart({ series: s }), opts)!;
    expect(g.dots.map((d) => d.status)).toEqual(["on_track", "at_risk", "off_track", "on_track"]);
    expect(g.dots.map((d) => d.latest)).toEqual([false, false, false, true]);
  });
});
