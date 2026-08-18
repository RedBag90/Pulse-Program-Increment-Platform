import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/test/setup-db";
import { seedTenant, testRequestContext } from "@/test/fixtures/seed";
import { revertStageGate } from "@/modules/work/server/services/stage-gate-transition";
import { isOk, isErr } from "@/modules/core/kernel/domain/errors";
import { createTestPrismaClient } from "@/server/db/test-client";
import { InitiativeLevel } from "@/modules/core/kernel/domain/types";
import type { EpicId, StageGate } from "@/modules/core/kernel/domain/types";
import { randomUUID } from "crypto";

let seed: Awaited<ReturnType<typeof seedTenant>>;

beforeEach(async () => {
  const testDb = createTestPrismaClient();
  seed = await seedTenant(testDb);
  await testDb.$disconnect();
});

async function makeEpic(
  stageGate: StageGate = "L0",
  extra: Record<string, unknown> = {},
): Promise<EpicId> {
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
      ...extra,
    },
  });
  await db.initiative.update({ where: { id: epic.id }, data: { path: epic.id } });
  return epic.id as EpicId;
}

/** Erfüllt die L0→L1-Vorbedingung (freigegebene + ausgearbeitete Hypothese). */
const APPROVED_HYPOTHESIS = {
  hypothesisApprovedAt: new Date(),
  benefitHypothesis: { current: { problem: "Testproblem" }, history: [] },
};

describe("revertStageGate — die Rückwärts-Korrektur, die advanceStageGate ersetzt", () => {
  it("stuft ein Epic um einen Reifegrad zurück und schreibt genau eine Audit-Zeile", async () => {
    const epicId = await makeEpic("L2", { selectedForAnalyzingAt: new Date() });
    const before = await db.auditEvent.count({ where: { tenantId: seed.tenantId } });

    const result = await revertStageGate(testRequestContext(db, seed), {
      epicId,
      toGate: "L1",
      reason: "Analyse war verfrüht",
    });

    expect(isOk(result)).toBe(true);
    const epic = await db.initiative.findFirst({ where: { id: epicId } });
    expect(epic!.stageGate).toBe("L1");
    // Der Kern des Refactorings: die Stempel des verlassenen Gates werden
    // abgeräumt, damit ein erneutes Vorrücken wieder stempelt.
    expect(epic!.selectedForAnalyzingAt).toBeNull();

    const after = await db.auditEvent.count({ where: { tenantId: seed.tenantId } });
    expect(after).toBe(before + 1);
  });

  it("räumt bei L3→L2 die vollständige Freigabe-Signatur ab", async () => {
    const epicId = await makeEpic("L3", {
      approvedBy: seed.actorId,
      approvedAt: new Date(),
      approvalComment: "Freigegeben",
    });

    const result = await revertStageGate(testRequestContext(db, seed), {
      epicId,
      toGate: "L2",
      reason: "Investitionsentscheidung zurückgenommen",
    });

    expect(isOk(result)).toBe(true);
    const epic = await db.initiative.findFirst({ where: { id: epicId } });
    expect(epic!.approvedBy).toBeNull();
    expect(epic!.approvedAt).toBeNull();
    expect(epic!.approvalComment).toBeNull();
  });

  it("verlangt eine Begründung", async () => {
    const epicId = await makeEpic("L2");

    const result = await revertStageGate(testRequestContext(db, seed), {
      epicId,
      toGate: "L1",
      reason: "   ",
    });

    expect(isErr(result)).toBe(true);
    if (!isErr(result)) return;
    expect(result.error.kind).toBe("conflict");
    const epic = await db.initiative.findFirst({ where: { id: epicId } });
    expect(epic!.stageGate).toBe("L2");
  });

  it("geht nicht vorwärts — dafür gibt es den Antrag", async () => {
    const epicId = await makeEpic("L1", APPROVED_HYPOTHESIS);

    const result = await revertStageGate(testRequestContext(db, seed), {
      epicId,
      toGate: "L2",
      reason: "Versuch",
    });

    expect(isErr(result)).toBe(true);
    if (!isErr(result)) return;
    expect(result.error.kind).toBe("conflict");
  });

  it("überspringt keinen Reifegrad", async () => {
    const epicId = await makeEpic("L3");

    const result = await revertStageGate(testRequestContext(db, seed), {
      epicId,
      toGate: "L1",
      reason: "zu weit",
    });

    expect(isErr(result)).toBe(true);
    if (!isErr(result)) return;
    expect(result.error.kind).toBe("hierarchy_violation");
  });

  it("returns not_found for an unknown Epic", async () => {
    const result = await revertStageGate(testRequestContext(db, seed), {
      epicId: randomUUID() as EpicId,
      toGate: "L0",
      reason: "x",
    });

    expect(isErr(result)).toBe(true);
    if (!isErr(result)) return;
    expect(result.error.kind).toBe("not_found");
  });

  it("is forbidden when the target operating model disables stage gates", async () => {
    const epicId = await makeEpic("L2");
    await db.targetOperatingModel.create({
      data: {
        tenantId: seed.tenantId,
        status: "active",
        stageGates: false,
        createdBy: seed.actorId,
        updatedBy: seed.actorId,
      },
    });

    const result = await revertStageGate(testRequestContext(db, seed), {
      epicId,
      toGate: "L1",
      reason: "x",
    });

    expect(isErr(result)).toBe(true);
    if (!isErr(result)) return;
    expect(result.error.kind).toBe("forbidden");

    const epic = await db.initiative.findFirst({ where: { id: epicId } });
    expect(epic!.stageGate).toBe("L2");
  });
});
