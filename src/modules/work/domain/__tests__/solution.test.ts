import { describe, it, expect } from "vitest";
import {
  solutionStatusOf,
  solutionStatusToHorizonMode,
  investmentModeForHorizon,
  SOLUTION_STATUSES,
} from "@/modules/work/domain/solution";

describe("Solution-Status ↔ (Horizont, Modus)", () => {
  it("leitet den Status aus Horizont + Modus ab", () => {
    expect(solutionStatusOf("h3", null)).toBe("rd");
    expect(solutionStatusOf("h2", null)).toBe("emerging");
    expect(solutionStatusOf("h1", "investing")).toBe("investing");
    expect(solutionStatusOf("h1", "extracting")).toBe("extracting");
    expect(solutionStatusOf("h1", null)).toBe("investing"); // H1 ohne Modus = Investing
    expect(solutionStatusOf("h0", null)).toBe("decommissioning");
  });

  it("dekodiert Status zurück in Horizont + Modus", () => {
    expect(solutionStatusToHorizonMode("extracting")).toEqual({ horizon: "h1", investmentMode: "extracting" });
    expect(solutionStatusToHorizonMode("investing")).toEqual({ horizon: "h1", investmentMode: "investing" });
    expect(solutionStatusToHorizonMode("rd")).toEqual({ horizon: "h3", investmentMode: null });
    expect(solutionStatusToHorizonMode("decommissioning")).toEqual({ horizon: "h0", investmentMode: null });
  });

  it("Round-Trip: jeder Status bleibt nach decode→encode gleich", () => {
    for (const s of SOLUTION_STATUSES) {
      const { horizon, investmentMode } = solutionStatusToHorizonMode(s);
      expect(solutionStatusOf(horizon, investmentMode)).toBe(s);
    }
  });

  it("normalisiert Extracting außerhalb H1 weg", () => {
    expect(investmentModeForHorizon("h2", "extracting")).toBeNull();
    expect(investmentModeForHorizon("h1", "extracting")).toBe("extracting");
  });
});
