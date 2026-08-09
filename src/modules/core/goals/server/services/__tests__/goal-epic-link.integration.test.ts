import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/test/setup-db";
import { seedTenant } from "@/test/fixtures/seed";
import { createTestPrismaClient } from "@/server/db/test-client";
import {
  linkEpicToGoal,
  unlinkEpicFromGoal,
} from "@/modules/core/goals/server/services/goal-epic-link";
import { InitiativeLevel } from "@/domain/types";
import { ROLES } from "@/modules/core/kernel/domain/roles";
import type { RequestContext } from "@/server/http/mutation-handler";
import { isOk, isErr } from "@/modules/core/kernel/domain/errors";
import { MODULE_KEYS } from "@/modules/core/kernel/domain/modules";

let seed: Awaited<ReturnType<typeof seedTenant>>;

beforeEach(async () => {
  const testDb = createTestPrismaClient();
  seed = await seedTenant(testDb);
  await testDb.$disconnect();
});

/** Admin context — bypasses authorizeResource (kpi.bind) via the TENANT_ADMIN fast-path. */
function adminCtx(): RequestContext {
  return {
    db,
    principal: {
      id: seed.actorId,
      tenantId: seed.tenantId,
      email: "admin@example.com",
      roles: [ROLES.TENANT_ADMIN],
      scopes: { valueStreamIds: [], artIds: [], teamIds: [] },
      capabilities: [],
      tenantKind: "organization",
      tenantStatus: "active",
      isPlatformAdmin: false,
      enabledModules: MODULE_KEYS,
    },
  };
}

/** Ein Epic mit `n` KPIs; alle als Erfolgs-KPI markiert (für die Kaskade). */
async function makeEpic(n = 1): Promise<{ epicId: string; kpiIds: string[] }> {
  const epic = await db.initiative.create({
    data: {
      tenantId: seed.tenantId,
      level: InitiativeLevel.EPIC,
      title: "Related Epic",
      path: "",
      ownerId: seed.actorId,
      assigneeIds: [],
      createdBy: seed.actorId,
      updatedBy: seed.actorId,
    },
  });
  await db.initiative.update({ where: { id: epic.id }, data: { path: epic.id } });
  const kpiIds: string[] = [];
  for (let i = 0; i < n; i++) {
    const kpi = await db.kpi.create({
      data: {
        tenantId: seed.tenantId,
        initiativeId: epic.id,
        name: `KPI ${i}`,
        baseline: 0,
        target: 100,
        measurements: [],
        valuePerUnit: 10,
        createdBy: seed.actorId,
        updatedBy: seed.actorId,
      },
    });
    kpiIds.push(kpi.id);
  }
  return { epicId: epic.id, kpiIds };
}

/** Zwei Ziel-Knoten (Objective + Kind) unter einem Theme. */
async function makeGoals(): Promise<{ goalA: string; goalB: string }> {
  const theme = await db.strategicTheme.create({
    data: {
      tenantId: seed.tenantId,
      title: "Theme",
      kind: "business",
      color: "#6366f1",
      createdBy: seed.actorId,
      updatedBy: seed.actorId,
    },
  });
  const goalA = await db.objective.create({
    data: {
      tenantId: seed.tenantId,
      themeId: theme.id,
      title: "Goal A",
      createdBy: seed.actorId,
      updatedBy: seed.actorId,
    },
  });
  const goalB = await db.objective.create({
    data: {
      tenantId: seed.tenantId,
      themeId: theme.id,
      parentObjectiveId: goalA.id,
      level: 1,
      title: "Goal B",
      createdBy: seed.actorId,
      updatedBy: seed.actorId,
    },
  });
  return { goalA: goalA.id, goalB: goalB.id };
}

describe("linkEpicToGoal", () => {
  it("links an epic to a goal via a chosen success KPI + factor (row + audit)", async () => {
    const { epicId, kpiIds } = await makeEpic();
    const { goalA } = await makeGoals();

    const before = await db.auditEvent.count({ where: { tenantId: seed.tenantId } });
    const result = await linkEpicToGoal(adminCtx(), {
      epicId,
      objectiveId: goalA,
      kpiId: kpiIds[0]!,
      conversionFactor: 10000,
      impactKind: "recurring",
    });
    expect(isOk(result)).toBe(true);
    const link = await db.goalEpicLink.findFirst({ where: { tenantId: seed.tenantId, epicId } });
    expect(link?.objectiveId).toBe(goalA);
    expect(link?.kpiId).toBe(kpiIds[0]);
    expect(Number(link?.conversionFactor)).toBe(10000);
    const after = await db.auditEvent.count({ where: { tenantId: seed.tenantId } });
    expect(after).toBe(before + 1);
  });

  it("links one epic to TWO goals via different KPIs (multi-goal; @@unique([epicId]) gone)", async () => {
    const { epicId, kpiIds } = await makeEpic(2);
    const { goalA, goalB } = await makeGoals();

    const r1 = await linkEpicToGoal(adminCtx(), {
      epicId,
      objectiveId: goalA,
      kpiId: kpiIds[0]!,
      conversionFactor: 100,
    });
    const r2 = await linkEpicToGoal(adminCtx(), {
      epicId,
      objectiveId: goalB,
      kpiId: kpiIds[1]!,
      conversionFactor: 200,
    });
    expect(isOk(r1)).toBe(true);
    expect(isOk(r2)).toBe(true);
    const links = await db.goalEpicLink.findMany({ where: { tenantId: seed.tenantId, epicId } });
    expect(links).toHaveLength(2);
  });

  it("updates the same (epic, goal) pair in place rather than duplicating", async () => {
    const { epicId, kpiIds } = await makeEpic();
    const { goalA } = await makeGoals();

    await linkEpicToGoal(adminCtx(), {
      epicId,
      objectiveId: goalA,
      kpiId: kpiIds[0]!,
      conversionFactor: 100,
    });
    await linkEpicToGoal(adminCtx(), {
      epicId,
      objectiveId: goalA,
      kpiId: kpiIds[0]!,
      conversionFactor: 250,
    });
    const links = await db.goalEpicLink.findMany({ where: { tenantId: seed.tenantId, epicId } });
    expect(links).toHaveLength(1);
    expect(Number(links[0]!.conversionFactor)).toBe(250);
  });

  it("rejects a chosen KPI that already drives another goal (count-once)", async () => {
    const { epicId, kpiIds } = await makeEpic();
    const { goalA, goalB } = await makeGoals();

    await linkEpicToGoal(adminCtx(), {
      epicId,
      objectiveId: goalA,
      kpiId: kpiIds[0]!,
      conversionFactor: 5,
    });
    const result = await linkEpicToGoal(adminCtx(), {
      epicId,
      objectiveId: goalB,
      kpiId: kpiIds[0]!,
      conversionFactor: 5,
    });
    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error.kind).toBe("conflict");
  });

  it("rejects a link with a chosen KPI but no conversion factor (validation)", async () => {
    const { epicId, kpiIds } = await makeEpic();
    const { goalA } = await makeGoals();
    const result = await linkEpicToGoal(adminCtx(), {
      epicId,
      objectiveId: goalA,
      kpiId: kpiIds[0]!,
    });
    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error.kind).toBe("validation");
  });

  it("unlinks a specific (epic, goal) pair", async () => {
    const { epicId, kpiIds } = await makeEpic();
    const { goalA } = await makeGoals();

    await linkEpicToGoal(adminCtx(), {
      epicId,
      objectiveId: goalA,
      kpiId: kpiIds[0]!,
      conversionFactor: 5,
    });
    const result = await unlinkEpicFromGoal(adminCtx(), { epicId, objectiveId: goalA });
    expect(isOk(result)).toBe(true);
    const link = await db.goalEpicLink.findFirst({ where: { tenantId: seed.tenantId, epicId } });
    expect(link).toBeNull();
  });
});
