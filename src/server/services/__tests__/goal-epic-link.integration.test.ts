import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/test/setup-db";
import { seedTenant } from "@/test/fixtures/seed";
import { createTestPrismaClient } from "@/server/db/test-client";
import { linkEpicToGoal, unlinkEpicFromGoal } from "@/server/services/goal-epic-link";
import { setKpiBinding } from "@/server/services/kpi-binding";
import { InitiativeLevel } from "@/domain/types";
import { ROLES } from "@/domain/roles";
import type { RequestContext } from "@/server/http/mutation-handler";
import { isOk, isErr } from "@/domain/errors";
import { MODULE_KEYS } from "@/domain/modules";

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
      isPlatformAdmin: false,
      enabledModules: MODULE_KEYS,
    },
  };
}

async function makeEpicWithKpi(): Promise<{ epicId: string; kpiId: string }> {
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
  const kpi = await db.kpi.create({
    data: {
      tenantId: seed.tenantId,
      initiativeId: epic.id,
      name: "Durchlaufzeit",
      baseline: 0,
      target: 100,
      measurements: [],
      valuePerUnit: 10,
      createdBy: seed.actorId,
      updatedBy: seed.actorId,
    },
  });
  return { epicId: epic.id, kpiId: kpi.id };
}

async function makeObjectiveWithKr(): Promise<{ objectiveId: string; keyResultId: string }> {
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
  const objective = await db.objective.create({
    data: {
      tenantId: seed.tenantId,
      themeId: theme.id,
      title: "Objective",
      createdBy: seed.actorId,
      updatedBy: seed.actorId,
    },
  });
  // Ein Key Result ist ein Goal-Knoten (nodeKind="key_result") unter dem Objective.
  const kr = await db.objective.create({
    data: {
      tenantId: seed.tenantId,
      themeId: theme.id,
      parentObjectiveId: objective.id,
      nodeKind: "key_result",
      level: 1,
      title: "Key Result",
      createdBy: seed.actorId,
      updatedBy: seed.actorId,
    },
  });
  return { objectiveId: objective.id, keyResultId: kr.id };
}

describe("linkEpicToGoal", () => {
  it("links an epic to a key result and writes the row + audit", async () => {
    const { epicId } = await makeEpicWithKpi();
    const { keyResultId } = await makeObjectiveWithKr();

    const before = await db.auditEvent.count({ where: { tenantId: seed.tenantId } });
    const result = await linkEpicToGoal(adminCtx(), { epicId, keyResultId });

    expect(isOk(result)).toBe(true);
    const link = await db.goalEpicLink.findFirst({ where: { tenantId: seed.tenantId, epicId } });
    // Ein KR ist ein Goal-Knoten; der Link speichert dessen id als objectiveId.
    expect(link?.objectiveId).toBe(keyResultId);
    const after = await db.auditEvent.count({ where: { tenantId: seed.tenantId } });
    expect(after).toBe(before + 1);
  });

  it("links an epic to an objective", async () => {
    const { epicId } = await makeEpicWithKpi();
    const { objectiveId } = await makeObjectiveWithKr();

    const result = await linkEpicToGoal(adminCtx(), { epicId, objectiveId });
    expect(isOk(result)).toBe(true);
    const link = await db.goalEpicLink.findFirst({ where: { tenantId: seed.tenantId, epicId } });
    expect(link?.objectiveId).toBe(objectiveId);
  });

  it("rebinds an epic to a different goal (unique epicId holds — only one row)", async () => {
    const { epicId } = await makeEpicWithKpi();
    const { objectiveId, keyResultId } = await makeObjectiveWithKr();

    await linkEpicToGoal(adminCtx(), { epicId, objectiveId });
    const result = await linkEpicToGoal(adminCtx(), { epicId, keyResultId });
    expect(isOk(result)).toBe(true);
    const links = await db.goalEpicLink.findMany({ where: { tenantId: seed.tenantId, epicId } });
    expect(links).toHaveLength(1);
    expect(links[0]!.objectiveId).toBe(keyResultId);
  });

  it("rejects linking when the epic's KPI is already individually KR-bound (count-once)", async () => {
    const { epicId, kpiId } = await makeEpicWithKpi();
    const { keyResultId } = await makeObjectiveWithKr();

    const bound = await setKpiBinding(adminCtx(), { kpiId, keyResultId });
    expect(isOk(bound)).toBe(true);

    const result = await linkEpicToGoal(adminCtx(), { epicId, keyResultId });
    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error.kind).toBe("conflict");
  });

  it("rejects binding a KPI whose epic is already linked (symmetric count-once)", async () => {
    const { epicId, kpiId } = await makeEpicWithKpi();
    const { keyResultId } = await makeObjectiveWithKr();

    await linkEpicToGoal(adminCtx(), { epicId, keyResultId });
    const bound = await setKpiBinding(adminCtx(), { kpiId, keyResultId });
    expect(isErr(bound)).toBe(true);
    if (isErr(bound)) expect(bound.error.kind).toBe("conflict");
  });

  it("unlinks an epic (row removed)", async () => {
    const { epicId } = await makeEpicWithKpi();
    const { keyResultId } = await makeObjectiveWithKr();

    await linkEpicToGoal(adminCtx(), { epicId, keyResultId });
    const result = await unlinkEpicFromGoal(adminCtx(), { epicId });
    expect(isOk(result)).toBe(true);
    const link = await db.goalEpicLink.findFirst({ where: { tenantId: seed.tenantId, epicId } });
    expect(link).toBeNull();
  });
});
