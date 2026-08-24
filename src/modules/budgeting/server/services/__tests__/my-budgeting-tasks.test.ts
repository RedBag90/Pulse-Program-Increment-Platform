import { describe, it, expect, vi } from "vitest";
import { listMyBudgetingTasks } from "@/modules/budgeting/server/services/my-budgeting-tasks";

function dbWith(rows: unknown[]) {
  return {
    budgetGroupMember: { findMany: vi.fn(async () => rows) },
  } as unknown as Parameters<typeof listMyBudgetingTasks>[0];
}

describe("listMyBudgetingTasks", () => {
  it("mappt Mitgliedschaften auf Hinweis-Rows mit Deep-Link", async () => {
    const db = dbWith([
      {
        group: {
          id: "g1",
          name: "Gruppe A",
          round: { id: "r1", cycleKey: "2026-H1", submissionDeadline: new Date("2026-06-30") },
        },
      },
    ]);
    const res = await listMyBudgetingTasks(db, { id: "u1", tenantId: "T" });
    expect(res).toHaveLength(1);
    expect(res[0]).toMatchObject({
      groupId: "g1",
      roundId: "r1",
      groupName: "Gruppe A",
      href: "/budgeting/periods/r1/distribute/g1",
    });
    expect(res[0]!.cycleLabel).toContain("2026");
  });

  it("leere Liste, wenn keine offene Mitgliedschaft", async () => {
    const res = await listMyBudgetingTasks(dbWith([]), { id: "u1", tenantId: "T" });
    expect(res).toEqual([]);
  });
});
