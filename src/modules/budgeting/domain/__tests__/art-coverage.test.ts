import { describe, it, expect } from "vitest";
import { artCoverage, type CoverageFeature } from "@/modules/budgeting/domain/art-coverage";

/**
 * **Last gegen Deckung eines ARTs**, rein gerechnet — und der Job-Size-Verlauf,
 * der ganz auf der geltenden Kachel steht.
 */

const fertig = (at: string, jobSize: number): CoverageFeature => ({
  status: "completed",
  completedAt: new Date(`${at}T00:00:00Z`),
  wsjfJobSize: jobSize,
  parentId: "e1",
  featureType: null,
  pi: null,
});

const KACHEL = {
  cycleKey: "2026-H2",
  start: new Date("2026-07-06T00:00:00Z"),
  end: new Date("2027-01-01T00:00:00Z"),
  extended: false,
};
const HEUTE = new Date("2026-10-01T00:00:00Z");

describe("artCoverage — der Verlauf", () => {
  it("nimmt das Geld der Kachel, nicht das des Umschalters", () => {
    const c = artCoverage({
      artId: "a1",
      features: [],
      cycleKey: "2027-H1", // der Umschalter steht auf dem nächsten Halbjahr
      allocatedByCycle: { "2026-H2": 100_000, "2027-H1": 900_000 },
      tenantDefault: 1_000,
      artEstimate: null,
      burn: { tile: KACHEL, today: HEUTE },
    });
    expect(c.allocated).toBe(900_000); // die Karte folgt dem Umschalter
    expect(c.burn?.expected).toBe(100); // der Verlauf der Kachel: 100.000 € ÷ 1.000 €/JS
  });

  /*
   * Bis September 2026 kam der Satz des Verlaufs aus den Halbjahren vor dem
   * Umschalter. Stand der auf 2027-H1, rechnete der Verlauf der Kachel 2026-H2
   * mit einem Satz, in dem 2026-H2 selbst steckte.
   */
  it("rechnet mit dem Satz vor der Kachel, nicht vor dem Umschalter", () => {
    const features = [
      fertig("2025-09-01", 50),
      fertig("2026-03-01", 100),
      fertig("2026-08-01", 20),
    ];
    const allocatedByCycle = { "2025-H2": 50_000, "2026-H1": 100_000, "2026-H2": 100_000 };
    const aufKachel = artCoverage({
      artId: "a1",
      features,
      cycleKey: "2026-H2",
      allocatedByCycle,
      tenantDefault: null,
      artEstimate: null,
      burn: { tile: KACHEL, today: HEUTE },
    });
    const aufNaechstem = artCoverage({
      artId: "a1",
      features,
      cycleKey: "2027-H1",
      allocatedByCycle,
      tenantDefault: null,
      artEstimate: null,
      burn: { tile: KACHEL, today: HEUTE },
    });
    // Der Satz der Karte folgt dem Umschalter …
    expect(aufNaechstem.rate.rate).not.toBe(aufKachel.rate.rate);
    // … der Verlauf nicht.
    expect(aufNaechstem.burn?.expected).toBe(aufKachel.burn?.expected);
    expect(aufNaechstem.burn?.actualToday).toBe(20);
  });

  it("ohne Kachel kein Verlauf", () => {
    const c = artCoverage({
      artId: "a1",
      features: [fertig("2026-08-01", 5)],
      cycleKey: "2026-H2",
      allocatedByCycle: {},
      tenantDefault: 1_000,
      artEstimate: null,
    });
    expect(c.burn).toBeNull();
    expect(c.cycleCompletions).toEqual([]);
  });
});
