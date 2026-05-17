import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/test/setup-db";
import { seedTenant, testRequestContext } from "@/test/fixtures/seed";
import { createFeature, updateFeature, scoreFeature } from "@/server/services/feature";
import { isOk, isErr } from "@/domain/errors";
import { createTestPrismaClient } from "@/server/db/test-client";
import { InitiativeLevel } from "@/domain/types";
import type { EpicId, FeatureId, ArtId } from "@/domain/types";
import { randomUUID } from "crypto";

let seed: Awaited<ReturnType<typeof seedTenant>>;
let epicId: EpicId;

beforeEach(async () => {
  const testDb = createTestPrismaClient();
  seed = await seedTenant(testDb);

  const epic = await testDb.initiative.create({
    data: {
      tenantId: seed.tenantId,
      level: InitiativeLevel.EPIC,
      title: "Test Epic",
      path: "",
      ownerId: seed.actorId,
      assigneeIds: [],
      createdBy: seed.actorId,
      updatedBy: seed.actorId,
    },
  });
  epicId = epic.id as EpicId;
  await testDb.initiative.update({
    where: { id: epic.id },
    data: { path: epic.id },
  });

  await testDb.$disconnect();
});

describe("createFeature", () => {
  it("creates a feature with computed WSJF and returns its id", async () => {
    const result = await createFeature(testRequestContext(db, seed), {
      parentId: epicId,
      artId: seed.artId,
      title: "Implement login",
      wsjfBusinessValue: 8,
      wsjfTimeCriticality: 5,
      wsjfRiskReduction: 3,
      wsjfJobSize: 5,
    });

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;

    const feature = await db.initiative.findFirst({ where: { id: result.value.id } });
    expect(feature).not.toBeNull();
    expect(feature!.title).toBe("Implement login");
    expect(feature!.wsjfComputed).not.toBeNull();
  });

  it("returns not_found for unknown epic parentId", async () => {
    const result = await createFeature(testRequestContext(db, seed), {
      parentId: randomUUID() as EpicId,
      artId: seed.artId,
      title: "Orphan feature",
      wsjfBusinessValue: 5,
      wsjfTimeCriticality: 5,
      wsjfRiskReduction: 5,
      wsjfJobSize: 5,
    });

    expect(isErr(result)).toBe(true);
    if (!isErr(result)) return;
    expect(result.error.kind).toBe("not_found");
  });

  it("returns not_found for unknown artId", async () => {
    const result = await createFeature(testRequestContext(db, seed), {
      parentId: epicId,
      artId: randomUUID() as ArtId,
      title: "Feature with bad ART",
      wsjfBusinessValue: 5,
      wsjfTimeCriticality: 5,
      wsjfRiskReduction: 5,
      wsjfJobSize: 5,
    });

    expect(isErr(result)).toBe(true);
    if (!isErr(result)) return;
    expect(result.error.kind).toBe("not_found");
  });

  it("emits an AuditEvent row on creation", async () => {
    const before = await db.auditEvent.count({ where: { tenantId: seed.tenantId } });

    await createFeature(testRequestContext(db, seed), {
      parentId: epicId,
      artId: seed.artId,
      title: "Feature with audit",
      wsjfBusinessValue: 5,
      wsjfTimeCriticality: 5,
      wsjfRiskReduction: 5,
      wsjfJobSize: 5,
    });

    const after = await db.auditEvent.count({ where: { tenantId: seed.tenantId } });
    expect(after).toBe(before + 1);
  });
});

describe("updateFeature", () => {
  async function createTestFeature(): Promise<FeatureId> {
    const result = await createFeature(testRequestContext(db, seed), {
      parentId: epicId,
      artId: seed.artId,
      title: "Original title",
      wsjfBusinessValue: 5,
      wsjfTimeCriticality: 5,
      wsjfRiskReduction: 5,
      wsjfJobSize: 5,
    });
    if (!isOk(result)) throw new Error("Failed to create test feature");
    return result.value.id;
  }

  it("updates the feature title and writes an AuditEvent", async () => {
    const featureId = await createTestFeature();
    const auditsBefore = await db.auditEvent.count({ where: { tenantId: seed.tenantId } });

    const result = await updateFeature(testRequestContext(db, seed), {
      id: featureId,
      title: "Updated title",
    });

    expect(isOk(result)).toBe(true);
    const feature = await db.initiative.findFirst({ where: { id: featureId } });
    expect(feature!.title).toBe("Updated title");

    const auditsAfter = await db.auditEvent.count({ where: { tenantId: seed.tenantId } });
    expect(auditsAfter).toBeGreaterThan(auditsBefore);
  });
});

describe("scoreFeature", () => {
  it("recalculates wsjfComputed after scoring", async () => {
    const result = await createFeature(testRequestContext(db, seed), {
      parentId: epicId,
      artId: seed.artId,
      title: "Feature to score",
      wsjfBusinessValue: 1,
      wsjfTimeCriticality: 1,
      wsjfRiskReduction: 1,
      wsjfJobSize: 1,
    });
    if (!isOk(result)) throw new Error("Failed to create feature");
    const featureId = result.value.id;
    const before = await db.initiative.findFirst({ where: { id: featureId } });

    await scoreFeature(testRequestContext(db, seed), {
      id: featureId,
      wsjfBusinessValue: 13,
      wsjfTimeCriticality: 8,
      wsjfRiskReduction: 5,
      wsjfJobSize: 2,
    });

    const after = await db.initiative.findFirst({ where: { id: featureId } });
    expect(Number(after!.wsjfComputed)).toBeGreaterThan(Number(before!.wsjfComputed));
  });
});
