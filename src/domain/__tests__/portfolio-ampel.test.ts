import { describe, it, expect } from "vitest";
import {
  thresholdTier,
  AMPEL_LABEL,
  ampelHex,
  DEFAULT_AMPEL_THRESHOLDS,
} from "@/domain/portfolio-ampel";

describe("thresholdTier — Ampel ≥90 grün / 70–89 gelb / <70 rot", () => {
  it("mappt die drei Bänder anhand der Default-Schwellen", () => {
    expect(thresholdTier(0.95)).toBe("green");
    expect(thresholdTier(0.9)).toBe("green"); // Grenze inklusive
    expect(thresholdTier(0.89)).toBe("amber");
    expect(thresholdTier(0.7)).toBe("amber"); // Grenze inklusive
    expect(thresholdTier(0.69)).toBe("rose");
    expect(thresholdTier(0)).toBe("rose");
  });

  it("respektiert konfigurierbare Schwellen", () => {
    expect(thresholdTier(0.8, { green: 0.8, amber: 0.5 })).toBe("green");
    expect(thresholdTier(0.6, { green: 0.8, amber: 0.5 })).toBe("amber");
    expect(thresholdTier(0.4, { green: 0.8, amber: 0.5 })).toBe("rose");
  });

  it("Default-Schwellen sind 0.9 / 0.7", () => {
    expect(DEFAULT_AMPEL_THRESHOLDS).toEqual({ green: 0.9, amber: 0.7 });
  });

  it("Label + Hex sind je Tier gesetzt", () => {
    expect(AMPEL_LABEL.green).toBe("Im Plan");
    expect(AMPEL_LABEL.amber).toBe("Gefährdet");
    expect(AMPEL_LABEL.rose).toBe("Kritisch");
    expect(ampelHex("green")).toBe("#10b981");
    expect(ampelHex("rose")).toBe("#f43f5e");
  });
});
