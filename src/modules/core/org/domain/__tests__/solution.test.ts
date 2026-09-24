import { describe, it, expect } from "vitest";
import {
  solutionStatusOf,
  solutionStatusToHorizonMode,
  investmentModeForHorizon,
  SOLUTION_STATUSES,
  SOLUTION_STATUS_STEP_KEYS,
  SOLUTION_TRANSITIONS,
  isSolutionHorizon,
  type SolutionStatus,
} from "@/modules/core/org/domain/solution";

describe("Solution-Status ↔ (Horizont, Modus)", () => {
  it("leitet den Status aus Horizont + Modus ab", () => {
    expect(solutionStatusOf("h2", null)).toBe("emerging");
    expect(solutionStatusOf("h1", "investing")).toBe("investing");
    expect(solutionStatusOf("h1", "extracting")).toBe("extracting");
    expect(solutionStatusOf("h1", null)).toBe("investing"); // H1 ohne Modus = Investing
    expect(solutionStatusOf("h0", null)).toBe("decommissioning");
  });

  it("dekodiert Status zurück in Horizont + Modus", () => {
    expect(solutionStatusToHorizonMode("extracting")).toEqual({
      horizon: "h1",
      investmentMode: "extracting",
    });
    expect(solutionStatusToHorizonMode("investing")).toEqual({
      horizon: "h1",
      investmentMode: "investing",
    });
    expect(solutionStatusToHorizonMode("emerging")).toEqual({
      horizon: "h2",
      investmentMode: null,
    });
    expect(solutionStatusToHorizonMode("decommissioning")).toEqual({
      horizon: "h0",
      investmentMode: null,
    });
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

describe("Die Leiter — vier Stufen, eine dreiwertige Achse", () => {
  it("beschriftet jede der vier Stufen", () => {
    expect(SOLUTION_STATUSES.map((s) => SOLUTION_STATUS_STEP_KEYS[s])).toEqual([
      "org.solutionStep.emerging",
      "org.solutionStep.investing",
      "org.solutionStep.extracting",
      "org.solutionStep.decommissioning",
    ]);
  });

  it("bildet Investing UND Extracting auf H1 ab", () => {
    // Die Invariante, die alles zusammenhält. Bricht sie, wandern Kanban-Bahnen,
    // Guardrail-Quoten und (mit Vorhaben A) eingefrorene Epic-Horizonte
    // gleichzeitig aus.
    expect(solutionStatusToHorizonMode("investing").horizon).toBe("h1");
    expect(solutionStatusToHorizonMode("extracting").horizon).toBe("h1");
  });
});

describe("In H3 gibt es keine Solution", () => {
  it("kein Status bildet auf H3 ab", () => {
    const horizons = SOLUTION_STATUSES.map((s) => solutionStatusToHorizonMode(s).horizon);
    expect(horizons).not.toContain("h3");
  });

  it("ein gespeichertes H3 aus dem Altbestand liest sich als Emerging", () => {
    // Nicht als H1: der Anwärter bleibt ein Anwärter. Ein stiller Fallback auf
    // „läuft im Kern" wäre die schlechtere Auskunft.
    expect(solutionStatusOf("h3", null)).toBe("emerging");
  });

  it("H3 bleibt ein gültiger Horizont — für Epics", () => {
    // Die Guardrail-Achse ist unberührt; nur das Produkt kann dort nicht stehen.
    expect(isSolutionHorizon("h3")).toBe(false);
    expect(isSolutionHorizon("h2")).toBe(true);
  });
});

describe("SOLUTION_TRANSITIONS — die erlaubten Kanten", () => {
  it("nennt je Stufe genau die vorgesehenen Nachfolger", () => {
    const edges = Object.fromEntries(
      SOLUTION_STATUSES.map((s) => [s, SOLUTION_TRANSITIONS[s].map((t) => t.to)]),
    );
    expect(edges).toEqual({
      emerging: ["investing", "decommissioning"],
      investing: ["extracting", "decommissioning", "emerging"],
      extracting: ["investing", "decommissioning", "emerging"],
      decommissioning: ["investing"],
    });
  });

  it("trägt das Beförderungs-Tor an genau einer Kante", () => {
    const gated = SOLUTION_STATUSES.flatMap((s) =>
      SOLUTION_TRANSITIONS[s].filter((t) => t.gate).map((t) => `${s}→${t.to}`),
    );
    expect(gated).toEqual(["emerging→investing"]);
  });

  it("macht H1.1 ↔ H1.2 zum gewöhnlichen Schritt — in beide Richtungen", () => {
    // Kein Schieber mehr: der Wechsel von „ausbauen" zu „ernten" ist ein Schritt
    // auf der Leiter, und der Rückweg bleibt offen.
    const step = (from: SolutionStatus, to: SolutionStatus) =>
      SOLUTION_TRANSITIONS[from].find((t) => t.to === to);
    expect(step("investing", "extracting")?.gate).toBeUndefined();
    expect(step("extracting", "investing")?.gate).toBeUndefined();
  });

  it("führt jede Kante auf eine echte Stufe", () => {
    for (const s of SOLUTION_STATUSES) {
      for (const t of SOLUTION_TRANSITIONS[s]) {
        expect(SOLUTION_STATUSES).toContain(t.to);
        expect(t.to).not.toBe(s);
        expect(t.label.length).toBeGreaterThan(0);
      }
    }
  });

  it("lässt jede Stufe erreichbar — keine Sackgasse, kein Waisenkind", () => {
    const reachable = new Set(
      SOLUTION_STATUSES.flatMap((s) => SOLUTION_TRANSITIONS[s].map((t) => t.to)),
    );
    for (const s of SOLUTION_STATUSES) {
      // Emerging ist der Eintritt: eine Solution entsteht in H2, und niemand
      // führt von aussen dorthin (ADR-0020).
      if (s !== "emerging") expect(reachable).toContain(s);
      expect(SOLUTION_TRANSITIONS[s].length).toBeGreaterThan(0);
    }
  });
});
