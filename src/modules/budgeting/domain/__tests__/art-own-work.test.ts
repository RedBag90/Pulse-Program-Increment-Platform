import { describe, it, expect } from "vitest";
import { ownWorkGuide, ownWorkExceedsFrame } from "@/modules/budgeting/domain/art-own-work";

/**
 * Der Richtwert für ART-eigene Arbeit. Er ist die einzige neue Zahl dieser
 * Änderung — und eine Schätzung, die als solche erkennbar bleiben muss.
 */

describe("ownWorkGuide", () => {
  it("rechnet Last mal Satz", () => {
    const g = ownWorkGuide({ jobSize: 13, count: 2 }, 13_043);
    expect(g.ask).toBe(169_559);
    expect(g).toMatchObject({ featureCount: 2, jobSize: 13, rate: 13_043 });
  });

  /**
   * **„—", nicht 0 €.** Eine Null wäre eine Aussage, die niemand getroffen hat:
   * dass diese Arbeit nichts kostet. Ohne Satz gibt es schlicht keinen
   * Richtwert.
   */
  it("gibt ohne Satz keinen Richtwert, sondern `null`", () => {
    expect(ownWorkGuide({ jobSize: 13, count: 2 }, null).ask).toBeNull();
  });

  it("gibt ohne eingeplantes Feature 0 € — der Satz allein bindet nichts", () => {
    const g = ownWorkGuide({ jobSize: 0, count: 0 }, 13_043);
    expect(g.ask).toBe(0);
    expect(g.featureCount).toBe(0);
  });
});

describe("ownWorkExceedsFrame", () => {
  /** Der gemessene Fall: Plant Efficiency, 2026-H2. */
  it("meldet den gemessenen Überhang", () => {
    expect(ownWorkExceedsFrame(ownWorkGuide({ jobSize: 13, count: 2 }, 13_043), 58_750)).toBe(true);
  });

  it("schweigt, wenn der Richtwert in den Rahmen passt", () => {
    expect(ownWorkExceedsFrame(ownWorkGuide({ jobSize: 2, count: 1 }, 1_000), 58_750)).toBe(false);
  });

  /** Ohne Richtwert gibt es nichts zu vergleichen — und keine Warnung. */
  it("schweigt ohne Satz", () => {
    expect(ownWorkExceedsFrame(ownWorkGuide({ jobSize: 13, count: 2 }, null), 0)).toBe(false);
  });
});
