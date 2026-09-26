import { describe, it, expect } from "vitest";
import {
  artVelocity,
  streamVelocity,
  type VelocityInput,
} from "@/modules/drumbeat/domain/pi-velocity";

const pi = (
  id: string,
  end: string,
  delivered: number,
  capacity: number | null,
  status = "completed",
): VelocityInput => ({
  id,
  name: id.toUpperCase(),
  endDate: new Date(end),
  status,
  capacity,
  delivered,
});

/** Gewählt H2 2026, und es läuft: die zwei Halbjahre davor plus das laufende. */
const FENSTER = { closedKeys: ["2026-H1", "2025-H2"], runningKey: "2026-H2" };

describe("artVelocity", () => {
  it("nimmt die PIs, deren Ende im Fenster liegt — älteste zuerst", () => {
    const v = artVelocity(
      [
        pi("p5", "2026-12-18", 10, 10, "planned"), // H2 2026, läuft noch nicht
        pi("p4", "2026-09-20", 10, 10, "active"), // H2 2026, läuft noch
        pi("p3", "2026-06-30", 30, 10), // 30.06. ist noch H1
        pi("p2", "2025-12-15", 20, 10),
        pi("p1", "2025-06-10", 50, 10), // H1 2025 — zu alt
      ],
      FENSTER,
    );
    expect(v.rows.map((r) => r.piId)).toEqual(["p2", "p3"]);
  });

  /**
   * Gewünscht: die abgeschlossenen PIs des laufenden Halbjahrs zählen mit.
   * Was darin noch läuft oder geplant ist, bleibt draussen — auch nicht
   * gedämpft, es hat schlicht noch nichts geliefert.
   */
  it("das laufende Halbjahr: nur seine abgeschlossenen PIs", () => {
    const v = artVelocity(
      [
        pi("fertig", "2026-09-20", 30, 10),
        pi("laeuft", "2026-12-18", 5, 10, "active"),
        pi("frueher", "2026-03-20", 10, 10),
      ],
      FENSTER,
    );
    expect(v.rows.map((r) => r.piId)).toEqual(["frueher", "fertig"]);
    expect(v.mean).toBeCloseTo(2);
  });

  it("gewählt ist das nächste Halbjahr: das laufende liegt im Fenster, bleibt aber streng", () => {
    const v = artVelocity(
      [pi("fertig", "2026-09-20", 30, 10), pi("laeuft", "2026-12-18", 5, 10, "active")],
      { closedKeys: ["2026-H2", "2026-H1"], runningKey: "2026-H2" },
    );
    expect(v.rows.map((r) => r.piId)).toEqual(["fertig"]);
  });

  it("Ø nur über abgeschlossene PIs mit Kapazität — jeder PI wiegt gleich", () => {
    const v = artVelocity(
      [
        pi("a", "2025-09-01", 20, 10), // 2.0
        pi("b", "2025-12-01", 10, 20), // 0.5
        pi("c", "2026-03-01", 40, null), // ohne Kapazität
        pi("d", "2026-06-01", 99, 10, "active"), // noch nicht abgeschlossen
      ],
      FENSTER,
    );
    expect(v.mean).toBeCloseTo(1.25);
    expect(v.countedCount).toBe(2);
    expect(v.rows.map((r) => r.skip)).toEqual([null, null, "noCapacity", "notCompleted"]);
    expect(v.rows[2]!.ratio).toBeNull();
  });

  it("leeres Fenster: keine Zeilen, kein Ø", () => {
    const v = artVelocity([pi("x", "2024-06-01", 5, 5)], FENSTER);
    expect(v).toEqual({ rows: [], mean: null, countedCount: 0 });
  });
});

describe("streamVelocity — Σ geliefert ÷ Σ Kapazität", () => {
  it("gemeinsame Taktung: ein PI, die Summen beider ARTs", () => {
    const a = artVelocity([pi("p1", "2025-12-01", 30, 10)], FENSTER);
    const b = artVelocity([pi("p1", "2025-12-01", 10, 30)], FENSTER);
    const s = streamVelocity([a, b]);
    expect(s.rows).toHaveLength(1);
    expect(s.rows[0]).toMatchObject({ delivered: 40, capacity: 40, ratio: 1, skip: null });
    // Nicht der Ø der ART-Quoten (3 und 0,33) — die Summe.
    expect(s.ratio).toBe(1);
  });

  it("getrennte Taktung: je PI eine Zeile, der Wert über alles", () => {
    const a = artVelocity([pi("a1", "2025-10-01", 20, 10)], FENSTER);
    const b = artVelocity([pi("b1", "2026-04-01", 10, 30)], FENSTER);
    const s = streamVelocity([a, b]);
    expect(s.rows.map((r) => r.piId)).toEqual(["a1", "b1"]);
    expect(s.ratio).toBeCloseTo(30 / 40);
    expect(s.countedCount).toBe(2);
  });

  it("ein ART ohne Kapazität zählt im gemeinsamen PI nicht mit", () => {
    const a = artVelocity([pi("p1", "2025-12-01", 30, 10)], FENSTER);
    const b = artVelocity([pi("p1", "2025-12-01", 50, null)], FENSTER);
    const s = streamVelocity([b, a]);
    expect(s.rows[0]).toMatchObject({ delivered: 30, capacity: 10, ratio: 3, skip: null });
  });

  it("zählt kein ART den PI, bleibt er mit Grund stehen", () => {
    const a = artVelocity([pi("p1", "2025-12-01", 30, null)], FENSTER);
    const s = streamVelocity([a]);
    expect(s.rows[0]).toMatchObject({ delivered: 30, skip: "noCapacity", ratio: null });
    expect(s.ratio).toBeNull();
  });
});
