import { describe, it, expect, vi } from "vitest";

/**
 * Fake-Context-Abdeckung der Finance-Finalisierung: setzt je Kandidat
 * `finalAmount`, schreibt für Epic-Kandidaten `BudgetAllocation`, berechnet die
 * Reserve und schließt die Kachel.
 */

import { finalizePeriod, closeDistribution } from "@/modules/budgeting/server/services/finalize-service";

type Fn = ReturnType<typeof vi.fn>;
type Tx = Record<string, Record<string, Fn>>;

function ctxWith(tx: Tx) {
  return {
    principal: {
      id: "actor",
      tenantId: "T",
      email: "x",
      roles: [],
      scopes: { artIds: [], teamIds: [], valueStreamIds: [] },
    },
    db: {
      $transaction: async (cb: (tx: unknown) => Promise<unknown>) => cb(tx),
      auditEvent: { create: vi.fn(async () => ({})) },
    },
  } as unknown as Parameters<typeof finalizePeriod>[0];
}

describe("closeDistribution", () => {
  it("running → decided", async () => {
    const t: Tx = {
      budgetRound: { findFirst: vi.fn(async () => ({ status: "running" })), update: vi.fn(async () => ({})) },
      auditEvent: { create: vi.fn(async () => ({})) },
    };
    const res = await closeDistribution(ctxWith(t), { id: "r1" });
    expect(res.ok).toBe(true);
    expect(t.budgetRound!.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "decided" }) }),
    );
  });

  it("lehnt ab, wenn nicht running", async () => {
    const t: Tx = {
      budgetRound: { findFirst: vi.fn(async () => ({ status: "draft" })), update: vi.fn() },
      auditEvent: { create: vi.fn(async () => ({})) },
    };
    const res = await closeDistribution(ctxWith(t), { id: "r1" });
    expect(res.ok).toBe(false);
  });
});

describe("finalizePeriod", () => {
  function tx(): Tx {
    // loadRoundBallot: budgeting-reife Ballot-Epics (hier leer)
    const findMany = vi.fn().mockResolvedValue([]);
    return {
      budgetRound: {
        findFirst: vi.fn(async () => ({ status: "decided", cycleKey: "2026-H1", poolTotal: 1000 })),
        update: vi.fn(async () => ({})),
      },
      budgetCandidate: {
        findMany: vi.fn(async () => [
          { id: "c1", kind: "epic", epicId: "e1" },
          { id: "c2", kind: "rtb", epicId: null },
        ]),
        update: vi.fn(async () => ({})),
      },
      budgetAllocation: {
        findUnique: vi.fn(async () => null),
        upsert: vi.fn(async () => ({ id: "a1" })),
      },
      initiative: { findMany },
      // loadRoundBallot löst den tenant-Default-Aufwand auf.
      tenant: { findUnique: vi.fn(async () => null) },
      auditEvent: { create: vi.fn(async () => ({})) },
    };
  }

  it("setzt finalAmount, schreibt Epic-Allocation, berechnet Reserve, schließt", async () => {
    const t = tx();
    const res = await finalizePeriod(ctxWith(t), {
      id: "r1",
      finals: [
        { candidateId: "c1", amount: 400 },
        { candidateId: "c2", amount: 200 },
      ],
    });
    expect(res.ok).toBe(true);
    expect(t.budgetCandidate!.update).toHaveBeenCalledTimes(2);
    // Nur der Epic-Kandidat schreibt BudgetAllocation.
    expect(t.budgetAllocation!.upsert).toHaveBeenCalledTimes(1);
    // Reserve = (1000 − 0) − (400 + 200) = 400 · Status closed.
    expect(t.budgetRound!.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "closed", reserveAmount: 400 }),
      }),
    );
  });

  it("lehnt ab, wenn nicht decided", async () => {
    const t = tx();
    t.budgetRound!.findFirst = vi.fn(async () => ({ status: "running", cycleKey: "2026-H1", poolTotal: 1000 }));
    const res = await finalizePeriod(ctxWith(t), { id: "r1", finals: [] });
    expect(res.ok).toBe(false);
  });
});
