import { describe, it, expect } from "vitest";

import { potWindowClosedReason } from "@/modules/budgeting/domain/art-pot-window";

const NOW = new Date("2026-04-15T00:00:00Z"); // H1 2026

describe("potWindowClosedReason", () => {
  it("das laufende Halbjahr ist offen", () => {
    expect(potWindowClosedReason("2026-H1", NOW)).toBeNull();
  });

  // Vorlauf: ein Vorhaben lässt sich vorbereiten, bevor sein Halbjahr beginnt.
  it("das nächste Halbjahr ist offen", () => {
    expect(potWindowClosedReason("2026-H2", NOW)).toBeNull();
  });

  // Die Historie speist Kostenkurve und eingefrorenen Budget-Plan.
  it("vergangene Halbjahre sind gesperrt", () => {
    expect(potWindowClosedReason("2025-H2", NOW)).toContain("Vergangene Halbjahre");
  });

  it("das übernächste Halbjahr ist noch nicht dran", () => {
    expect(potWindowClosedReason("2027-H1", NOW)).toContain("übernächsten");
  });

  it("ein unbekannter Schlüssel wird abgelehnt", () => {
    expect(potWindowClosedReason("Unsinn", NOW)).toContain("Unbekanntes");
  });

  it("über den Jahreswechsel hinweg", () => {
    const dec = new Date("2026-12-01T00:00:00Z"); // H2 2026
    expect(potWindowClosedReason("2026-H2", dec)).toBeNull();
    expect(potWindowClosedReason("2027-H1", dec)).toBeNull();
    expect(potWindowClosedReason("2026-H1", dec)).toContain("Vergangene");
  });
});
