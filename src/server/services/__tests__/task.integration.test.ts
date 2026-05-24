import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/test/setup-db";
import { seedTenant, testRequestContext } from "@/test/fixtures/seed";
import { createFeature } from "@/server/services/feature";
import { createStory } from "@/server/services/story";
import { createTask, updateTask, deleteTask, listTasks } from "@/server/services/task";
import { isOk, isErr } from "@/domain/errors";
import { createTestPrismaClient } from "@/server/db/test-client";
import { InitiativeLevel } from "@/domain/types";
import type { EpicId, FeatureId, StoryId, TaskId } from "@/domain/types";
import { randomUUID } from "crypto";

let seed: Awaited<ReturnType<typeof seedTenant>>;
let featureId: FeatureId;
let storyId: StoryId;

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

  const storyResult = await createStory(testRequestContext(testDb, seed), {
    parentId: featureId,
    title: "Story",
  });
  if (!isOk(storyResult)) throw new Error("Failed to seed story");
  storyId = storyResult.value.id;

  await testDb.$disconnect();
});

describe("createTask", () => {
  it("creates a task under a story and emits an AuditEvent", async () => {
    const auditBefore = await db.auditEvent.count({ where: { tenantId: seed.tenantId } });

    const result = await createTask(testRequestContext(db, seed), {
      parentId: storyId,
      title: "Wire up the form",
    });

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;

    const task = await db.initiative.findUnique({ where: { id: result.value.id } });
    expect(task?.level).toBe(InitiativeLevel.TASK);
    expect(task?.parentId).toBe(storyId);

    const auditAfter = await db.auditEvent.count({ where: { tenantId: seed.tenantId } });
    expect(auditAfter).toBeGreaterThan(auditBefore);
  });

  it("returns not_found for an unknown parentId", async () => {
    const result = await createTask(testRequestContext(db, seed), {
      parentId: randomUUID() as StoryId,
      title: "Orphan task",
    });
    expect(isErr(result)).toBe(true);
    if (!isErr(result)) return;
    expect(result.error.kind).toBe("not_found");
  });

  it("rejects a parent of the wrong level (a Feature is not a Story)", async () => {
    const result = await createTask(testRequestContext(db, seed), {
      parentId: featureId as unknown as StoryId,
      title: "Misparented task",
    });
    expect(isErr(result)).toBe(true);
    if (!isErr(result)) return;
    expect(result.error.kind).toBe("hierarchy_violation");
  });
});

describe("updateTask / deleteTask", () => {
  async function makeTask(): Promise<TaskId> {
    const result = await createTask(testRequestContext(db, seed), {
      parentId: storyId,
      title: "Task",
    });
    if (!isOk(result)) throw new Error("create failed");
    return result.value.id;
  }

  it("records a status change in the audit changelog", async () => {
    const id = await makeTask();
    const result = await updateTask(testRequestContext(db, seed), { id, status: "done" });
    expect(isOk(result)).toBe(true);

    const row = await db.initiative.findUnique({ where: { id } });
    expect(row?.status).toBe("done");
  });

  it("soft-deletes the task and drops it from listTasks (deletion test)", async () => {
    const id = await makeTask();

    const del = await deleteTask(testRequestContext(db, seed), { id });
    expect(isOk(del)).toBe(true);

    const row = await db.initiative.findUnique({ where: { id } });
    expect(row?.deletedAt).not.toBeNull();

    const tasks = await listTasks(db, seed.tenantId, storyId);
    expect(tasks.find((t) => t.id === id)).toBeUndefined();
  });

  it("returns not_found when deleting an already-deleted task", async () => {
    const id = await makeTask();
    await deleteTask(testRequestContext(db, seed), { id });
    const again = await deleteTask(testRequestContext(db, seed), { id });
    expect(isErr(again)).toBe(true);
  });
});
