import { describe, it, expect } from "vitest";
import {
  deriveJobSizeTarget,
  TARGET_FACTOR,
  type PiDeliveryRecord,
} from "@/modules/drumbeat/domain/pi-job-size-target";

const pi = (
  n: number,
  capacity: number | null,
  delivered: number,
  status = "completed",
): PiDeliveryRecord => ({
  piId: `pi-${n}`,
  name: `PI ${n}`,
  startDate: new Date(Date.UTC(2025, n * 3, 1)),
  status,
  capacity,
  delivered,
});

/** Das PI, für das gerechnet wird — nach allen obigen. */
const NOW = new Date(Date.UTC(2027, 0, 1));

describe("deriveJobSizeTarget", () => {
  it("Mittel der Quoten der letzten 4 × Kapazität × 0,8", () => {
    // Quoten: 10, 12, 8, 10 → Ø 10; × 20 × 0,8 = 160
    const history = [pi(1, 10, 100), pi(2, 10, 120), pi(3, 10, 80), pi(4, 5, 50)];
    const r = deriveJobSizeTarget({ startDate: NOW, capacity: 20, history });
    expect(r.reason).toBe("ok");
    expect(r.perCapacity).toBeCloseTo(10);
    expect(r.target).toBe(160);
    expect(TARGET_FACTOR).toBe(0.8);
  });

  it("nimmt nur die vier jüngsten", () => {
    // PI 0 (Quote 100) ist das älteste von fünf und fällt heraus.
    const history = [pi(0, 1, 100), pi(1, 10, 100), pi(2, 10, 100), pi(3, 10, 100), pi(4, 10, 100)];
    const r = deriveJobSizeTarget({ startDate: NOW, capacity: 10, history });
    expect(r.basis.map((b) => b.piId)).toEqual(["pi-4", "pi-3", "pi-2", "pi-1"]);
    expect(r.perCapacity).toBeCloseTo(10);
  });

  it("überspringt PIs ohne Kapazität und nicht abgeschlossene", () => {
    const history = [pi(1, 10, 100), pi(2, null, 500), pi(3, 10, 999, "active"), pi(4, 0, 50)];
    const r = deriveJobSizeTarget({ startDate: NOW, capacity: 10, history });
    expect(r.basis.map((b) => b.piId)).toEqual(["pi-1"]);
  });

  it("mittelt über die vorhandenen, wenn es weniger als vier sind", () => {
    const r = deriveJobSizeTarget({
      startDate: NOW,
      capacity: 10,
      history: [pi(1, 10, 100), pi(2, 10, 200)],
    });
    expect(r.basis).toHaveLength(2);
    expect(r.perCapacity).toBeCloseTo(15);
    expect(r.target).toBe(120);
  });

  it("zählt nur PIs, die vor dem aktuellen begonnen haben", () => {
    const spaeter = { ...pi(9, 10, 1000), startDate: new Date(Date.UTC(2028, 0, 1)) };
    const r = deriveJobSizeTarget({
      startDate: NOW,
      capacity: 10,
      history: [pi(1, 10, 100), spaeter],
    });
    expect(r.basis.map((b) => b.piId)).toEqual(["pi-1"]);
  });

  it("eine Lieferung 0 zählt mit der Quote 0", () => {
    const r = deriveJobSizeTarget({
      startDate: NOW,
      capacity: 10,
      history: [pi(1, 10, 0), pi(2, 10, 100)],
    });
    expect(r.perCapacity).toBeCloseTo(5);
    expect(r.target).toBe(40);
  });

  it("rundet auf ganze Punkte", () => {
    // Ø 3,33… × 7 × 0,8 = 18,66…
    const r = deriveJobSizeTarget({
      startDate: NOW,
      capacity: 7,
      history: [pi(1, 3, 10)],
    });
    expect(r.target).toBe(19);
  });

  it("ohne Kapazität kein Ziel — die Quote der Vorgänger bleibt sichtbar", () => {
    const r = deriveJobSizeTarget({ startDate: NOW, capacity: null, history: [pi(1, 10, 100)] });
    expect(r).toMatchObject({ target: null, reason: "noCapacity" });
    expect(r.perCapacity).toBeCloseTo(10);
  });

  it("ohne Historie kein Ziel", () => {
    const r = deriveJobSizeTarget({ startDate: NOW, capacity: 10, history: [] });
    expect(r).toMatchObject({ target: null, perCapacity: null, reason: "noHistory" });
  });
});
