import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/test/setup-db";
import { seedTenant, testRequestContext } from "@/test/fixtures/seed";
import { createTestPrismaClient } from "@/server/db/test-client";
import { isOk, isErr } from "@/modules/core/kernel/domain/errors";
import { InitiativeLevel } from "@/modules/core/kernel/domain/types";
import type { EpicId, TenantId } from "@/modules/core/kernel/domain/types";
import type { RequestContext } from "@/server/http/mutation-handler";
import {
  getBudgetingBoard,
  getValueStreamBudgets,
  getValueStreamBudgetTotals,
  saveBudgetAllocation,
  saveBudgetPool,
} from "@/modules/budgeting/server/services/budgeting";
import { randomUUID } from "crypto";

let seed: Awaited<ReturnType<typeof seedTenant>>;

beforeEach(async () => {
  const testDb = createTestPrismaClient();
  seed = await seedTenant(testDb);
  await testDb.$disconnect();
});

/** Ein Portfolio-Manager — die Rolle, die `budget.manage` traegt. */
function funderContext(): RequestContext {
  const base = testRequestContext(db, seed);
  return { ...base, principal: { ...base.principal, roles: ["portfolio_manager"] } };
}

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

describe("saveBudgetAllocation", () => {
  it("legt die Zuteilung an und schreibt genau eine Audit-Zeile", async () => {
    const epicId = await makeEpic();
    const before = await db.auditEvent.count({ where: { tenantId: seed.tenantId } });

    const res = await saveBudgetAllocation(funderContext(), {
      epicId,
      priority: 3,
      hypothesisBudget: 50_000,
      allocations: { "2026-H1": 80_000, "2026-H2": 40_000 },
    });

    expect(isOk(res)).toBe(true);
    const row = await db.budgetAllocation.findUnique({ where: { epicId } });
    expect(row?.priority).toBe(3);
    expect(row?.allocations).toEqual({ "2026-H1": 80_000, "2026-H2": 40_000 });
    expect(await db.auditEvent.count({ where: { tenantId: seed.tenantId } })).toBe(before + 1);
  });

  it("ist ein Upsert — ein zweiter Aufruf ersetzt die Zuteilung", async () => {
    const epicId = await makeEpic();
    const ctx = funderContext();
    await saveBudgetAllocation(ctx, {
      epicId,
      priority: 1,
      hypothesisBudget: null,
      allocations: { "2026-H1": 10 },
    });
    await saveBudgetAllocation(ctx, {
      epicId,
      priority: 2,
      hypothesisBudget: null,
      allocations: { "2026-H2": 20 },
    });

    expect(await db.budgetAllocation.count({ where: { epicId } })).toBe(1);
    const row = await db.budgetAllocation.findUnique({ where: { epicId } });
    expect(row?.priority).toBe(2);
    expect(row?.allocations).toEqual({ "2026-H2": 20 });
  });

  it("weist einen Principal ohne `budget.manage` ab (ADR-0002, Befund F-04)", async () => {
    const epicId = await makeEpic();
    const res = await saveBudgetAllocation(testRequestContext(db, seed), {
      epicId,
      priority: 1,
      hypothesisBudget: null,
      allocations: { "2026-H1": 10 },
    });

    expect(isErr(res)).toBe(true);
    expect(await db.budgetAllocation.count({ where: { epicId } })).toBe(0);
  });

  it("weist eine Epic-Id aus einem fremden Tenant ab, statt blind zu upserten", async () => {
    const testDb = createTestPrismaClient();
    const other = await seedTenant(testDb);
    await testDb.$disconnect();
    const foreignEpic = await db.initiative.create({
      data: {
        tenantId: other.tenantId,
        level: InitiativeLevel.EPIC,
        title: "Fremdes Epic",
        path: "",
        assigneeIds: [],
        createdBy: other.actorId,
        updatedBy: other.actorId,
      },
    });

    const res = await saveBudgetAllocation(funderContext(), {
      epicId: foreignEpic.id as EpicId,
      priority: 1,
      hypothesisBudget: null,
      allocations: { "2026-H1": 10 },
    });

    expect(isErr(res)).toBe(true);
    expect(await db.budgetAllocation.count({ where: { epicId: foreignEpic.id } })).toBe(0);
  });

  /**
   * Der P6-Vertrag aus der Modul-Migrations-Roadmap: Budgeting schreibt keine
   * Work-Spalte mehr — das Epic-Soll-Fenster folgt allein dem Reifegrad-Plan
   * des Owners (`saveTimeline` → L4.1/L4.2).
   */
  it("laesst die Epic-Zeile vollstaendig unberuehrt (Budgeting schreibt nie in Work)", async () => {
    const epicId = await makeEpic();
    const before = await db.initiative.findFirst({ where: { id: epicId } });

    await saveBudgetAllocation(funderContext(), {
      epicId,
      priority: 1,
      hypothesisBudget: null,
      allocations: { "2026-H1": 120_000, "2026-H2": 60_000 },
    });

    expect(await db.initiative.findFirst({ where: { id: epicId } })).toEqual(before);
  });
});

describe("saveBudgetPool", () => {
  it("schreibt den Topf auf den Tenant und auditiert ihn", async () => {
    const before = await db.auditEvent.count({ where: { tenantId: seed.tenantId } });

    const res = await saveBudgetPool(funderContext(), {
      byPeriod: { "2026-H1": 2_000_000, "2026-H2": 2_400_000 },
    });

    expect(isOk(res)).toBe(true);
    const tenant = await db.tenant.findUnique({ where: { id: seed.tenantId } });
    expect(tenant?.budgetPoolByPeriod).toEqual({ "2026-H1": 2_000_000, "2026-H2": 2_400_000 });
    expect(await db.auditEvent.count({ where: { tenantId: seed.tenantId } })).toBe(before + 1);
  });
});

describe("Wertstrom-Budgets sind abgeleitet (REQ-V1)", () => {
  it("rollt die Epic-Zuteilungen je Wertstrom auf", async () => {
    const a = await makeEpic();
    const b = await makeEpic();
    const ctx = funderContext();
    await saveBudgetAllocation(ctx, {
      epicId: a,
      priority: 1,
      hypothesisBudget: null,
      allocations: { "2026-H1": 100 },
    });
    await saveBudgetAllocation(ctx, {
      epicId: b,
      priority: 2,
      hypothesisBudget: null,
      allocations: { "2026-H1": 50, "2026-H2": 25 },
    });

    const { valueStreams } = await getValueStreamBudgets(db, seed.tenantId);
    expect(valueStreams).toHaveLength(1);
    expect(valueStreams[0]!.byPeriod).toEqual({ "2026-H1": 150, "2026-H2": 25 });
    expect(valueStreams[0]!.total).toBe(175);
  });

  it("`getValueStreamBudgetTotals` liefert dieselbe Summe als schmale Map", async () => {
    const epicId = await makeEpic();
    await saveBudgetAllocation(funderContext(), {
      epicId,
      priority: 1,
      hypothesisBudget: null,
      allocations: { "2026-H1": 700 },
    });

    expect(await getValueStreamBudgetTotals(db, seed.tenantId)).toEqual({
      [seed.valueStreamId]: 700,
    });
  });

  it("ein Epic ohne Wertstrom faellt aus der Wertstrom-Sicht heraus (REQ-V2)", async () => {
    const epicId = await makeEpic({ valueStreamId: null });
    await saveBudgetAllocation(funderContext(), {
      epicId,
      priority: 1,
      hypothesisBudget: null,
      allocations: { "2026-H1": 999 },
    });

    expect((await getValueStreamBudgets(db, seed.tenantId)).valueStreams).toHaveLength(0);
  });
});
