import { describe, it, expect } from "vitest";
import {
  goalSetupSteps,
  GOAL_SETUP_STEPS,
  type GoalSetupNode,
} from "@/modules/core/goals/domain/goal-setup";

function node(over: Partial<GoalSetupNode> = {}): GoalSetupNode {
  return {
    id: "n1",
    period: null,
    periodStart: null,
    periodEnd: null,
    ownerId: null,
    target: null,
    latestCheckin: null,
    status: null,
    children: [],
    ...over,
  };
}

/** key of the single `current` step, or null when complete. */
function current(themes: GoalSetupNode[]): string | null {
  return goalSetupSteps(themes).steps.find((s) => s.status === "current")?.key ?? null;
}

describe("goalSetupSteps", () => {
  it("has the 5 ordered steps with descriptions", () => {
    expect(GOAL_SETUP_STEPS).toHaveLength(5);
    expect(GOAL_SETUP_STEPS.every((s) => s.description.length > 0)).toBe(true);
    expect(GOAL_SETUP_STEPS[0]!.key).toBe("create");
  });

  it("empty tree → step 1 (create) current, none done, not complete", () => {
    const res = goalSetupSteps([]);
    expect(res.complete).toBe(false);
    expect(res.steps[0]!.status).toBe("current");
    expect(res.steps.slice(1).every((s) => s.status === "upcoming")).toBe(true);
    expect(res.steps[0]!.actionGoalId).toBeNull(); // create has no target goal
  });

  it("one bare goal (title only) → create done, Zeitraum current with a target goal", () => {
    const res = goalSetupSteps([node({ id: "g1" })]);
    expect(res.steps[0]!.status).toBe("done");
    expect(res.steps[1]!.key).toBe("period");
    expect(res.steps[1]!.status).toBe("current");
    expect(res.steps[1]!.actionGoalId).toBe("g1"); // open g1 to set the period
  });

  it("period + owner set → Messgröße current", () => {
    expect(current([node({ id: "g1", period: "2026-Q1", ownerId: "u1" })])).toBe("metric");
  });

  it("a complete range satisfies the period step", () => {
    expect(
      current([node({ period: null, periodStart: "2026-01-01", periodEnd: "2026-06-30" })]),
    ).toBe("owner");
  });

  it("half a range does not — goalTimeframe needs both bounds", () => {
    // Nur Start: das Ziel hätte keinen effektiven Zeitraum (keine Roadmap-Position,
    // kein Filter-Treffer) — der Schritt darf deshalb nicht als erledigt gelten.
    expect(current([node({ period: null, periodStart: "2026-01-01" })])).toBe("period");
    expect(current([node({ period: null, periodEnd: "2026-06-30" })])).toBe("period");
  });

  it("rollup parent (children, no own target) satisfies the metric step", () => {
    const parent = node({ id: "p", period: "2026", ownerId: "u1", children: [node({ id: "c" })] });
    // parent lacks target but has a child → metric done → Status-Update current
    expect(current([parent])).toBe("checkin");
  });

  it("fully set → complete, no current", () => {
    const res = goalSetupSteps([
      node({
        id: "g1",
        period: "2026-Q1",
        ownerId: "u1",
        target: 100,
        latestCheckin: { status: "on_track" },
      }),
    ]);
    expect(res.complete).toBe(true);
    expect(res.steps.every((s) => s.status === "done")).toBe(true);
    expect(res.steps.some((s) => s.status === "current")).toBe(false);
  });

  it("status without a check-in also satisfies the last step", () => {
    const res = goalSetupSteps([
      node({ period: "2026", ownerId: "u1", target: 100, status: "at_risk" }),
    ]);
    expect(res.complete).toBe(true);
  });
});

/**
 * Der Guide beschreibt den Tenant, nicht den sichtbaren Ausschnitt: die Filter
 * der Ziele-Seite (Zeitraum/Status/VS/ART) dürfen keinen erledigten Schritt
 * zurück auf „offen" kippen. Erster Parameter = ungefilterter Baum, zweiter =
 * das, was der Filter übrig lässt.
 */
describe("goalSetupSteps mit gefilterter Sicht", () => {
  const withOwner = node({ id: "g1", period: "2026-Q1", ownerId: "u1" });
  const bare = node({ id: "g2" });

  it("weggefiltertes Owner-Ziel lässt den Owner-Schritt erledigt", () => {
    const all = [withOwner, bare];
    // Status-Filter blendet g1 (das einzige Ziel mit Owner) aus.
    const res = goalSetupSteps(all, [bare]);
    expect(res.steps[2]!.key).toBe("owner");
    expect(res.steps[2]!.status).toBe("done");
    // …und identisch zur ungefilterten Ableitung.
    expect(res.steps.map((s) => s.status)).toEqual(goalSetupSteps(all).steps.map((s) => s.status));
  });

  it("leere Filter-Treffermenge wirft den Guide nicht auf Schritt 1 zurück", () => {
    const res = goalSetupSteps([withOwner, bare], []);
    expect(res.steps[0]!.status).toBe("done"); // create bleibt erledigt
    expect(res.steps.find((s) => s.status === "current")?.key).toBe("metric");
    expect(current([withOwner, bare])).toBe("metric"); // identisch zur ungefilterten Sicht
  });

  it("vollständig aufgesetzter Tenant bleibt trotz Filter complete", () => {
    const done = node({
      id: "g1",
      period: "2026-Q1",
      ownerId: "u1",
      target: 100,
      latestCheckin: { status: "on_track" },
    });
    expect(goalSetupSteps([done], []).complete).toBe(true);
  });

  it("actionGoalHidden: true wenn das CTA-Ziel weggefiltert ist, sonst false", () => {
    const all = [withOwner, bare];
    // Aktueller Schritt ist „metric"; erstes fehlschlagendes Ziel ist g1.
    const hidden = goalSetupSteps(all, [bare]);
    expect(hidden.steps.find((s) => s.status === "current")?.actionGoalId).toBe("g1");
    expect(hidden.actionGoalHidden).toBe(true);

    expect(goalSetupSteps(all, all).actionGoalHidden).toBe(false);
  });

  it("ohne zweiten Parameter unverändert — actionGoalHidden nie true", () => {
    expect(goalSetupSteps([bare]).actionGoalHidden).toBe(false);
    expect(goalSetupSteps([]).actionGoalHidden).toBe(false); // kein CTA-Ziel bei „create"
  });
});
