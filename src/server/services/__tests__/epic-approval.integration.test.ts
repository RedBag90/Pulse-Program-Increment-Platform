import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/test/setup-db";
import { seedTenant, testRequestContext } from "@/test/fixtures/seed";
import {
  submitHypothesis,
  decideHypothesis,
  configureApprovers,
  submitBusinessCase,
  reviseBusinessCase,
  decideApproval,
  signoffSection,
  startRevision,
  listEpicApprovals,
} from "@/server/services/epic-approval";
import { isOk, isErr } from "@/domain/errors";
import { createTestPrismaClient } from "@/server/db/test-client";
import { InitiativeLevel } from "@/domain/types";
import type { EpicId } from "@/domain/types";
import { randomUUID } from "crypto";

let seed: Awaited<ReturnType<typeof seedTenant>>;

beforeEach(async () => {
  const testDb = createTestPrismaClient();
  seed = await seedTenant(testDb);
  await testDb.$disconnect();
});

async function makeEpic(approvalPhase: string, withBusinessCase = false): Promise<EpicId> {
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
      approvalPhase,
      ...(withBusinessCase
        ? { businessCase: { current: { initiativeDescription: "Ein Inhalt" }, history: [] } }
        : {}),
    },
  });
  return epic.id as EpicId;
}

const ctx = () => testRequestContext(db, seed);

/** Assigns both review sections (Breakdown, KPIs) to one owner. */
const sectionsOwnedBy = (userId: string) => [
  { section: "breakdown" as const, userId },
  { section: "kpis" as const, userId },
];

describe("hypothesis phase", () => {
  it("submit moves draft → hypothesis_review", async () => {
    const id = await makeEpic("draft");
    expect(isOk(await submitHypothesis(ctx(), { epicId: id }))).toBe(true);
    const epic = await db.initiative.findFirst({ where: { id } });
    expect(epic!.approvalPhase).toBe("hypothesis_review");
  });

  it("submit from a non-draft phase → conflict", async () => {
    const id = await makeEpic("business_case");
    const res = await submitHypothesis(ctx(), { epicId: id });
    expect(isErr(res)).toBe(true);
    if (isErr(res)) expect(res.error.kind).toBe("conflict");
  });

  it("VMO approve → business_case, reject → draft", async () => {
    const id = await makeEpic("hypothesis_review");
    expect(isOk(await decideHypothesis(ctx(), { epicId: id, decision: "approve" }))).toBe(true);
    expect((await db.initiative.findFirst({ where: { id } }))!.approvalPhase).toBe("business_case");

    const id2 = await makeEpic("hypothesis_review");
    expect(isOk(await decideHypothesis(ctx(), { epicId: id2, decision: "reject" }))).toBe(true);
    expect((await db.initiative.findFirst({ where: { id: id2 } }))!.approvalPhase).toBe("draft");
  });
});

describe("business-case phase", () => {
  it("configures multiple approvers per party", async () => {
    const id = await makeEpic("business_case");
    const u1 = randomUUID();
    const u2 = randomUUID();
    const res = await configureApprovers(ctx(), {
      epicId: id,
      assignments: [{ party: "business_owner", userIds: [u1, u2] }],
      sections: [],
    });
    expect(isOk(res)).toBe(true);
    const rows = await listEpicApprovals(db, seed.tenantId, id);
    expect(rows.filter((r) => r.party === "business_owner")).toHaveLength(2);
  });

  it("blocks BC submit without content / without approvers / without section owners", async () => {
    const noContent = await makeEpic("business_case", false);
    await configureApprovers(ctx(), {
      epicId: noContent,
      assignments: [{ party: "finance", userIds: [randomUUID()] }],
      sections: sectionsOwnedBy(randomUUID()),
    });
    expect(isErr(await submitBusinessCase(ctx(), { epicId: noContent }))).toBe(true);

    const noApprovers = await makeEpic("business_case", true);
    expect(isErr(await submitBusinessCase(ctx(), { epicId: noApprovers }))).toBe(true);

    // Content + party but no section owners assigned → still blocked.
    const noSections = await makeEpic("business_case", true);
    await configureApprovers(ctx(), {
      epicId: noSections,
      assignments: [{ party: "finance", userIds: [randomUUID()] }],
      sections: [],
    });
    expect(isErr(await submitBusinessCase(ctx(), { epicId: noSections }))).toBe(true);
  });

  it("submits BC → stakeholder_review and opens section sign-offs", async () => {
    const id = await makeEpic("business_case", true);
    await configureApprovers(ctx(), {
      epicId: id,
      assignments: [{ party: "finance", userIds: [seed.actorId] }],
      sections: sectionsOwnedBy(seed.actorId),
    });
    expect(isOk(await submitBusinessCase(ctx(), { epicId: id }))).toBe(true);
    expect((await db.initiative.findFirst({ where: { id } }))!.approvalPhase).toBe(
      "stakeholder_review",
    );
    const sections = (await listEpicApprovals(db, seed.tenantId, id)).filter(
      (r) => r.kind === "section",
    );
    expect(sections.map((s) => s.section).sort()).toEqual(["breakdown", "kpis"]);
  });
});

describe("stakeholder phase + auto-finalize", () => {
  /** Drives an epic to stakeholder_review with one party (the seed actor) + sections open. */
  async function toStakeholderReview(): Promise<EpicId> {
    const id = await makeEpic("business_case", true);
    await configureApprovers(ctx(), {
      epicId: id,
      assignments: [{ party: "business_owner", userIds: [seed.actorId] }],
      sections: sectionsOwnedBy(seed.actorId),
    });
    await submitBusinessCase(ctx(), { epicId: id });
    return id;
  }

  it("only the assigned approver may decide", async () => {
    const id = await toStakeholderReview();
    const other = await makeEpic("stakeholder_review");
    void other;
    const row = (await listEpicApprovals(db, seed.tenantId, id)).find((r) => r.kind === "party")!;
    // Reassign to someone else → seed actor is no longer the approver.
    await db.epicApproval.update({ where: { id: row.id }, data: { approverUserId: randomUUID() } });
    const res = await decideApproval(ctx(), { approvalId: row.id, decision: "approve" });
    expect(isErr(res)).toBe(true);
    if (isErr(res)) expect(res.error.kind).toBe("conflict");
  });

  it("only the assigned reviewer may sign off a section", async () => {
    const id = await toStakeholderReview();
    const row = (await listEpicApprovals(db, seed.tenantId, id)).find(
      (r) => r.kind === "section" && r.section === "breakdown",
    )!;
    // Reassign the section to someone else → seed actor is no longer its owner.
    await db.epicApproval.update({
      where: { id: row.id },
      data: { approverUserId: randomUUID() },
    });
    const res = await signoffSection(ctx(), {
      epicId: id,
      section: "breakdown",
      decision: "approve",
    });
    expect(isErr(res)).toBe(true);
    if (isErr(res)) expect(res.error.kind).toBe("conflict");
  });

  it("a rejection blocks but keeps the Epic in stakeholder_review (no auto-rebound)", async () => {
    const id = await toStakeholderReview();
    const row = (await listEpicApprovals(db, seed.tenantId, id)).find((r) => r.kind === "party")!;
    expect(isOk(await decideApproval(ctx(), { approvalId: row.id, decision: "reject" }))).toBe(
      true,
    );
    expect((await db.initiative.findFirst({ where: { id } }))!.approvalPhase).toBe(
      "stakeholder_review",
    );
  });

  it("Owner reverts a rejected Epic to business_case, and resubmit resets decisions to pending", async () => {
    const id = await toStakeholderReview();
    const partyRow = (await listEpicApprovals(db, seed.tenantId, id)).find(
      (r) => r.kind === "party",
    )!;
    await decideApproval(ctx(), { approvalId: partyRow.id, decision: "reject" });
    await signoffSection(ctx(), { epicId: id, section: "breakdown", decision: "approve" });

    // Owner reworks → back to business_case (BC editable again).
    expect(isOk(await reviseBusinessCase(ctx(), { epicId: id }))).toBe(true);
    expect((await db.initiative.findFirst({ where: { id } }))!.approvalPhase).toBe("business_case");

    // Resubmitting opens a fresh round: every decision on this revision is pending again.
    expect(isOk(await submitBusinessCase(ctx(), { epicId: id }))).toBe(true);
    const epic = await db.initiative.findFirst({ where: { id } });
    expect(epic!.approvalPhase).toBe("stakeholder_review");
    const rev = epic!.approvalRevision ?? 1;
    const live = (await listEpicApprovals(db, seed.tenantId, id)).filter((r) => r.revision === rev);
    expect(live.every((r) => r.status === "pending" && r.decidedAt === null)).toBe(true);
  });

  it("reviseBusinessCase outside stakeholder_review → conflict", async () => {
    const id = await makeEpic("business_case", true);
    const res = await reviseBusinessCase(ctx(), { epicId: id });
    expect(isErr(res)).toBe(true);
    if (isErr(res)) expect(res.error.kind).toBe("conflict");
  });

  it("approving every party + signing off both sections finalizes to approved", async () => {
    const id = await toStakeholderReview();
    const partyRow = (await listEpicApprovals(db, seed.tenantId, id)).find(
      (r) => r.kind === "party",
    )!;
    expect(
      isOk(await decideApproval(ctx(), { approvalId: partyRow.id, decision: "approve" })),
    ).toBe(true);
    expect(
      isOk(await signoffSection(ctx(), { epicId: id, section: "breakdown", decision: "approve" })),
    ).toBe(true);
    expect(
      isOk(await signoffSection(ctx(), { epicId: id, section: "kpis", decision: "approve" })),
    ).toBe(true);

    const epic = await db.initiative.findFirst({ where: { id } });
    expect(epic!.approvalPhase).toBe("approved");
    expect(epic!.status).toBe("approved");
  });
});

describe("revisions", () => {
  /** Drives an Epic to a fully approved state (revision 1). */
  async function toApproved(): Promise<EpicId> {
    const id = await makeEpic("business_case", true);
    await configureApprovers(ctx(), {
      epicId: id,
      assignments: [{ party: "business_owner", userIds: [seed.actorId] }],
      sections: sectionsOwnedBy(seed.actorId),
    });
    await submitBusinessCase(ctx(), { epicId: id });
    const partyRow = (await listEpicApprovals(db, seed.tenantId, id)).find(
      (r) => r.kind === "party",
    )!;
    await decideApproval(ctx(), { approvalId: partyRow.id, decision: "approve" });
    await signoffSection(ctx(), { epicId: id, section: "breakdown", decision: "approve" });
    await signoffSection(ctx(), { epicId: id, section: "kpis", decision: "approve" });
    return id;
  }

  it("business_case mode re-opens at business_case, bumps revision, carries approvers over, keeps revision 1", async () => {
    const id = await toApproved();
    expect(isOk(await startRevision(ctx(), { epicId: id, mode: "business_case" }))).toBe(true);

    const epic = await db.initiative.findFirst({ where: { id } });
    expect(epic!.approvalPhase).toBe("business_case");
    expect(epic!.approvalRevision).toBe(2);

    const rows = await listEpicApprovals(db, seed.tenantId, id);
    const rev2Party = rows.filter((r) => r.revision === 2 && r.kind === "party");
    expect(rev2Party).toHaveLength(1);
    expect(rev2Party[0]!.status).toBe("pending"); // carried over, reset to pending
    expect(rev2Party[0]!.approverUserId).toBe(seed.actorId);
    // Revision-1 rows are archived, not deleted.
    expect(rows.some((r) => r.revision === 1)).toBe(true);
  });

  it("full mode re-opens at draft", async () => {
    const id = await toApproved();
    expect(isOk(await startRevision(ctx(), { epicId: id, mode: "full" }))).toBe(true);
    const epic = await db.initiative.findFirst({ where: { id } });
    expect(epic!.approvalPhase).toBe("draft");
    expect(epic!.approvalRevision).toBe(2);
  });

  it("rejects starting a revision on a non-approved Epic", async () => {
    const id = await makeEpic("business_case", true);
    const res = await startRevision(ctx(), { epicId: id, mode: "full" });
    expect(isErr(res)).toBe(true);
    if (isErr(res)) expect(res.error.kind).toBe("conflict");
  });

  it("a fresh full-mode cycle requires section sign-off again (revision 2)", async () => {
    const id = await toApproved();
    await startRevision(ctx(), { epicId: id, mode: "business_case" });
    await submitBusinessCase(ctx(), { epicId: id });
    const epic = await db.initiative.findFirst({ where: { id } });
    expect(epic!.approvalPhase).toBe("stakeholder_review");
    // New revision-2 section rows are pending again (not carried as approved).
    const rev2Sections = (await listEpicApprovals(db, seed.tenantId, id)).filter(
      (r) => r.revision === 2 && r.kind === "section",
    );
    expect(rev2Sections).toHaveLength(2);
    expect(rev2Sections.every((s) => s.status === "pending")).toBe(true);
  });
});
