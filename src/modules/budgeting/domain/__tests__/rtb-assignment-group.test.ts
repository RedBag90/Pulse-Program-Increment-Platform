import { describe, it, expect } from "vitest";
import {
  rtbAssignmentGroup,
  zaehltBeiAnderemArt,
  RTB_ASSIGNMENT_GROUPS,
  RTB_ASSIGNMENT_GROUP_LABELS,
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

/**
 * **Ein Wort je Ebene, an einem Ort.** Die drei Namen standen in der
 * Einrichten-Fläche und bei den Vorlagen; mit der Aufteil-Fläche wären es drei
 * Kopien geworden. Dieser Test hält fest, dass es bei einer bleibt — und dass
 * die Reihenfolge von der breitesten Zurechnung zur engsten läuft, weil die
 * Flächen sie so lesen.
 */
describe("die Gruppen als gemeinsames Vokabular", () => {
  it("führt genau drei Ebenen, von breit nach eng", () => {
    expect(RTB_ASSIGNMENT_GROUPS).toEqual(["stream", "art", "solution"]);
  });

  it("hat zu jeder Ebene ein Wort", () => {
    for (const g of RTB_ASSIGNMENT_GROUPS) {
      expect(RTB_ASSIGNMENT_GROUP_LABELS[g], g).toBeTruthy();
    }
    expect(new Set(Object.values(RTB_ASSIGNMENT_GROUP_LABELS)).size).toBe(3);
  });

  /**
   * Die Probe für die Aufteil-Fläche: jede Position fällt in genau **einen**
   * Block und **eine** Gruppe — keine verschwindet, keine steht zweimal.
   */
  it("teilt eine Liste vollständig und überschneidungsfrei auf", () => {
    const zeilen = [
      { name: "übergreifend", artId: null, solutionId: null },
      { name: "am ART", artId: "a1", solutionId: null },
      { name: "an Solution", artId: null, solutionId: "s1" },
      { name: "beides", artId: "a1", solutionId: "s1" },
    ];
    const verteilt = RTB_ASSIGNMENT_GROUPS.flatMap((g) =>
      zeilen.filter((z) => rtbAssignmentGroup(z) === g),
    );
    expect(verteilt).toHaveLength(zeilen.length);
    expect(new Set(verteilt.map((z) => z.name)).size).toBe(zeilen.length);
  });
});
