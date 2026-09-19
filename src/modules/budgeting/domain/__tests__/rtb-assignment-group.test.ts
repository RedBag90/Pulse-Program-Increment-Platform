import { describe, it, expect } from "vitest";
import {
  rtbAssignmentGroup,
  zaehltBeiAnderemArt,
} from "@/modules/budgeting/domain/rtb-art-resolution";

/**
 * Die Gliederung der Fläche „Einrichten". Drei Lagen, und eine vierte, die
 * keine eigene Gruppe bekommt: eine Position mit **beidem**.
 */

describe("rtbAssignmentGroup", () => {
  it("ordnet nach der Ebene, auf der eingetragen wurde", () => {
    expect(rtbAssignmentGroup({ artId: null, solutionId: null })).toBe("stream");
    expect(rtbAssignmentGroup({ artId: "a1", solutionId: null })).toBe("art");
    expect(rtbAssignmentGroup({ artId: null, solutionId: "s1" })).toBe("solution");
  });

  /**
   * **Die Gruppe folgt der Eingabe, nicht der Auflösung.** `resolveRtbToArts`
   * nimmt bei beidem den direkten ART; gefunden werden will die Position aber
   * dort, wo man sie eingetragen hat.
   */
  it("stellt eine Position mit ART **und** Solution zur Solution", () => {
    expect(rtbAssignmentGroup({ artId: "a1", solutionId: "s1" })).toBe("solution");
  });

  it("verträgt fehlende Felder", () => {
    expect(rtbAssignmentGroup({})).toBe("stream");
  });
});

describe("zaehltBeiAnderemArt", () => {
  /** Der Normalfall: der direkte ART ist derselbe wie der ART der Solution. */
  it("schweigt, solange beide Wege zum selben ART führen", () => {
    expect(zaehltBeiAnderemArt({ artId: "a1", solutionId: "s1" }, { s1: "a1" })).toBeNull();
  });

  /**
   * Der Fall, den es im Bestand nicht gibt und den das Modell erlaubt: die
   * Zeile steht unter einer Solution von ART A, ihr Geld zählt aber bei B.
   */
  it("nennt den ART, der wirklich zählt, wenn er abweicht", () => {
    expect(zaehltBeiAnderemArt({ artId: "b", solutionId: "s1" }, { s1: "a1" })).toBe("b");
  });

  it("schweigt ohne direkten ART — dann zählt ohnehin die Solution", () => {
    expect(zaehltBeiAnderemArt({ artId: null, solutionId: "s1" }, { s1: "a1" })).toBeNull();
  });

  it("schweigt ohne Solution", () => {
    expect(zaehltBeiAnderemArt({ artId: "a1", solutionId: null }, {})).toBeNull();
  });
});
