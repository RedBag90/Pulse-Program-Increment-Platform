import { describe, it, expect } from "vitest";
import {
  buildGoalPickerTree,
  type GoalPickerRow,
} from "@/modules/core/goals/features/lib/goal-picker-tree";

const row = (id: string, parentObjectiveId: string | null, name = id): GoalPickerRow => ({
  id,
  name,
  parentObjectiveId,
});

const shape = (nodes: { id: string; children: unknown[] }[]): unknown =>
  nodes.map((n) => ({ id: n.id, children: shape(n.children as never) }));

describe("buildGoalPickerTree", () => {
  it("nistet Kinder unter ihren Eltern, Reihenfolge bleibt erhalten", () => {
    // Eingabe nach sortOrder: T, A(unter T), A1(unter A), B(unter T), C (Wurzel)
    const rows = [row("T", null), row("A", "T"), row("A1", "A"), row("B", "T"), row("C", null)];
    expect(shape(buildGoalPickerTree(rows))).toEqual([
      {
        id: "T",
        children: [
          { id: "A", children: [{ id: "A1", children: [] }] },
          { id: "B", children: [] },
        ],
      },
      { id: "C", children: [] },
    ]);
  });

  it("Eltern nicht im Satz ⇒ Kind wird Wurzel (kein Verwaisen)", () => {
    const rows = [row("x", "missing-parent"), row("y", null)];
    const roots = buildGoalPickerTree(rows);
    expect(roots.map((n) => n.id)).toEqual(["x", "y"]);
    expect(roots.every((n) => n.children.length === 0)).toBe(true);
  });

  it("leere Liste ⇒ []", () => {
    expect(buildGoalPickerTree([])).toEqual([]);
  });

  it("übernimmt status/period, defaultet auf null", () => {
    const [n] = buildGoalPickerTree([
      { id: "a", name: "A", parentObjectiveId: null, status: "on_track", period: "2026-Q1" },
    ]);
    expect(n).toMatchObject({ id: "a", name: "A", status: "on_track", period: "2026-Q1" });
    const [m] = buildGoalPickerTree([row("b", null)]);
    expect(m).toMatchObject({ status: null, period: null });
  });
});
