import { describe, it, expect } from "vitest";
import { buildArtHistory } from "@/server/views/art-hub";

describe("buildArtHistory", () => {
  const closedPis = [
    {
      id: "pi-2025-q3",
      name: "PI 2025-Q3",
      startDate: new Date("2025-07-01"),
      endDate: new Date("2025-09-30"),
    },
    {
      id: "pi-2025-q4",
      name: "PI 2025-Q4",
      startDate: new Date("2025-10-01"),
      endDate: new Date("2025-12-31"),
    },
  ];

  it("liefert Predictability = completed / total pro PI", () => {
    const out = buildArtHistory({
      closedPis,
      features: [
        { piId: "pi-2025-q3", status: "completed" },
        { piId: "pi-2025-q3", status: "completed" },
        { piId: "pi-2025-q3", status: "approved" },
        { piId: "pi-2025-q4", status: "completed" },
        { piId: "pi-2025-q4", status: "cancelled" },
      ],
      objectives: [],
    });
    expect(out[0]!.predictability).toBeCloseTo(2 / 3);
    expect(out[1]!.predictability).toBeCloseTo(1 / 2);
  });

  it("liefert null bei keinen Features im PI", () => {
    const out = buildArtHistory({
      closedPis,
      features: [{ piId: "pi-2025-q4", status: "completed" }],
      objectives: [],
    });
    expect(out[0]!.predictability).toBeNull();
    expect(out[1]!.predictability).toBe(1);
  });

  it("mittelt Confidence nur ueber committed + voted Objectives", () => {
    const out = buildArtHistory({
      closedPis,
      features: [],
      objectives: [
        { piId: "pi-2025-q3", committed: true, confidence: 4 },
        { piId: "pi-2025-q3", committed: true, confidence: 5 },
        { piId: "pi-2025-q3", committed: true, confidence: null }, // ignoriert
        { piId: "pi-2025-q3", committed: false, confidence: 3 }, // ignoriert
        { piId: "pi-2025-q4", committed: true, confidence: 2 },
      ],
    });
    expect(out[0]!.confidenceAvg).toBeCloseTo(4.5);
    expect(out[1]!.confidenceAvg).toBe(2);
  });

  it("liefert ConfidenceAvg null wenn keine Stimmen", () => {
    const out = buildArtHistory({
      closedPis,
      features: [],
      objectives: [{ piId: "pi-2025-q3", committed: true, confidence: null }],
    });
    expect(out[0]!.confidenceAvg).toBeNull();
  });
});
