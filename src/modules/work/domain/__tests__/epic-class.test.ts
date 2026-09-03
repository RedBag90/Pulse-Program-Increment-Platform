import { describe, it, expect } from "vitest";

import {
  classifyEpic,
  type EpicClassState,
  classificationDrift,
  driftAllowsOverride,
} from "@/modules/work/domain/pb-submission";

const LIMIT = 100_000;
const bc = (...slices: number[]) => ({
  current: { costSlices: slices.map((amount) => ({ amount })) },
});

const epic = (over: Partial<EpicClassState> = {}): EpicClassState => ({
  businessCaseApprovedAt: new Date("2026-01-01"),
  hypothesisApprovedAt: new Date("2025-06-01"),
  businessCase: bc(80_000),
  portfolioOverrideAt: null,
  ...over,
});

describe("classifyEpic", () => {
  it("über dem Limit ist es Portfolio-Sache", () => {
    const c = classifyEpic(epic({ businessCase: bc(120_000, 80_000) }), LIMIT);
    expect(c.epicClass).toBe("portfolio");
    expect(c.cost).toBe(200_000);
  });

  it("unter dem Limit ist es ein ART-Epic", () => {
    expect(classifyEpic(epic(), LIMIT).epicClass).toBe("art");
  });

  // Die Schwelle ist die Untergrenze dessen, was das Portfolio entscheidet.
  it("Gleichstand zählt als ART-Epic", () => {
    expect(classifyEpic(epic({ businessCase: bc(LIMIT) }), LIMIT).epicClass).toBe("art");
  });

  // Der Kern der Regel: nur ein freigegebener Business Case begründet eine
  // Klasse. Sonst klassifizierte der Default-Aufwand — eine Reife-Aussage im
  // Gewand einer Größen-Aussage.
  it("ohne freigegebenen Business Case gibt es keine Klasse", () => {
    const c = classifyEpic(epic({ businessCaseApprovedAt: null }), LIMIT);
    expect(c.epicClass).toBeNull();
    expect(c.cost).toBeNull();
  });

  it("auch eine freigegebene Hypothese allein klassifiziert nicht", () => {
    const c = classifyEpic(
      epic({ businessCaseApprovedAt: null, hypothesisApprovedAt: new Date("2025-06-01") }),
      LIMIT,
    );
    expect(c.epicClass).toBeNull();
  });

  it("die Ausnahme hebt ein kleines Vorhaben ins Portfolio", () => {
    const c = classifyEpic(epic({ portfolioOverrideAt: new Date("2026-02-01") }), LIMIT);
    expect(c.epicClass).toBe("portfolio");
    expect(c.overridden).toBe(true);
  });

  it("die Ausnahme wirkt auch ohne Business Case", () => {
    const c = classifyEpic(
      epic({ businessCaseApprovedAt: null, portfolioOverrideAt: new Date("2026-02-01") }),
      LIMIT,
    );
    expect(c.epicClass).toBe("portfolio");
  });

  it("ein Limit von 0 macht alles zur Portfolio-Sache", () => {
    expect(classifyEpic(epic({ businessCase: bc(1) }), 0).epicClass).toBe("portfolio");
  });

  it("ein Business Case ohne Kostenscheiben zählt als 0 und damit als ART-Epic", () => {
    expect(classifyEpic(epic({ businessCase: { current: {} } }), LIMIT).epicClass).toBe("art");
  });
});

describe("classificationDrift", () => {
  it("meldet nichts, solange es nichts zu vergleichen gibt", () => {
    expect(classificationDrift(null, "art")).toBe("none");
    expect(classificationDrift("art", null)).toBe("none");
    expect(classificationDrift(null, null)).toBe("none");
  });

  it("meldet nichts bei Übereinstimmung", () => {
    expect(classificationDrift("art", "art")).toBe("none");
    expect(classificationDrift("portfolio", "portfolio")).toBe("none");
  });

  it("nennt die Richtung der Abweichung", () => {
    expect(classificationDrift("art", "portfolio")).toBe("up");
    expect(classificationDrift("portfolio", "art")).toBe("down");
  });
});

describe("driftAllowsOverride", () => {
  // Nur nach unten: was über dem Limit liegt, braucht eine Portfolio-
  // Entscheidung — und ein ART-Rahmen könnte es ohnehin nicht tragen.
  it("erlaubt das Bestehen nur, wenn es zum ART-Epic würde", () => {
    expect(driftAllowsOverride("down")).toBe(true);
    expect(driftAllowsOverride("up")).toBe(false);
    expect(driftAllowsOverride("none")).toBe(false);
  });
});
