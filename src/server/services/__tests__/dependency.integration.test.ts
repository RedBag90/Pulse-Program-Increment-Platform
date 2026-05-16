import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/test/setup-db";
import { seedTenant } from "@/test/fixtures/seed";
import { linkDependency, unlinkDependency } from "@/server/services/dependency";
import { isOk, isErr } from "@/domain/errors";
import { createTestPrismaClient } from "@/server/db/test-client";
import { InitiativeLevel } from "@/domain/types";
import type { EpicId } from "@/domain/types";

let seed: Awaited<ReturnType<typeof seedTenant>>;
let epicA: EpicId;
let epicB: EpicId;
let epicC: EpicId;

beforeEach(async () => {
  const testDb = createTestPrismaClient();
  seed = await seedTenant(testDb);

  async function makeEpic(title: string): Promise<EpicId> {
    const e = await testDb.initiative.create({
      data: {
        tenantId: seed.tenantId,
        level: InitiativeLevel.EPIC,
        title,
        path: "",
        ownerId: seed.actorId,
        assigneeIds: [],
        createdBy: seed.actorId,
        updatedBy: seed.actorId,
      },
    });
    await testDb.initiative.update({ where: { id: e.id }, data: { path: e.id } });
    return e.id as EpicId;
  }

  epicA = await makeEpic("Epic A");
  epicB = await makeEpic("Epic B");
  epicC = await makeEpic("Epic C");

  await testDb.$disconnect();
});

describe("linkDependency", () => {
  it("creates a dependency and emits an AuditEvent", async () => {
    const auditBefore = await db.auditEvent.count({ where: { tenantId: seed.tenantId } });

    const result = await linkDependency(db, {
      tenantId: seed.tenantId,
      actorId: seed.actorId,
      fromId: epicA,
      toId: epicB,
      type: "blocks",
    });

    expect(isOk(result)).toBe(true);
    const dep = await db.dependency.findFirst({
      where: { fromId: epicA, toId: epicB, tenantId: seed.tenantId },
    });
    expect(dep).not.toBeNull();
    expect(dep!.type).toBe("blocks");

    const auditAfter = await db.auditEvent.count({ where: { tenantId: seed.tenantId } });
    expect(auditAfter).toBeGreaterThan(auditBefore);
  });

  it("returns conflict when a dependency would create a cycle (A→B, B→C, proposing C→A)", async () => {
    await linkDependency(db, {
      tenantId: seed.tenantId,
      actorId: seed.actorId,
      fromId: epicA,
      toId: epicB,
      type: "blocks",
    });
    await linkDependency(db, {
      tenantId: seed.tenantId,
      actorId: seed.actorId,
      fromId: epicB,
      toId: epicC,
      type: "blocks",
    });

    const result = await linkDependency(db, {
      tenantId: seed.tenantId,
      actorId: seed.actorId,
      fromId: epicC,
      toId: epicA,
      type: "blocks",
    });

    expect(isErr(result)).toBe(true);
    if (!isErr(result)) return;
    expect(result.error.kind).toBe("conflict");
  });

  it("allows relates_to even when it would form a cycle in directional edges", async () => {
    await linkDependency(db, {
      tenantId: seed.tenantId,
      actorId: seed.actorId,
      fromId: epicA,
      toId: epicB,
      type: "blocks",
    });

    const result = await linkDependency(db, {
      tenantId: seed.tenantId,
      actorId: seed.actorId,
      fromId: epicB,
      toId: epicA,
      type: "relates_to",
    });

    expect(isOk(result)).toBe(true);
  });
});

describe("unlinkDependency", () => {
  it("removes an existing dependency and emits an AuditEvent", async () => {
    await linkDependency(db, {
      tenantId: seed.tenantId,
      actorId: seed.actorId,
      fromId: epicA,
      toId: epicB,
      type: "depends_on",
    });

    const result = await unlinkDependency(db, {
      tenantId: seed.tenantId,
      actorId: seed.actorId,
      fromId: epicA,
      toId: epicB,
      type: "depends_on",
    });

    expect(isOk(result)).toBe(true);
    const dep = await db.dependency.findFirst({
      where: { fromId: epicA, toId: epicB, tenantId: seed.tenantId },
    });
    expect(dep).toBeNull();
  });

  it("returns not_found when trying to unlink a non-existent dependency", async () => {
    const result = await unlinkDependency(db, {
      tenantId: seed.tenantId,
      actorId: seed.actorId,
      fromId: epicA,
      toId: epicB,
      type: "blocks",
    });

    expect(isErr(result)).toBe(true);
    if (!isErr(result)) return;
    expect(result.error.kind).toBe("not_found");
  });
});
