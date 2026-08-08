import { describe, it, expect } from "vitest";
import { reifegradGroups } from "@/features/portfolio/lib/reifegrad-groups";

describe("reifegradGroups", () => {
  it("fasst aufeinanderfolgende gleiche Reifegrade zusammen", () => {
    // Timeline: Funnel(L0) · Detailing/Hypothesis(L1) · Analyzing/BusinessCase(L2) · Backlog(L3) · Impl(L4) · Done(L5)
    const groups = reifegradGroups(["L0", "L1", "L1", "L2", "L2", "L3", "L4", "L5"]);
    expect(groups).toEqual([
      { level: "L0", start: 0, span: 1 },
      { level: "L1", start: 1, span: 2 },
      { level: "L2", start: 3, span: 2 },
      { level: "L3", start: 5, span: 1 },
      { level: "L4", start: 6, span: 1 },
      { level: "L5", start: 7, span: 1 },
    ]);
  });

  it("startet bei jedem Wechsel eine neue Gruppe (auch bei Wiederkehr)", () => {
    const groups = reifegradGroups(["L1", "L2", "L1"]);
    expect(groups.map((g) => `${g.level}:${g.span}`)).toEqual(["L1:1", "L2:1", "L1:1"]);
  });

  it("leere Eingabe ⇒ []", () => {
    expect(reifegradGroups([])).toEqual([]);
  });

  it("alle gleich ⇒ eine Gruppe mit voller span", () => {
    expect(reifegradGroups(["L2", "L2", "L2"])).toEqual([{ level: "L2", start: 0, span: 3 }]);
  });
});
