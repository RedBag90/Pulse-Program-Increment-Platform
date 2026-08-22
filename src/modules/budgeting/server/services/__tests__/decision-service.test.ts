import { describe, it, expect, vi } from "vitest";
import { recordDecision } from "@/modules/budgeting/server/services/decision-service";

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
  } as unknown as Parameters<typeof recordDecision>[0];
}

/** status decided, `yes` Ja-Stimmen von `total` Gruppen. */
function tx(yes: number, total: number): Tx {
  return {
    budgetRound: { findFirst: vi.fn(async () => ({ status: "decided" })) },
    groupAllocation: { count: vi.fn(async () => yes) },
    budgetGroup: { count: vi.fn(async () => total) },
    budgetDecision: { upsert: vi.fn(async () => ({})) },
    auditEvent: { create: vi.fn(async () => ({})) },
  };
}

describe("recordDecision — Begründungspflicht bei Abweichung", () => {
  it("finanzieren gegen Nein-Mehrheit ohne Begründung wird abgelehnt", async () => {
    const t = tx(1, 3); // Mehrheit Nein
    const res = await recordDecision(ctxWith(t), { roundId: "r", epicId: "E4", outcome: "funded" });
    expect(res.ok).toBe(false);
    expect(t.budgetDecision!.upsert).not.toHaveBeenCalled();
  });

  it("finanzieren gegen Nein-Mehrheit MIT Begründung wird gespeichert (deviates=true)", async () => {
    const t = tx(1, 3);
    const res = await recordDecision(ctxWith(t), {
      roundId: "r",
      epicId: "E4",
      outcome: "funded",
      justification: "Konzernvorgabe Datenarchitektur.",
    });
    expect(res.ok).toBe(true);
    const arg = t.budgetDecision!.upsert!.mock.calls[0]![0] as { create: { deviatesFromMajority: boolean } };
    expect(arg.create.deviatesFromMajority).toBe(true);
  });

  it("finanzieren MIT Ja-Mehrheit braucht keine Begründung (deviates=false)", async () => {
    const t = tx(2, 3); // Mehrheit Ja
    const res = await recordDecision(ctxWith(t), { roundId: "r", epicId: "E1", outcome: "funded" });
    expect(res.ok).toBe(true);
    const arg = t.budgetDecision!.upsert!.mock.calls[0]![0] as { create: { deviatesFromMajority: boolean } };
    expect(arg.create.deviatesFromMajority).toBe(false);
  });

  it("vertagen ohne Prüfauftrag wird abgelehnt", async () => {
    const t = tx(1, 3);
    const res = await recordDecision(ctxWith(t), {
      roundId: "r",
      epicId: "E4",
      outcome: "deferred_with_review",
    });
    expect(res.ok).toBe(false);
  });

  it("nur im Status decided", async () => {
    const t = tx(2, 3);
    t.budgetRound = { findFirst: vi.fn(async () => ({ status: "running" })) };
    const res = await recordDecision(ctxWith(t), { roundId: "r", epicId: "E1", outcome: "funded" });
    expect(res.ok).toBe(false);
  });
});
