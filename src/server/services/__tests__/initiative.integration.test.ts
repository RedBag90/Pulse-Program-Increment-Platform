import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/test/setup-db";
import { seedTenant, testRequestContext } from "@/test/fixtures/seed";
import { advanceStageGate } from "@/server/services/initiative";
import { isOk, isErr } from "@/domain/errors";
import { createTestPrismaClient } from "@/server/db/test-client";
import { InitiativeLevel } from "@/domain/types";
import type { EpicId, StageGate } from "@/domain/types";
import { randomUUID } from "crypto";

let seed: Awaited<ReturnType<typeof seedTenant>>;

beforeEach(async () => {
  const testDb = createTestPrismaClient();
  seed = await seedTenant(testDb);
  await testDb.$disconnect();
});

async function makeEpic(stageGate: StageGate = "L0"): Promise<EpicId> {
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
      stageGate,
    },
  });
  await db.initiative.update({ where: { id: epic.id }, data: { path: epic.id } });
  return epic.id as EpicId;
}

describe("advanceStageGate", () => {
  it("advances an Epic one gate forward and emits an AuditEvent", async () => {
    const epicId = await makeEpic("L0");
    const before = await db.auditEvent.count({ where: { tenantId: seed.tenantId } });

    const result = await advanceStageGate(testRequestContext(db, seed), {
      epicId,
      toGate: "L1",
    });

    expect(isOk(result)).toBe(true);
    const epic = await db.initiative.findFirst({ where: { id: epicId } });
    expect(epic!.stageGate).toBe("L1");

    const after = await db.auditEvent.count({ where: { tenantId: seed.tenantId } });
    expect(after).toBe(before + 1);
  });

  it("rejects an invalid gate-skipping transition", async () => {
    const epicId = await makeEpic("L0");

    const result = await advanceStageGate(testRequestContext(db, seed), {
      epicId,
      toGate: "L3",
    });

    expect(isErr(result)).toBe(true);
    if (!isErr(result)) return;
    expect(result.error.kind).toBe("hierarchy_violation");
  });

  it("persists approval metadata when an Epic reaches L3", async () => {
    const epicId = await makeEpic("L2");

    const result = await advanceStageGate(testRequestContext(db, seed), {
      epicId,
      toGate: "L3",
      comment: "Approved by LPM",
    });

    expect(isOk(result)).toBe(true);
    const epic = await db.initiative.findFirst({ where: { id: epicId } });
    expect(epic!.stageGate).toBe("L3");
    expect(epic!.approvedBy).toBe(seed.actorId);
    expect(epic!.approvedAt).not.toBeNull();
    expect(epic!.approvalComment).toBe("Approved by LPM");
  });

  it("returns not_found for an unknown Epic", async () => {
    const result = await advanceStageGate(testRequestContext(db, seed), {
      epicId: randomUUID() as EpicId,
      toGate: "L1",
    });

    expect(isErr(result)).toBe(true);
    if (!isErr(result)) return;
    expect(result.error.kind).toBe("not_found");
  });
});
