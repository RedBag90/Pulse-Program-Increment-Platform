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

/** Schluessel des einen offenen Schritts, oder null wenn alles erledigt ist. */
function current(themes: GoalSetupNode[]): string | null {
  return goalSetupSteps(themes).steps.find((s) => s.isNext)?.key ?? null;
}

/** Erledigt-Flags aller fuenf Schritte, in Reihenfolge. */
function erledigt(themes: GoalSetupNode[], sichtbar?: GoalSetupNode[]): boolean[] {
  return goalSetupSteps(themes, sichtbar).steps.map((s) => s.done);
}

describe("goalSetupSteps", () => {
  it("has the 5 ordered steps with descriptions", () => {
    expect(GOAL_SETUP_STEPS).toHaveLength(5);
    expect(GOAL_SETUP_STEPS.every((s) => s.description.length > 0)).toBe(true);
    expect(GOAL_SETUP_STEPS[0]!.key).toBe("create");
  });

  it("empty tree → step 1 (create) offen und als naechster markiert", () => {
    const res = goalSetupSteps([]);
    expect(res.complete).toBe(false);
    expect(res.steps.every((s) => !s.done)).toBe(true);
    expect(res.steps[0]!.isNext).toBe(true);
    expect(res.steps.filter((s) => s.isNext)).toHaveLength(1);
    expect(res.steps[0]!.actionGoalId).toBeNull(); // „anlegen" kennt noch kein Ziel
  });

  it("one bare goal (title only) → create done, Zeitraum offen mit Sprungziel", () => {
    const res = goalSetupSteps([node({ id: "g1" })]);
    expect(res.steps[0]!.done).toBe(true);
    expect(res.steps[1]!.key).toBe("period");
    expect(res.steps[1]!.done).toBe(false);
    expect(res.steps[1]!.isNext).toBe(true);
    expect(res.steps[1]!.actionGoalId).toBe("g1"); // g1 oeffnen, um den Zeitraum zu setzen
  });

  it("jeder offene Schritt traegt sein eigenes Sprungziel, nicht nur der naechste", () => {
    // Vorher bekam ausschliesslich der aktuelle Schritt eine Id; die uebrigen
    // standen ohne Weg da, obwohl `perStep` ihn fuer jeden kennt.
    const res = goalSetupSteps([node({ id: "g1" })]);
    const offen = res.steps.filter((s) => !s.done);
    expect(offen).toHaveLength(4);
    expect(offen.every((s) => s.actionGoalId === "g1")).toBe(true);
  });

  it("hakt einen spaeter stehenden Schritt ab, wenn er erfuellt ist", () => {
    // Der eigentliche Unterschied zur Reihenfolge-Ableitung: ein Ziel ohne
    // Owner, aber mit Zielwert. Frueher galt „Messgroesse" als „kommt noch",
    // weil „Owner" davor offen stand — obwohl es erfuellt war.
    expect(erledigt([node({ id: "g1", period: "2026-Q1", target: 100 })])).toEqual([
      true, // create
      true, // period
      false, // owner
      true, // metric — steht hinter einem offenen Schritt und ist trotzdem erledigt
      false, // checkin
    ]);
    expect(current([node({ id: "g1", period: "2026-Q1", target: 100 })])).toBe("owner");
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

  it("fully set → complete, kein naechster Schritt", () => {
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
    expect(res.steps.every((s) => s.done)).toBe(true);
    expect(res.steps.some((s) => s.isNext)).toBe(false);
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
    expect(res.steps[2]!.done).toBe(true);
    // …und identisch zur ungefilterten Ableitung.
    expect(erledigt(all, [bare])).toEqual(erledigt(all));
  });

  it("leere Filter-Treffermenge wirft den Guide nicht auf Schritt 1 zurück", () => {
    const res = goalSetupSteps([withOwner, bare], []);
    expect(res.steps[0]!.done).toBe(true); // create bleibt erledigt
    expect(res.steps.find((s) => s.isNext)?.key).toBe("metric");
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

  it("actionGoalHidden haengt an der Zeile, nicht am Ergebnis", () => {
    const all = [withOwner, bare];
    // Der Status-Filter blendet g1 aus. „metric" zeigt auf g1 (das erste Ziel
    // ohne Zielwert) und ist damit versteckt; „checkin" zeigt auf g1 ebenso.
    // Ein gemeinsames Flag haette nur fuer einen der beiden gesprochen.
    const res = goalSetupSteps(all, [bare]);
    const metric = res.steps.find((s) => s.key === "metric")!;
    expect(metric.actionGoalId).toBe("g1");
    expect(metric.actionGoalHidden).toBe(true);

    // Derselbe Schritt bei voller Sicht: sichtbar.
    const sichtbar = goalSetupSteps(all, all).steps.find((s) => s.key === "metric")!;
    expect(sichtbar.actionGoalHidden).toBe(false);
  });

  it("markiert nur die Zeilen, deren eigenes Ziel weggefiltert ist", () => {
    // g1 hat einen Zeitraum, g2 nicht. Blendet der Filter **g2** aus, ist der
    // Zeitraum-Schritt versteckt — die uebrigen zeigen auf g1 und bleiben
    // sichtbar.
    const res = goalSetupSteps([withOwner, bare], [withOwner]);
    const byKey = Object.fromEntries(res.steps.map((s) => [s.key, s]));
    expect(byKey["period"]!.actionGoalId).toBe("g2");
    expect(byKey["period"]!.actionGoalHidden).toBe(true);
    expect(byKey["metric"]!.actionGoalId).toBe("g1");
    expect(byKey["metric"]!.actionGoalHidden).toBe(false);
  });

  it("ohne zweiten Parameter ist nie etwas versteckt", () => {
    expect(goalSetupSteps([bare]).steps.some((s) => s.actionGoalHidden)).toBe(false);
    expect(goalSetupSteps([]).steps.some((s) => s.actionGoalHidden)).toBe(false);
  });
});
