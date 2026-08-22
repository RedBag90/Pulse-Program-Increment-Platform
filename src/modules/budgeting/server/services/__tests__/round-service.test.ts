import { describe, it, expect, vi } from "vitest";

/**
 * Fake-Context-Abdeckung der Runden-Lebenszyklus-Guards (kein Test-DB nötig,
 * Muster `pi-lifecycle-service.test.ts`).
 */

import { createRound, transitionRound } from "@/modules/budgeting/server/services/round-service";
import { addGroup } from "@/modules/budgeting/server/services/round-group-service";

type Tx = Record<string, Record<string, ReturnType<typeof vi.fn>>>;

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
  } as unknown as Parameters<typeof createRound>[0];
}

describe("createRound", () => {
  it("legt eine draft-Runde an", async () => {
    const t: Tx = {
      budgetRound: {
        findUnique: vi.fn(async () => null),
        findFirst: vi.fn(async () => null),
        create: vi.fn(async () => ({ id: "r1" })),
      },
      auditEvent: { create: vi.fn(async () => ({})) },
    };
    const res = await createRound(ctxWith(t), {
      cycleKey: "2026-H1",
      poolTotal: 2_050_000,
      decisionAuthorityIds: ["u1"],
    });
    expect(res.ok).toBe(true);
    expect(t.budgetRound!.create).toHaveBeenCalled();
  });

  it("lehnt eine zweite Runde für denselben Cycle ab", async () => {
    const t: Tx = {
      budgetRound: {
        findUnique: vi.fn(async () => ({ id: "existing" })),
        create: vi.fn(async () => ({ id: "r1" })),
      },
      auditEvent: { create: vi.fn(async () => ({})) },
    };
    const res = await createRound(ctxWith(t), {
      cycleKey: "2026-H1",
      poolTotal: 1,
      decisionAuthorityIds: [],
    });
    expect(res.ok).toBe(false);
    expect(t.budgetRound!.create).not.toHaveBeenCalled();
  });
});

describe("transitionRound — draft→running Guards", () => {
  function tx(round: unknown, groupCount: number): Tx {
    return {
      budgetRound: {
        findFirst: vi.fn(async () => round),
        update: vi.fn(async () => ({})),
      },
      budgetGroup: { count: vi.fn(async () => groupCount) },
      auditEvent: { create: vi.fn(async () => ({})) },
    };
  }

  it("startet, wenn Topf > 0 und ≥3 Gruppen", async () => {
    const t = tx({ id: "r1", status: "draft", poolTotal: 2_050_000 }, 3);
    const res = await transitionRound(ctxWith(t), { id: "r1", to: "running" });
    expect(res.ok).toBe(true);
    expect(t.budgetRound!.update).toHaveBeenCalledWith({
      where: { id: "r1" },
      data: { status: "running", updatedBy: "actor" },
    });
  });

  it("blockt bei Topf 0", async () => {
    const t = tx({ id: "r1", status: "draft", poolTotal: 0 }, 3);
    const res = await transitionRound(ctxWith(t), { id: "r1", to: "running" });
    expect(res.ok).toBe(false);
    expect(t.budgetRound!.update).not.toHaveBeenCalled();
  });

  it("blockt bei < 3 Gruppen", async () => {
    const t = tx({ id: "r1", status: "draft", poolTotal: 100 }, 2);
    const res = await transitionRound(ctxWith(t), { id: "r1", to: "running" });
    expect(res.ok).toBe(false);
  });

  it("lehnt einen unerlaubten Sprung draft→decided ab", async () => {
    const t = tx({ id: "r1", status: "draft", poolTotal: 100 }, 3);
    const res = await transitionRound(ctxWith(t), { id: "r1", to: "decided" });
    expect(res.ok).toBe(false);
  });
});

describe("addGroup — nur in draft", () => {
  it("legt eine Gruppe in draft an", async () => {
    const t: Tx = {
      budgetRound: { findFirst: vi.fn(async () => ({ status: "draft" })) },
      budgetGroup: { create: vi.fn(async () => ({ id: "g1" })) },
      auditEvent: { create: vi.fn(async () => ({})) },
    };
    const res = await addGroup(ctxWith(t), { roundId: "r1", name: "A" });
    expect(res.ok).toBe(true);
  });

  it("lehnt Gruppen-Anlage ab, wenn die Runde läuft", async () => {
    const t: Tx = {
      budgetRound: { findFirst: vi.fn(async () => ({ status: "running" })) },
      budgetGroup: { create: vi.fn(async () => ({ id: "g1" })) },
      auditEvent: { create: vi.fn(async () => ({})) },
    };
    const res = await addGroup(ctxWith(t), { roundId: "r1", name: "A" });
    expect(res.ok).toBe(false);
    expect(t.budgetGroup!.create).not.toHaveBeenCalled();
  });
});
