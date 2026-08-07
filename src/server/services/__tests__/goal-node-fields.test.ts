import { describe, it, expect } from "vitest";
import {
  projectGoalFields,
  readGoalFieldUpdates,
  goalRecordedUpdate,
  OBJECTIVE_FIELD_KEYS,
  KEY_RESULT_FIELD_KEYS,
  type GoalFieldValues,
} from "@/server/services/goal-node-fields";
import { clampPrecision } from "@/domain/goal-metric";

const row = (over: Partial<GoalFieldValues> = {}): GoalFieldValues => ({
  title: "Old",
  narrative: null,
  period: null,
  periodStart: null,
  periodEnd: null,
  status: null,
  dueDate: null,
  closingNote: null,
  ownerId: null,
  metricName: null,
  metricUnit: null,
  metricType: "number",
  precision: 2,
  currencyCode: null,
  rollupWeight: null,
  parentUnitPerChildUnit: null,
  baseline: null,
  target: null,
  current: null,
  progressMode: null,
  accountableTeamId: null,
  includeInParentRollup: true,
  ...over,
});

describe("goal-node-fields", () => {
  it("KR-Schlüssel sind eine Teilmenge der Objective-Schlüssel", () => {
    for (const k of KEY_RESULT_FIELD_KEYS) {
      expect(OBJECTIVE_FIELD_KEYS).toContain(k);
    }
  });

  it("projectGoalFields normalisiert Decimal-Spalten auf number|null", () => {
    // Ein Decimal-artiges Objekt (valueOf → number) wird via Number() normalisiert.
    const decimalLike = { valueOf: () => 12.5 };
    const p = projectGoalFields({ ...row(), rollupWeight: decimalLike, baseline: decimalLike });
    expect(p.rollupWeight).toBe(12.5);
    expect(p.baseline).toBe(12.5);
    expect(p.target).toBeNull();
  });

  it("readGoalFieldUpdates klemmt precision und reicht undefined durch", () => {
    const u = readGoalFieldUpdates({ title: "New", precision: 99 });
    expect(u.title).toBe("New");
    expect(u.precision).toBe(clampPrecision(99));
    expect(u.narrative).toBeUndefined();
  });

  it("goalRecordedUpdate difft nur die gewählte Schlüssel-Teilmenge", () => {
    const { data, changes } = goalRecordedUpdate(
      row({ title: "Old" }),
      { title: "New" },
      KEY_RESULT_FIELD_KEYS,
    );
    expect(data.title).toBe("New");
    expect(changes).toHaveProperty("title");
    // Nicht gesetzte Felder erscheinen nicht im Write.
    expect("target" in data).toBe(false);
  });

  it("KR-Update ignoriert Objective-only-Felder (narrative)", () => {
    const kr = goalRecordedUpdate(row(), { narrative: "N" }, KEY_RESULT_FIELD_KEYS);
    expect("narrative" in kr.data).toBe(false); // nicht in KR-Schlüsseln
    const obj = goalRecordedUpdate(row(), { narrative: "N" }, OBJECTIVE_FIELD_KEYS);
    expect(obj.data.narrative).toBe("N");
  });
});
