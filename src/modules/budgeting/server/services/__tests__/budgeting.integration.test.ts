import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/test/setup-db";
import { seedTenant } from "@/test/fixtures/seed";
import { createTestPrismaClient } from "@/server/db/test-client";
import { InitiativeLevel } from "@/modules/core/kernel/domain/types";
import type { EpicId, TenantId } from "@/modules/core/kernel/domain/types";
import {
  getBudgetingBoard,
  getValueStreamBudgets,
  getValueStreamBudgetTotals,
} from "@/modules/budgeting/server/services/budgeting";
import { randomUUID } from "crypto";

let seed: Awaited<ReturnType<typeof seedTenant>>;

beforeEach(async () => {
  const testDb = createTestPrismaClient();
  seed = await seedTenant(testDb);
  await testDb.$disconnect();
});

async function makeEpic(extra: Record<string, unknown> = {}): Promise<EpicId> {
  const epic = await db.initiative.create({
    data: {
      tenantId: seed.tenantId,
      level: InitiativeLevel.EPIC,
      title: "Epic",
      path: "",
      ownerId: seed.actorId,
      assigneeIds: [],
      createdBy: seed.actorId,
      updatedBy: seed.actorId,
      valueStreamId: seed.valueStreamId,
      stagedForBudgeting: true,
      hypothesisApprovedAt: new Date(),
      ...extra,
    },
  });
  await db.initiative.update({ where: { id: epic.id }, data: { path: epic.id } });
  return epic.id as EpicId;
}

/**
 * Zuteilungen entstehen nur noch aus der Kachel-Finalisierung
 * (`finalize-service`). Für diese Fixtures wird die Zeile direkt geschrieben —
 * derselbe Effekt, ohne den Umweg über eine ganze Runde.
 */
async function allocate(epicId: EpicId, allocations: Record<string, number>, priority = 1) {
  await db.budgetAllocation.upsert({
    where: { epicId },
    update: { allocations, priority, updatedBy: seed.actorId },
    create: {
      tenantId: seed.tenantId,
      epicId,
      priority,
      allocations,
      createdBy: seed.actorId,
      updatedBy: seed.actorId,
    },
  });
}

describe("getBudgetingBoard — die Kandidatenmenge (REQ-B1)", () => {
  it("zeigt ein vorgemerktes Epic mit freigegebener Hypothese", async () => {
    await makeEpic();
    const board = await getBudgetingBoard(db, seed.tenantId);
    expect(board.epics).toHaveLength(1);
    expect(board.epics[0]!.isHypothesisOnly).toBe(true);
  });

  it("blendet ein Epic ohne `stagedForBudgeting` aus", async () => {
    await makeEpic({ stagedForBudgeting: false });
    expect((await getBudgetingBoard(db, seed.tenantId)).epics).toHaveLength(0);
  });

  it("blendet ein vorgemerktes Epic ohne jede Freigabe aus", async () => {
    await makeEpic({ hypothesisApprovedAt: null });
    expect((await getBudgetingBoard(db, seed.tenantId)).epics).toHaveLength(0);
  });

  it("ein freigegebener Business Case genuegt auch ohne Hypothesen-Freigabe", async () => {
    await makeEpic({ hypothesisApprovedAt: null, businessCaseApprovedAt: new Date() });
    const board = await getBudgetingBoard(db, seed.tenantId);
    expect(board.epics).toHaveLength(1);
    expect(board.epics[0]!.isHypothesisOnly).toBe(false);
  });

  it("blendet ein geloeschtes Epic aus", async () => {
    await makeEpic({ deletedAt: new Date() });
    expect((await getBudgetingBoard(db, seed.tenantId)).epics).toHaveLength(0);
  });

  it("sieht keine Epics eines fremden Tenants", async () => {
    await makeEpic();
    expect((await getBudgetingBoard(db, randomUUID() as TenantId)).epics).toHaveLength(0);
  });
});

describe("Wertstrom-Budgets sind abgeleitet (REQ-V1)", () => {
  it("rollt die Epic-Zuteilungen je Wertstrom auf", async () => {
    const a = await makeEpic();
    const b = await makeEpic();
    await allocate(a, { "2026-H1": 100 }, 1);
    await allocate(b, { "2026-H1": 50, "2026-H2": 25 }, 2);

    const { valueStreams } = await getValueStreamBudgets(db, seed.tenantId);
    expect(valueStreams).toHaveLength(1);
    expect(valueStreams[0]!.byPeriod).toEqual({ "2026-H1": 150, "2026-H2": 25 });
    expect(valueStreams[0]!.total).toBe(175);
  });

  it("`getValueStreamBudgetTotals` liefert dieselbe Summe als schmale Map", async () => {
    const epicId = await makeEpic();
    await allocate(epicId, { "2026-H1": 700 });

    expect(await getValueStreamBudgetTotals(db, seed.tenantId)).toEqual({
      [seed.valueStreamId]: 700,
    });
  });

  it("ein Epic ohne Wertstrom faellt aus der Wertstrom-Sicht heraus (REQ-V2)", async () => {
    const epicId = await makeEpic({ valueStreamId: null });
    await allocate(epicId, { "2026-H1": 999 });

    expect((await getValueStreamBudgets(db, seed.tenantId)).valueStreams).toHaveLength(0);
  });
});
