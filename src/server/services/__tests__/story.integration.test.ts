import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/test/setup-db";
import { seedTenant, testRequestContext } from "@/test/fixtures/seed";
import { createStory } from "@/server/services/story";
import { createFeature } from "@/server/services/feature";
import { isOk, isErr } from "@/domain/errors";
import { createTestPrismaClient } from "@/server/db/test-client";
import { InitiativeLevel } from "@/domain/types";
import type { EpicId, FeatureId } from "@/domain/types";
import { randomUUID } from "crypto";

let seed: Awaited<ReturnType<typeof seedTenant>>;
let featureId: FeatureId;

beforeEach(async () => {
  const testDb = createTestPrismaClient();
  seed = await seedTenant(testDb);

  const epic = await testDb.initiative.create({
    data: {
      tenantId: seed.tenantId,
      level: InitiativeLevel.EPIC,
      title: "Epic",
      path: "",
      ownerId: seed.actorId,
      assigneeIds: [],
      createdBy: seed.actorId,
      updatedBy: seed.actorId,
    },
  });
  await testDb.initiative.update({ where: { id: epic.id }, data: { path: epic.id } });

  const featureResult = await createFeature(testRequestContext(testDb, seed), {
    parentId: epic.id as EpicId,
    artId: seed.artId,
    title: "Feature",
    wsjfBusinessValue: 5,
    wsjfTimeCriticality: 5,
    wsjfRiskReduction: 5,
    wsjfJobSize: 5,
  });
  if (!isOk(featureResult)) throw new Error("Failed to seed feature");
  featureId = featureResult.value.id;

  await testDb.$disconnect();
});

describe("createStory", () => {
  it("creates a story and emits exactly 2 OutboxEvent rows", async () => {
    const outboxBefore = await db.outboxEvent.count({ where: { tenantId: seed.tenantId } });

    const result = await createStory(testRequestContext(db, seed), {
      parentId: featureId,
      title: "As a user, I can log in",
    });

    expect(isOk(result)).toBe(true);
    const outboxAfter = await db.outboxEvent.count({ where: { tenantId: seed.tenantId } });
    expect(outboxAfter - outboxBefore).toBe(2);

    const events = await db.outboxEvent.findMany({
      where: { tenantId: seed.tenantId },
      orderBy: { createdAt: "asc" },
    });
    const types = events.map((e) => e.type);
    expect(types).toContain("jira.story.created");
    expect(types).toContain("ado.story.created");
  });

  it("returns not_found for unknown parentId", async () => {
    const result = await createStory(testRequestContext(db, seed), {
      parentId: randomUUID() as FeatureId,
      title: "Orphan story",
    });

    expect(isErr(result)).toBe(true);
    if (!isErr(result)) return;
    expect(result.error.kind).toBe("not_found");
  });

  it("emits an AuditEvent row on creation", async () => {
    const auditBefore = await db.auditEvent.count({ where: { tenantId: seed.tenantId } });

    await createStory(testRequestContext(db, seed), {
      parentId: featureId,
      title: "Story with audit",
    });

    const auditAfter = await db.auditEvent.count({ where: { tenantId: seed.tenantId } });
    expect(auditAfter).toBeGreaterThan(auditBefore);
  });
});
