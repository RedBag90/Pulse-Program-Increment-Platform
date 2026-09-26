import { describe, it, expect } from "vitest";
import {
  artPiCapacities,
  assertArtPiTargets,
  piLoad,
  SEED_BASE_CAPACITY,
  type CapacityFeature,
  type DeliveredFeature,
  type DeliveryPi,
} from "../seed-delivery";
import { deriveJobSizeTarget } from "@/modules/drumbeat/domain/pi-job-size-target";

/**
 * **Die Saat setzt Kapazitätszahlen, das Ziel errechnet sich.**
 *
 * Bis September 2026 setzte die Saat das Job-Size-Ziel selbst (Last × 1,15).
 * Seit das Ziel aus einer Formel kommt (`deriveJobSizeTarget`), trägt jedes
 * ART je PI eine Kapazitätszahl — und die Saat muss sie so wählen, dass kein
 * laufendes oder geplantes PI über seinem errechneten Ziel liegt.
 */

const DAY = 86_400_000;
const pi = (id: string, n: number, status: DeliveryPi["status"]) => ({
  id,
  name: id,
  start: new Date(Date.UTC(2026, 0, 1) + n * 70 * DAY),
  end: new Date(Date.UTC(2026, 0, 1) + (n * 70 + 69) * DAY),
  status,
});
const feat = (
  piId: string,
  artId: string,
  jobSize: number,
  status = "approved",
): CapacityFeature => ({ piId, artId, jobSize, status });

describe("piLoad", () => {
  it("summiert die Job Size je PI und übergeht den Backlog", () => {
    const f = (piId: string | null, jobSize: number): DeliveredFeature => ({
      piId,
      jobSize,
      status: "approved",
      completedAt: null,
    });
    const last = piLoad([f("a", 5), f("a", 8), f("b", 3), f(null, 13)]);
    expect(last.get("a")).toBe(13);
    expect(last.get("b")).toBe(3);
    expect(last.size).toBe(2);
  });
});

describe("artPiCapacities", () => {
  const pis = [pi("p1", 0, "completed"), pi("p2", 1, "completed"), pi("p3", 2, "planned")];

  it("abgeschlossene PIs tragen die Basis", () => {
    const caps = artPiCapacities(
      [feat("p1", "a", 20, "completed"), feat("p2", "a", 30, "completed"), feat("p3", "a", 5)],
      pis,
    );
    expect(
      caps.filter((c) => c.piId !== "p3").every((c) => c.capacity === SEED_BASE_CAPACITY),
    ).toBe(true);
  });

  it("ein geplantes PI bekommt so viel, dass das Ziel seine Last trägt", () => {
    // Quoten 2 und 3 → Ø 2,5; Last 80 → Kapazität ≥ 80 / (2,5 × 0,8) = 40
    const features = [
      feat("p1", "a", 20, "completed"),
      feat("p2", "a", 30, "completed"),
      feat("p3", "a", 80),
    ];
    const caps = artPiCapacities(features, pis);
    expect(caps.find((c) => c.piId === "p3")!.capacity).toBe(40);
    expect(() => assertArtPiTargets(features, pis, caps, "test")).not.toThrow();
  });

  it("je ART getrennt", () => {
    const features = [
      feat("p1", "a", 20, "completed"),
      feat("p1", "b", 50, "completed"),
      feat("p3", "a", 8),
      feat("p3", "b", 8),
    ];
    const caps = artPiCapacities(features, pis);
    expect(caps.filter((c) => c.artId === "a").map((c) => c.piId)).toEqual(["p1", "p3"]);
    expect(caps.filter((c) => c.artId === "b").map((c) => c.piId)).toEqual(["p1", "p3"]);
  });
});

describe("assertArtPiTargets", () => {
  const pis = [pi("p1", 0, "completed"), pi("p2", 1, "planned")];

  it("wirft, wenn ein geplantes PI über seinem errechneten Ziel liegt", () => {
    const features = [feat("p1", "a", 10, "completed"), feat("p2", "a", 50)];
    // Quote 1, Kapazität 10 → Ziel 8, Last 50
    const caps = [
      { artId: "a", piId: "p1", capacity: 10 },
      { artId: "a", piId: "p2", capacity: 10 },
    ];
    expect(
      deriveJobSizeTarget({
        startDate: pis[1]!.start,
        capacity: 10,
        history: [
          {
            piId: "p1",
            name: "p1",
            startDate: pis[0]!.start,
            status: "completed",
            capacity: 10,
            delivered: 10,
          },
        ],
      }).target,
    ).toBe(8);
    expect(() => assertArtPiTargets(features, pis, caps, "test")).toThrow(/p2\/a \(50 \/ 8\)/);
  });

  it("abgeschlossene PIs prüft sie nicht — dort ist die Quote die Aussage", () => {
    const features = [feat("p1", "a", 999, "completed")];
    expect(() =>
      assertArtPiTargets(features, pis, [{ artId: "a", piId: "p1", capacity: 10 }], "test"),
    ).not.toThrow();
  });
});
