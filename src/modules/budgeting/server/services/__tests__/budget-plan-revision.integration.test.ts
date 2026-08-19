import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/test/setup-db";
import { seedTenant, testRequestContext } from "@/test/fixtures/seed";
import { createTestPrismaClient } from "@/server/db/test-client";
import { isOk } from "@/modules/core/kernel/domain/errors";
import { InitiativeLevel } from "@/modules/core/kernel/domain/types";
import type { EpicId } from "@/modules/core/kernel/domain/types";
import type { RequestContext } from "@/server/http/mutation-handler";
import {
  captureBudgetPlanRevision,
  getBudgetPlanRevision,
  getLatestBudgetPlanRevision,
  listBudgetPlanRevisionCycles,
  listBudgetPlanRevisions,
} from "@/modules/budgeting/server/services/budget-plan-revision";
import { saveBudgetAllocation } from "@/modules/budgeting/server/services/budgeting";

let seed: Awaited<ReturnType<typeof seedTenant>>;

beforeEach(async () => {
  const testDb = createTestPrismaClient();
  seed = await seedTenant(testDb);
  await testDb.$disconnect();
});

function funderContext(): RequestContext {
  const base = testRequestContext(db, seed);
  return { ...base, principal: { ...base.principal, roles: ["portfolio_manager"] } };
}

/** Pinnt den Zyklus deterministisch — H1 2026. */
const H1_2026 = new Date("2026-03-15T00:00:00.000Z");

async function makeAllocatedEpic(allocations: Record<string, number>): Promise<EpicId> {
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
    },
  });
  await db.initiative.update({ where: { id: epic.id }, data: { path: epic.id } });
  await saveBudgetAllocation(funderContext(), {
    epicId: epic.id as EpicId,
    priority: 1,
    hypothesisBudget: null,
    allocations,
  });
  return epic.id as EpicId;
}

describe("captureBudgetPlanRevision", () => {
  it("friert Zyklus-, Folge- und Epic-Zahlen ein (REQ-R3, REQ-R4)", async () => {
    await makeAllocatedEpic({ "2026-H1": 100_000, "2026-H2": 60_000 });

    const res = await captureBudgetPlanRevision(funderContext(), { now: H1_2026 });
    expect(isOk(res)).toBe(true);

    const latest = await getLatestBudgetPlanRevision(db, seed.tenantId);
    expect(latest?.cycleKey).toBe("2026-H1");
    expect(latest?.epicCount).toBe(1);
    expect(latest?.cycleBudgetSum).toBe(100_000);
    expect(latest?.followBudgetSum).toBe(60_000);
    expect(latest?.snapshot.valueStreams[0]?.total).toBe(160_000);
  });

  /** REQ-R2: idempotent je `(tenant, cycleKey)` — Ueberschreiben, nicht anhaengen. */
  it("ein zweiter Capture im selben Halbjahr ueberschreibt, das Audit haelt beide fest", async () => {
    const epicId = await makeAllocatedEpic({ "2026-H1": 100_000 });
    const ctx = funderContext();

    await captureBudgetPlanRevision(ctx, { now: H1_2026 });
    await saveBudgetAllocation(ctx, {
      epicId,
      priority: 1,
      hypothesisBudget: null,
      allocations: { "2026-H1": 250_000 },
    });
    const captures = await db.auditEvent.count({
      where: { tenantId: seed.tenantId, action: "budget_plan.revision.captured" },
    });
    await captureBudgetPlanRevision(ctx, { now: H1_2026 });

    expect(await db.budgetPlanRevision.count({ where: { tenantId: seed.tenantId } })).toBe(1);
    expect(
      await db.auditEvent.count({
        where: { tenantId: seed.tenantId, action: "budget_plan.revision.captured" },
      }),
    ).toBe(captures + 1);

    const latest = await getLatestBudgetPlanRevision(db, seed.tenantId);
    expect(latest?.cycleBudgetSum).toBe(250_000);
  });

  it("ein Capture im naechsten Halbjahr legt eine ZWEITE Revision an", async () => {
    await makeAllocatedEpic({ "2026-H1": 10, "2026-H2": 20 });
    const ctx = funderContext();

    await captureBudgetPlanRevision(ctx, { now: H1_2026 });
    await captureBudgetPlanRevision(ctx, { now: new Date("2026-09-01T00:00:00.000Z") });

    const cycles = await listBudgetPlanRevisionCycles(db, seed.tenantId);
    expect(cycles.map((c) => c.cycleKey)).toEqual(["2026-H2", "2026-H1"]);
  });
});

describe("Lesewege liefern identische Zahlen (REQ-R4)", () => {
  it("Liste, Detail und Latest stimmen ueberein", async () => {
    await makeAllocatedEpic({ "2026-H1": 100_000, "2027-H1": 40_000 });
    await captureBudgetPlanRevision(funderContext(), { now: H1_2026 });

    const [header] = await listBudgetPlanRevisions(db, seed.tenantId);
    const detail = await getBudgetPlanRevision(db, seed.tenantId, header!.id);
    const latest = await getLatestBudgetPlanRevision(db, seed.tenantId);

    expect(detail?.cycleBudgetSum).toBe(header!.cycleBudgetSum);
    expect(detail?.followBudgetSum).toBe(header!.followBudgetSum);
    expect(latest?.cycleBudgetSum).toBe(header!.cycleBudgetSum);
    expect(latest?.id).toBe(header!.id);
  });

  it("`listBudgetPlanRevisionCycles` liefert Label und Reihenfolge ohne Payload-Zugriff", async () => {
    await makeAllocatedEpic({ "2026-H1": 1 });
    await captureBudgetPlanRevision(funderContext(), { now: H1_2026 });

    const cycles = await listBudgetPlanRevisionCycles(db, seed.tenantId);
    expect(cycles).toHaveLength(1);
    expect(cycles[0]!.cycleLabel).toBe("H1 2026");
  });

  it("eine Revision eines fremden Tenants ist nicht lesbar", async () => {
    await makeAllocatedEpic({ "2026-H1": 1 });
    await captureBudgetPlanRevision(funderContext(), { now: H1_2026 });
    const [header] = await listBudgetPlanRevisions(db, seed.tenantId);

    const testDb = createTestPrismaClient();
    const other = await seedTenant(testDb);
    await testDb.$disconnect();

    expect(await getBudgetPlanRevision(db, other.tenantId, header!.id)).toBeNull();
  });
});

describe("Payload-Envelope (REQ-R6)", () => {
  it("ein unlesbarer Payload WIRFT, statt Nullen zu rendern", async () => {
    await makeAllocatedEpic({ "2026-H1": 1 });
    await captureBudgetPlanRevision(funderContext(), { now: H1_2026 });
    const [header] = await listBudgetPlanRevisions(db, seed.tenantId);

    await db.budgetPlanRevision.update({
      where: { id: header!.id },
      data: { payload: { version: 999, snapshot: {} } },
    });

    await expect(getBudgetPlanRevision(db, seed.tenantId, header!.id)).rejects.toThrow(
      /unsupported snapshot version/,
    );
  });

  it("ein alter 'barer' Snapshot ohne Envelope wird weiterhin akzeptiert", async () => {
    await makeAllocatedEpic({ "2026-H1": 1 });
    await captureBudgetPlanRevision(funderContext(), { now: H1_2026 });
    const [header] = await listBudgetPlanRevisions(db, seed.tenantId);
    const row = await db.budgetPlanRevision.findFirstOrThrow({ where: { id: header!.id } });

    const enveloped = row.payload as { snapshot: unknown };
    await db.budgetPlanRevision.update({
      where: { id: header!.id },
      data: { payload: enveloped.snapshot as never },
    });

    const detail = await getBudgetPlanRevision(db, seed.tenantId, header!.id);
    expect(detail?.cycleKey).toBe("2026-H1");
  });
});
