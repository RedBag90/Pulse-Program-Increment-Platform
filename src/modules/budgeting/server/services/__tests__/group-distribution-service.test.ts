import { describe, it, expect, vi } from "vitest";

/**
 * Fake-Context-Abdeckung der Selbst-Verteilungs-Guards: Gruppen-Zugehörigkeit,
 * Fenster (running/Deadline/eingereicht) und Einreich-Recht (Sprecher).
 */

import {
  setGroupAmount,
  submitGroupDistribution,
} from "@/modules/budgeting/server/services/group-distribution-service";

type Fn = ReturnType<typeof vi.fn>;
type Tx = Record<string, Record<string, Fn>>;

function ctxWith(tx: Tx, actorId = "actor") {
  return {
    principal: {
      id: actorId,
      tenantId: "T",
      email: "x",
      roles: [],
      scopes: { artIds: [], teamIds: [], valueStreamIds: [] },
    },
    db: {
      $transaction: async (cb: (tx: unknown) => Promise<unknown>) => cb(tx),
      auditEvent: { create: vi.fn(async () => ({})) },
    },
  } as unknown as Parameters<typeof setGroupAmount>[0];
}

interface GroupRow {
  spokespersonId: string | null;
  submittedAt: Date | null;
  round: { id: string; status: string; submissionDeadline: Date | null };
  members: { userId: string; isSubmitter: boolean }[];
}

function txWith(group: GroupRow, extra: Partial<Tx> = {}): Tx {
  return {
    budgetGroup: {
      findFirst: vi.fn(async () => group),
      update: vi.fn(async () => ({})),
    },
    budgetCandidate: { findFirst: vi.fn(async () => ({ id: "c1" })) },
    groupAllocation: { upsert: vi.fn(async () => ({ id: "a1" })) },
    auditEvent: { create: vi.fn(async () => ({})) },
    ...extra,
  };
}

const runningGroup = (over: Partial<GroupRow> = {}): GroupRow => ({
  spokespersonId: null,
  submittedAt: null,
  round: { id: "r1", status: "running", submissionDeadline: null },
  members: [{ userId: "actor", isSubmitter: false }],
  ...over,
});

describe("setGroupAmount", () => {
  it("Mitglied verteilt in laufender Runde", async () => {
    const t = txWith(runningGroup());
    const res = await setGroupAmount(ctxWith(t), { groupId: "g1", candidateId: "c1", amount: 1000 });
    expect(res.ok).toBe(true);
    expect(t.groupAllocation!.upsert).toHaveBeenCalled();
  });

  it("Nicht-Mitglied wird abgewiesen (forbidden)", async () => {
    const t = txWith(runningGroup({ members: [{ userId: "someone-else", isSubmitter: false }] }));
    const res = await setGroupAmount(ctxWith(t), { groupId: "g1", candidateId: "c1", amount: 1000 });
    expect(res.ok).toBe(false);
    expect(t.groupAllocation!.upsert).not.toHaveBeenCalled();
  });

  it("lehnt Schreiben ab, wenn bereits eingereicht", async () => {
    const t = txWith(runningGroup({ submittedAt: new Date("2026-01-01") }));
    const res = await setGroupAmount(ctxWith(t), { groupId: "g1", candidateId: "c1", amount: 1000 });
    expect(res.ok).toBe(false);
  });

  it("lehnt Schreiben ab, wenn Runde nicht läuft", async () => {
    const t = txWith(runningGroup({ round: { id: "r1", status: "draft", submissionDeadline: null } }));
    const res = await setGroupAmount(ctxWith(t), { groupId: "g1", candidateId: "c1", amount: 1000 });
    expect(res.ok).toBe(false);
  });
});

describe("submitGroupDistribution", () => {
  it("Sprecher darf einreichen", async () => {
    const t = txWith(runningGroup({ spokespersonId: "actor" }));
    const res = await submitGroupDistribution(ctxWith(t), { groupId: "g1" });
    expect(res.ok).toBe(true);
    expect(t.budgetGroup!.update).toHaveBeenCalled();
  });

  it("einfaches Mitglied darf NICHT einreichen (forbidden)", async () => {
    const t = txWith(runningGroup({ spokespersonId: "somebody" }));
    const res = await submitGroupDistribution(ctxWith(t), { groupId: "g1" });
    expect(res.ok).toBe(false);
    expect(t.budgetGroup!.update).not.toHaveBeenCalled();
  });

  it("isSubmitter-Mitglied darf einreichen", async () => {
    const t = txWith(runningGroup({ members: [{ userId: "actor", isSubmitter: true }] }));
    const res = await submitGroupDistribution(ctxWith(t), { groupId: "g1" });
    expect(res.ok).toBe(true);
  });
});
