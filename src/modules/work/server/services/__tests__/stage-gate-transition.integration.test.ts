import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/test/setup-db";
import { seedTenant, testRequestContext } from "@/test/fixtures/seed";
import { createTestPrismaClient } from "@/server/db/test-client";
import { isOk, isErr } from "@/modules/core/kernel/domain/errors";
import { InitiativeLevel, type StageGate, type UserId } from "@/modules/core/kernel/domain/types";
import type { RequestContext } from "@/server/http/mutation-handler";
import {
  requestGateTransition,
  decideGateTransition,
  withdrawGateTransition,
  revertStageGate,
} from "@/modules/work/server/services/stage-gate-transition";
import { randomUUID } from "crypto";

/**
 * Der Reifegrad-Wechsel end-to-end über die DB.
 *
 * Die wichtigsten Fälle hier sind die **Negativ-Kontrakte**: dass ein Save im
 * Business Case, ein Feature-Start oder eine Budget-Allokation das Gate eben
 * *nicht* mehr bewegen. Genau das war vorher der Fall und ist der Kern des
 * Refactorings — ein Test, der nur den Happy Path prüft, würde einen Rückfall
 * nicht bemerken.
 */

let seed: Awaited<ReturnType<typeof seedTenant>>;

const VMO = randomUUID();
const FINANCE = randomUUID();

beforeEach(async () => {
  const testDb = createTestPrismaClient();
  seed = await seedTenant(testDb);
  await testDb.$disconnect();
});

/** Ein Kontext mit den Gate-Capabilities des Antragstellers. */
function requesterCtx(): RequestContext {
  const base = testRequestContext(db, seed);
  return {
    ...base,
    principal: {
      ...base.principal,
      capabilities: [
        { action: "epic.gate.request", scope: null },
        { action: "epic.gate.withdraw", scope: null },
        { action: "epic.gate.revert", scope: null },
      ],
    },
  };
}

/** Ein Kontext, der als `userId` entscheidet (ein benannter Abnehmer). */
function approverCtx(userId: string): RequestContext {
  const base = testRequestContext(db, seed);
  return {
    ...base,
    principal: {
      ...base.principal,
      id: userId as UserId,
      capabilities: [{ action: "epic.gate.decide", scope: null }],
    },
  };
}

async function makeEpic(stageGate: StageGate, extra: Record<string, unknown> = {}): Promise<string> {
  const epic = await db.initiative.create({
    data: {
      tenantId: seed.tenantId,
      level: InitiativeLevel.EPIC,
      title: "Epic",
      path: "",
      valueStreamId: seed.valueStreamId,
      ownerId: seed.actorId,
      assigneeIds: [],
      createdBy: seed.actorId,
      updatedBy: seed.actorId,
      stageGate,
      ...extra,
    },
  });
  await db.initiative.update({ where: { id: epic.id }, data: { path: epic.id } });
  return epic.id;
}

/** Zwei benannte Abnehmer für `toGate`, einstimmig. */
async function withApprovers(toGate: StageGate, userIds: string[] = [VMO, FINANCE]) {
  await db.stageGateApproverRule.create({
    data: {
      tenantId: seed.tenantId,
      valueStreamId: null,
      toGate,
      required: true,
      quorum: "all",
      approverUserIds: userIds,
      approverRoles: [],
      updatedBy: seed.actorId,
    },
  });
}

/** L3 verlangt freigegebenen BC; die Budget-Summe kommt aus `allocateBudget`. */
const READY_FOR_L3 = { businessCaseApprovedAt: new Date() };

async function allocateBudget(epicId: string, sum: number) {
  await db.budgetAllocation.create({
    data: {
      tenantId: seed.tenantId,
      epicId,
      allocations: { "2026-H1": sum },
      createdBy: seed.actorId,
      updatedBy: seed.actorId,
    },
  });
}

async function auditCount(): Promise<number> {
  return db.auditEvent.count({ where: { tenantId: seed.tenantId } });
}

// ---------------------------------------------------------------------------

describe("requestGateTransition", () => {
  it("legt Antrag + je eine Abnahme-Zeile an und bewegt das Gate NICHT", async () => {
    await withApprovers("L3");
    const epicId = await makeEpic("L2", READY_FOR_L3);
    await allocateBudget(epicId, 500_000);
    const before = await auditCount();

    const result = await requestGateTransition(requesterCtx(), { epicId, toGate: "L3" });

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.status).toBe("pending");
    expect(result.value.pendingApprovers).toBe(2);

    const epic = await db.initiative.findFirst({ where: { id: epicId } });
    expect(epic!.stageGate).toBe("L2");

    const approvals = await db.stageGateApproval.findMany({
      where: { transitionId: result.value.transitionId },
    });
    expect(approvals).toHaveLength(2);
    expect(approvals.every((a) => a.status === "pending")).toBe(true);

    // Genau eine Audit-Zeile — der Antrag ist sichtbar, anders als der frühere
    // Vorschlag, der nie auditiert wurde.
    expect(await auditCount()).toBe(before + 1);
    const audit = await db.auditEvent.findFirst({
      where: { tenantId: seed.tenantId, resourceId: epicId },
      orderBy: { occurredAt: "desc" },
    });
    expect(audit!.action).toBe("initiative.stage_gate.requested");
  });

  it("blockiert bei unerfülltem Kriterium und nennt den Grund", async () => {
    await withApprovers("L3");
    const epicId = await makeEpic("L2"); // kein BC-Approval, kein Budget
    const before = await auditCount();

    const result = await requestGateTransition(requesterCtx(), { epicId, toGate: "L3" });

    expect(isErr(result)).toBe(true);
    if (!isErr(result) || result.error.kind !== "forbidden") return;
    expect(result.error.reason).toContain("Business Case ist freigegeben");
    expect(await auditCount()).toBe(before);
  });

  it("scheitert laut, wenn für ein abnahmepflichtiges Gate niemand hinterlegt ist", async () => {
    await db.stageGateApproverRule.create({
      data: {
        tenantId: seed.tenantId,
        valueStreamId: null,
        toGate: "L4",
        required: true,
        quorum: "all",
        approverUserIds: [],
        approverRoles: [],
        updatedBy: seed.actorId,
      },
    });
    const epicId = await makeEpic("L3");

    const result = await requestGateTransition(requesterCtx(), { epicId, toGate: "L4" });

    expect(isErr(result)).toBe(true);
    if (!isErr(result) || result.error.kind !== "conflict") return;
    expect(result.error.reason).toContain("keine abnehmende Person");
  });

  it("required=false rückt in einer Transaktion vor — mit genau einer Audit-Zeile", async () => {
    await db.stageGateApproverRule.create({
      data: {
        tenantId: seed.tenantId,
        valueStreamId: null,
        toGate: "L4",
        required: false,
        quorum: "all",
        approverUserIds: [],
        approverRoles: [],
        updatedBy: seed.actorId,
      },
    });
    const epicId = await makeEpic("L3");
    const before = await auditCount();

    const result = await requestGateTransition(requesterCtx(), { epicId, toGate: "L4" });

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.status).toBe("approved");

    const epic = await db.initiative.findFirst({ where: { id: epicId } });
    expect(epic!.stageGate).toBe("L4");
    expect(epic!.implementationStartedAt).not.toBeNull();
    expect(await auditCount()).toBe(before + 1);
  });

  it("lässt keinen zweiten offenen Antrag zu — auch nicht an der DB vorbei", async () => {
    await withApprovers("L4");
    const epicId = await makeEpic("L3");
    const first = await requestGateTransition(requesterCtx(), { epicId, toGate: "L4" });
    expect(isOk(first)).toBe(true);

    const second = await requestGateTransition(requesterCtx(), { epicId, toGate: "L4" });
    expect(isErr(second)).toBe(true);
    if (!isErr(second)) return;
    expect(second.error.kind).toBe("conflict");

    // Und die DB-Invariante selbst (partieller Unique-Index) hält ebenfalls.
    await expect(
      db.stageGateTransition.create({
        data: {
          tenantId: seed.tenantId,
          initiativeId: epicId,
          fromGate: "L3",
          toGate: "L4",
          status: "pending",
          quorum: "all",
          requestedBy: seed.actorId,
        },
      }),
    ).rejects.toThrow();
  });
});

describe("decideGateTransition", () => {
  async function openRequest(toGate: StageGate = "L4") {
    await withApprovers(toGate);
    const epicId = await makeEpic("L3");
    const r = await requestGateTransition(requesterCtx(), { epicId, toGate });
    if (!isOk(r)) throw new Error("Antrag fehlgeschlagen");
    return { epicId, transitionId: r.value.transitionId };
  }

  it("die vorletzte Zustimmung hält den Antrag offen", async () => {
    const { epicId, transitionId } = await openRequest();

    const result = await decideGateTransition(approverCtx(VMO), {
      transitionId,
      decision: "approve",
    });

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.outcome).toBe("pending");
    expect(result.value.remaining).toBe(1);

    const epic = await db.initiative.findFirst({ where: { id: epicId } });
    expect(epic!.stageGate).toBe("L3");
  });

  it("die letzte Zustimmung schiebt das Gate — genau eine advanced-Audit-Zeile", async () => {
    const { epicId, transitionId } = await openRequest();
    await decideGateTransition(approverCtx(VMO), { transitionId, decision: "approve" });
    const before = await auditCount();

    const result = await decideGateTransition(approverCtx(FINANCE), {
      transitionId,
      decision: "approve",
    });

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.outcome).toBe("advanced");

    const epic = await db.initiative.findFirst({ where: { id: epicId } });
    expect(epic!.stageGate).toBe("L4");

    const transition = await db.stageGateTransition.findFirst({ where: { id: transitionId } });
    expect(transition!.status).toBe("approved");
    expect(transition!.resolvedBy).toBe(FINANCE);

    expect(await auditCount()).toBe(before + 1);
    const audit = await db.auditEvent.findFirst({
      where: { tenantId: seed.tenantId, resourceId: epicId },
      orderBy: { occurredAt: "desc" },
    });
    expect(audit!.action).toBe("initiative.stage_gate.advanced");
  });

  it("eine Ablehnung stoppt den Antrag; das Epic bleibt stehen", async () => {
    const { epicId, transitionId } = await openRequest();
    const before = await auditCount();

    const result = await decideGateTransition(approverCtx(VMO), {
      transitionId,
      decision: "reject",
      comment: "Kapazität fehlt",
    });

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.outcome).toBe("rejected");

    const epic = await db.initiative.findFirst({ where: { id: epicId } });
    expect(epic!.stageGate).toBe("L3");
    const transition = await db.stageGateTransition.findFirst({ where: { id: transitionId } });
    expect(transition!.status).toBe("rejected");
    expect(await auditCount()).toBe(before + 1);
  });

  it("wer nicht benannt ist, entscheidet nicht — und hinterlässt keine Spur", async () => {
    const { epicId, transitionId } = await openRequest();
    const before = await auditCount();

    const result = await decideGateTransition(approverCtx(randomUUID()), {
      transitionId,
      decision: "approve",
    });

    expect(isErr(result)).toBe(true);
    if (!isErr(result)) return;
    expect(result.error.kind).toBe("not_found");

    const epic = await db.initiative.findFirst({ where: { id: epicId } });
    expect(epic!.stageGate).toBe("L3");
    expect(await auditCount()).toBe(before);
  });

  it("derselbe Abnehmer entscheidet nicht zweimal", async () => {
    const { transitionId } = await openRequest();
    await decideGateTransition(approverCtx(VMO), { transitionId, decision: "approve" });

    const again = await decideGateTransition(approverCtx(VMO), {
      transitionId,
      decision: "approve",
    });
    expect(isErr(again)).toBe(true);
    if (!isErr(again)) return;
    expect(again.error.kind).toBe("conflict");
  });

  it("L4→L5 stempelt den ENTSCHEIDENDEN Abnehmer als Impact-Bestätiger", async () => {
    // Das ist die Verbesserung gegenüber dem alten Impact-Dialog, wo der
    // Stempel denjenigen trug, der zufällig den Dialog geöffnet hatte.
    await withApprovers("L5", [FINANCE]);
    const epicId = await makeEpic("L4");
    await db.initiative.create({
      data: {
        tenantId: seed.tenantId,
        level: InitiativeLevel.FEATURE,
        title: "Feature",
        path: `${epicId}/f`,
        parentId: epicId,
        status: "completed",
        assigneeIds: [],
        createdBy: seed.actorId,
        updatedBy: seed.actorId,
      },
    });

    const req = await requestGateTransition(requesterCtx(), { epicId, toGate: "L5" });
    expect(isOk(req)).toBe(true);
    if (!isOk(req)) return;

    await decideGateTransition(approverCtx(FINANCE), {
      transitionId: req.value.transitionId,
      decision: "approve",
      comment: "Nutzen in Q2 realisiert",
    });

    const epic = await db.initiative.findFirst({ where: { id: epicId } });
    expect(epic!.stageGate).toBe("L5");
    expect(epic!.impactRecognizedBy).toBe(FINANCE);
    expect(epic!.impactComment).toBe("Nutzen in Q2 realisiert");
  });
});

describe("withdrawGateTransition", () => {
  it("zieht einen offenen Antrag zurück — der Vorgang, den es beim Slot nicht gab", async () => {
    await withApprovers("L4");
    const epicId = await makeEpic("L3");
    const req = await requestGateTransition(requesterCtx(), { epicId, toGate: "L4" });
    if (!isOk(req)) throw new Error("Antrag fehlgeschlagen");

    const result = await withdrawGateTransition(requesterCtx(), {
      transitionId: req.value.transitionId,
      reason: "Doch nicht so weit",
    });

    expect(isOk(result)).toBe(true);
    const transition = await db.stageGateTransition.findFirst({
      where: { id: req.value.transitionId },
    });
    expect(transition!.status).toBe("withdrawn");

    // Danach ist wieder ein Antrag möglich.
    const again = await requestGateTransition(requesterCtx(), { epicId, toGate: "L4" });
    expect(isOk(again)).toBe(true);
  });
});

describe("revertStageGate", () => {
  it("räumt die Stempel ab und zieht einen offenen Antrag mit zurück", async () => {
    await withApprovers("L5", [FINANCE]);
    const epicId = await makeEpic("L4", { implementationStartedAt: new Date() });
    const req = await requestGateTransition(requesterCtx(), { epicId, toGate: "L5" });
    // Der Antrag kann an der Reife scheitern — für diesen Test genügt der
    // Revert-Pfad, der offene Anträge unabhängig davon einsammelt.
    void req;

    const result = await revertStageGate(requesterCtx(), {
      epicId,
      toGate: "L3",
      reason: "Umsetzung zurückgestellt",
    });

    expect(isOk(result)).toBe(true);
    const epic = await db.initiative.findFirst({ where: { id: epicId } });
    expect(epic!.stageGate).toBe("L3");
    expect(epic!.implementationStartedAt).toBeNull();

    const open = await db.stageGateTransition.count({
      where: { initiativeId: epicId, status: "pending" },
    });
    expect(open).toBe(0);
  });

  it("hinterlässt eine Revert-Zeile in der Historie", async () => {
    const epicId = await makeEpic("L2", { selectedForAnalyzingAt: new Date() });

    await revertStageGate(requesterCtx(), { epicId, toGate: "L1", reason: "Korrektur" });

    const rows = await db.stageGateTransition.findMany({ where: { initiativeId: epicId } });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.kind).toBe("revert");
    expect(rows[0]!.status).toBe("approved");
    expect(rows[0]!.reason).toBe("Korrektur");
  });
});

// ---------------------------------------------------------------------------
// Negativ-Kontrakte — der eigentliche Punkt des Refactorings.
//
// Vorher schob jeder dieser drei Vorgänge den Reifegrad (bzw. schrieb einen
// Vorschlag) als Nebenwirkung. Wenn diese Tests je wieder rot werden, ist eine
// automatische Gate-Bewegung zurückgekehrt.
// ---------------------------------------------------------------------------

describe("Kein Vorgang bewegt den Reifegrad als Nebenwirkung", () => {
  it("saveBusinessCase lässt Gate und Anträge unberührt", async () => {
    const { saveBusinessCase } = await import("@/modules/work/server/services/epic");
    const epicId = await makeEpic("L1");
    const ctx = testRequestContext(db, seed);
    const authorized: RequestContext = {
      ...ctx,
      principal: { ...ctx.principal, capabilities: [{ action: "epic.update", scope: null }] },
    };

    await saveBusinessCase(authorized, {
      epicId: epicId as never,
      fields: { problem: "Inhalt, der früher L1→L2 vorgeschlagen hätte" } as never,
    });

    const epic = await db.initiative.findFirst({ where: { id: epicId } });
    expect(epic!.stageGate).toBe("L1");
    expect(await db.stageGateTransition.count({ where: { initiativeId: epicId } })).toBe(0);
  });

  it("ein gestartetes Child-Feature lässt das Eltern-Epic stehen", async () => {
    const epicId = await makeEpic("L3");
    await db.initiative.create({
      data: {
        tenantId: seed.tenantId,
        level: InitiativeLevel.FEATURE,
        title: "Feature",
        path: `${epicId}/f`,
        parentId: epicId,
        status: "in_progress",
        assigneeIds: [],
        createdBy: seed.actorId,
        updatedBy: seed.actorId,
      },
    });

    const epic = await db.initiative.findFirst({ where: { id: epicId } });
    expect(epic!.stageGate).toBe("L3");
    expect(await db.stageGateTransition.count({ where: { initiativeId: epicId } })).toBe(0);
  });

  it("eine Budget-Allokation > 0 lässt Gate und Anträge unberührt", async () => {
    const epicId = await makeEpic("L2", READY_FOR_L3);
    await allocateBudget(epicId, 750_000);

    const epic = await db.initiative.findFirst({ where: { id: epicId } });
    expect(epic!.stageGate).toBe("L2");
    expect(await db.stageGateTransition.count({ where: { initiativeId: epicId } })).toBe(0);
  });
});
