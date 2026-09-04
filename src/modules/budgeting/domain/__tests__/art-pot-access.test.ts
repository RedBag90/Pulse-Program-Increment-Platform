import { describe, it, expect } from "vitest";
import {
  artPotAccessDeniedReason,
  mayDistributeToEpic,
  type ArtPotAccessFacts,
} from "@/modules/budgeting/domain/art-pot-access";

const nobody: ArtPotAccessFacts = {
  isValueStreamFinance: false,
  isEpicSolutionProductManager: false,
  hasRtbCapability: false,
  hasArtDistributeCapability: false,
};

describe("artPotAccessDeniedReason", () => {
  it("lässt die Capability-Träger durch", () => {
    expect(artPotAccessDeniedReason({ ...nobody, hasRtbCapability: true })).toBeNull();
  });

  it("lässt die Finance-Partei des Wertstroms durch — ohne Rolle", () => {
    expect(artPotAccessDeniedReason({ ...nobody, isValueStreamFinance: true })).toBeNull();
  });

  it("lässt den Produkt-Manager der Solution dieses Epics durch", () => {
    expect(artPotAccessDeniedReason({ ...nobody, isEpicSolutionProductManager: true })).toBeNull();
  });

  it("lässt den RTE dieses ARTs durch — sein Recht hängt am ART", () => {
    expect(artPotAccessDeniedReason({ ...nobody, hasArtDistributeCapability: true })).toBeNull();
  });

  it("weist ab, wer keines von vieren ist — und nennt den Grund", () => {
    const reason = artPotAccessDeniedReason(nobody);
    expect(reason).not.toBeNull();
    expect(reason).toContain("RTE");
    expect(reason).toContain("Produkt-Manager");
  });
});

describe("mayDistributeToEpic — die Zeile, nicht der Topf", () => {
  it("gilt für den Produkt-Manager nur bei seinem eigenen Epic", () => {
    // Dieselbe Person, zwei Zeilen derselben Fläche: die eine trägt seine
    // Solution, die andere eine fremde.
    expect(mayDistributeToEpic({ ...nobody, isEpicSolutionProductManager: true })).toBe(true);
    expect(mayDistributeToEpic({ ...nobody, isEpicSolutionProductManager: false })).toBe(false);
  });

  it("gilt für Finance und Capability-Träger unabhängig vom Epic", () => {
    for (const facts of [
      { ...nobody, isValueStreamFinance: true },
      { ...nobody, hasRtbCapability: true },
      // Der RTE seines ARTs: sein Recht gilt für jede Zeile, nicht nur für die
      // Epics einer bestimmten Solution.
      { ...nobody, hasArtDistributeCapability: true },
    ]) {
      expect(mayDistributeToEpic({ ...facts, isEpicSolutionProductManager: false })).toBe(true);
      expect(mayDistributeToEpic({ ...facts, isEpicSolutionProductManager: true })).toBe(true);
    }
  });
});
