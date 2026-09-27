import { describe, it, expect } from "vitest";
import {
  actualWsjf,
  isBvValue,
  isOverdue,
  suggestActual,
} from "@/modules/drumbeat/domain/pi-feedback";

describe("suggestActual — Vorbelegung des Ist-Werts", () => {
  it("ohne Antwort kein Vorschlag", () => {
    expect(suggestActual([])).toBeNull();
  });

  it("eine Antwort ist der Vorschlag", () => {
    expect(suggestActual([13])).toBe(13);
  });

  it("der Mittelwert, auf den nächsten Skalenwert gerundet", () => {
    // Ø 9,5 → 8 (Abstand 1,5) vor 13 (Abstand 3,5)
    expect(suggestActual([8, 8, 13])).toBe(8);
    // Ø 12 → 13
    expect(suggestActual([13, 13, 13, 8, 13])).toBe(13);
  });

  it("bei Gleichstand der kleinere Wert", () => {
    // Ø 4 liegt genau zwischen 3 und 5
    expect(suggestActual([3, 5])).toBe(3);
  });
});

describe("actualWsjf — WSJF mit Ist-Business-Value", () => {
  const feature = { wsjfTimeCriticality: 5, wsjfRiskReduction: 3, wsjfJobSize: 5 };

  it("rechnet (BV Ist + TC + RR) / JS", () => {
    // Plan BV 8 → 3,2; Ist 13 → 4,2
    expect(actualWsjf(feature, 13)).toBe(4.2);
  });

  it("ohne vollständige Bewertung kein Ist-WSJF", () => {
    expect(actualWsjf({ ...feature, wsjfJobSize: null }, 13)).toBeNull();
    expect(actualWsjf({ ...feature, wsjfRiskReduction: null }, 13)).toBeNull();
  });
});

describe("isBvValue / isOverdue", () => {
  it("nur Werte der WSJF-Skala", () => {
    expect(isBvValue(13)).toBe(true);
    expect(isBvValue(4)).toBe(false);
    expect(isBvValue(21)).toBe(false);
  });

  it("überfällig erst ab dem Tag nach der Frist", () => {
    const now = new Date("2026-04-18T15:00:00Z");
    expect(isOverdue(new Date("2026-04-18T00:00:00Z"), now)).toBe(false);
    expect(isOverdue(new Date("2026-04-17T00:00:00Z"), now)).toBe(true);
    expect(isOverdue(null, now)).toBe(false);
  });
});
