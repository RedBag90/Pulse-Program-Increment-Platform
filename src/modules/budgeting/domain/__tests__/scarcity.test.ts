import { describe, it, expect } from "vitest";
import {
  scarcityFactor,
  passesScarcityGate,
  MIN_SCARCITY_FACTOR,
} from "@/modules/budgeting/domain/scarcity";

describe("scarcityFactor", () => {
  it("Nordwerk: 3,5 Mio Nachfrage / 2,05 Mio Topf ≈ 1,71", () => {
    expect(scarcityFactor(3_500_000, 2_050_000)).toBeCloseTo(1.71, 2);
  });

  it("Pool ≤ 0 bei positiver Nachfrage ist unendlich knapp", () => {
    expect(scarcityFactor(100, 0)).toBe(Infinity);
  });

  it("keine Nachfrage ist 0", () => {
    expect(scarcityFactor(0, 1000)).toBe(0);
  });
});

describe("passesScarcityGate", () => {
  it("Nordwerk-Faktor besteht das Tor (≥ 1,3)", () => {
    expect(passesScarcityGate(1.71)).toBe(true);
  });

  it("genau an der Schwelle besteht", () => {
    expect(passesScarcityGate(MIN_SCARCITY_FACTOR)).toBe(true);
  });

  it("darunter fällt durch — Runde entfällt", () => {
    expect(passesScarcityGate(1.29)).toBe(false);
  });
});
