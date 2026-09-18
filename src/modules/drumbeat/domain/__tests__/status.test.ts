import { describe, it, expect } from "vitest";
import {
  FEATURE_STATUSES,
  FEATURE_STATUS_LABELS,
  PI_STATUS_LABELS,
  needsReasonForStatus,
} from "@/modules/drumbeat/domain/status";

/**
 * Die Grund-Pflicht war zweimal wörtlich im Board ausgeschrieben und fehlte in
 * Tabelle und Bulk-Leiste — dieselbe Handlung, zwei Regeln. Wer den Grund nicht
 * angeben wollte, nahm die Tabelle. Seit die Regel hier steht, teilen sie
 * alle drei Schreibwege.
 */
describe("needsReasonForStatus", () => {
  it("verlangt einen Grund, wo Arbeit angehalten wird", () => {
    expect(needsReasonForStatus("blocked")).toBe(true);
    expect(needsReasonForStatus("cancelled")).toBe(true);
  });

  it("verlangt keinen, wo Arbeit weitergeht", () => {
    expect(needsReasonForStatus("approved")).toBe(false);
    expect(needsReasonForStatus("in_progress")).toBe(false);
    expect(needsReasonForStatus("completed")).toBe(false);
  });

  it("kennt jeden Status — ein neuer fällt nicht still durch", () => {
    for (const s of FEATURE_STATUSES) {
      expect(typeof needsReasonForStatus(s)).toBe("boolean");
    }
  });
});

describe("Beschriftungen", () => {
  it("hat für jeden Feature-Status ein deutsches Wort", () => {
    for (const s of FEATURE_STATUSES) {
      expect(FEATURE_STATUS_LABELS[s], s).toBeTruthy();
    }
  });

  /**
   * Die Kontext-Leiste gab den rohen Wert aus („planned") — obwohl diese Tabelle
   * seit je danebenliegt.
   */
  it("hat für jeden PI-Status ein deutsches Wort", () => {
    for (const s of ["planned", "active", "completed"] as const) {
      expect(PI_STATUS_LABELS[s], s).toBeTruthy();
    }
  });
});
