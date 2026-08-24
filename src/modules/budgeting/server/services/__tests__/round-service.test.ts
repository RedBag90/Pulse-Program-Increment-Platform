import { describe, it, expect, vi } from "vitest";

/**
 * Fake-Context-Abdeckung der Runden-Lebenszyklus-Guards (kein Test-DB nötig,
 * Muster `pi-lifecycle-service.test.ts`).
 */

import { createRound, transitionRound, startPeriod } from "@/modules/budgeting/server/services/round-service";
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

  it("erlaubt mehrere Kacheln für denselben Cycle (Kachel-Modell, kein Duplikat-Guard)", async () => {
    const t: Tx = {
      budgetRound: {
        findFirst: vi.fn(async () => null),
        create: vi.fn(async () => ({ id: "r2" })),
      },
      auditEvent: { create: vi.fn(async () => ({})) },
    };
    const res = await createRound(ctxWith(t), {
      cycleKey: "2026-H1",
      poolTotal: 1,
      decisionAuthorityIds: [],
    });
    expect(res.ok).toBe(true);
    expect(t.budgetRound!.create).toHaveBeenCalled();
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

  it("startet auch bei Topf 0 (weiche Anforderung, nur Warnung)", async () => {
    const t = tx({ id: "r1", status: "draft", poolTotal: 0 }, 3);
    const res = await transitionRound(ctxWith(t), { id: "r1", to: "running" });
    expect(res.ok).toBe(true);
    expect(t.budgetRound!.update).toHaveBeenCalled();
  });

  it("startet auch bei < 3 Gruppen (weiche Anforderung)", async () => {
    const t = tx({ id: "r1", status: "draft", poolTotal: 100 }, 2);
    const res = await transitionRound(ctxWith(t), { id: "r1", to: "running" });
    expect(res.ok).toBe(true);
  });

  it("lehnt einen unerlaubten Sprung draft→decided ab", async () => {
    const t = tx({ id: "r1", status: "draft", poolTotal: 100 }, 3);
    const res = await transitionRound(ctxWith(t), { id: "r1", to: "decided" });
    expect(res.ok).toBe(false);
  });
});

describe("transitionRound — Schließen: Seam (Vorbefüllung + Topf-Vererbung)", () => {
  /**
   * Reicher Fake-tx für den Close-Pfad. `initiative.findMany` liefert erst die
   * Ballot-Kandidaten, dann die Pflichtvorhaben (Reihenfolge im loadRoundBallot-
   * Promise.all).
   */
  function closeTx(opts: {
    ballot: { id: string; title: string; costToMvp: number }[];
    mandatory: { costToMvp: number }[];
    fundedVotes: { epicId: string }[];
    decisions: { epicId: string; outcome: string }[];
    groupCount: number;
    existingPool: Record<string, number> | null;
  }): Tx {
    const findMany = vi
      .fn()
      .mockResolvedValueOnce(opts.ballot)
      .mockResolvedValueOnce(opts.mandatory);
    return {
      budgetRound: {
        findFirst: vi.fn(async () => ({
          id: "r1",
          status: "decided",
          poolTotal: 1_000,
          cycleKey: "2026-H1",
        })),
        update: vi.fn(async () => ({})),
      },
      initiative: { findMany, updateMany: vi.fn(async () => ({})) },
      groupAllocation: { findMany: vi.fn(async () => opts.fundedVotes) },
      budgetDecision: { findMany: vi.fn(async () => opts.decisions) },
      budgetGroup: { count: vi.fn(async () => opts.groupCount) },
      budgetAllocation: { upsert: vi.fn(async () => ({ id: "a1" })) },
      tenant: {
        findUnique: vi.fn(async () => ({ budgetPoolByPeriod: opts.existingPool })),
        update: vi.fn(async () => ({})),
      },
      auditEvent: { create: vi.fn(async () => ({})) },
    };
  }

  it("legt für finanzierte Epics eine Allocation an und un-staged nicht-finanzierte", async () => {
    const t = closeTx({
      ballot: [
        { id: "e1", title: "A", costToMvp: 100 },
        { id: "e2", title: "B", costToMvp: 50 },
      ],
      mandatory: [],
      fundedVotes: [{ epicId: "e1" }, { epicId: "e1" }], // Konsens (2/2 Gruppen)
      decisions: [],
      groupCount: 2,
      existingPool: null,
    });

    const res = await transitionRound(ctxWith(t), { id: "r1", to: "closed" });
    expect(res.ok).toBe(true);

    // e1 finanziert → Allocation mit costToMvp als Startwert für den Cycle.
    expect(t.budgetAllocation!.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { epicId: "e1" },
        update: {},
        create: expect.objectContaining({
          epicId: "e1",
          allocations: { "2026-H1": 100 },
        }),
      }),
    );
    // e2 nicht finanziert → un-staged, keine Allocation.
    expect(t.budgetAllocation!.upsert).toHaveBeenCalledTimes(1);
    expect(t.initiative!.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { stagedForBudgeting: false } }),
    );
  });

  it("erbt den Runden-Topf in budgetPoolByPeriod und lässt andere Perioden unberührt", async () => {
    const t = closeTx({
      ballot: [{ id: "e1", title: "A", costToMvp: 100 }],
      mandatory: [],
      fundedVotes: [{ epicId: "e1" }],
      decisions: [],
      groupCount: 1,
      existingPool: { "2025-H2": 777 },
    });

    await transitionRound(ctxWith(t), { id: "r1", to: "closed" });

    expect(t.tenant!.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { budgetPoolByPeriod: { "2025-H2": 777, "2026-H1": 1_000 } },
      }),
    );
  });

  it("upsert nutzt update:{} — bestehende Allocation wird nicht überschrieben", async () => {
    const t = closeTx({
      ballot: [{ id: "e1", title: "A", costToMvp: 100 }],
      mandatory: [],
      fundedVotes: [{ epicId: "e1" }],
      decisions: [],
      groupCount: 1,
      existingPool: null,
    });

    await transitionRound(ctxWith(t), { id: "r1", to: "closed" });

    expect(t.budgetAllocation!.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: {} }),
    );
  });
});

describe("startPeriod — draft→running + RtB-Materialisierung", () => {
  it("materialisiert aktive RtB-Positionen als Kandidaten und schaltet auf running", async () => {
    const t: Tx = {
      budgetRound: {
        findFirst: vi.fn(async () => ({ status: "draft" })),
        update: vi.fn(async () => ({})),
      },
      runTheBusinessItem: {
        findMany: vi.fn(async () => [
          { id: "rtb1", name: "Betrieb", plannedAmount: 100, valueStreamId: "vs1" },
          { id: "rtb2", name: "Lizenzen", plannedAmount: 50, valueStreamId: "vs1" },
        ]),
      },
      budgetCandidate: { upsert: vi.fn(async () => ({ id: "c1" })) },
      auditEvent: { create: vi.fn(async () => ({})) },
    };
    const res = await startPeriod(ctxWith(t), { id: "r1" });
    expect(res.ok).toBe(true);
    expect(t.budgetCandidate!.upsert).toHaveBeenCalledTimes(2);
    expect(t.budgetRound!.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "running" }) }),
    );
  });

  it("lehnt Start ab, wenn nicht im Entwurf", async () => {
    const t: Tx = {
      budgetRound: { findFirst: vi.fn(async () => ({ status: "running" })), update: vi.fn() },
      runTheBusinessItem: { findMany: vi.fn(async () => []) },
      budgetCandidate: { upsert: vi.fn() },
      auditEvent: { create: vi.fn(async () => ({})) },
    };
    const res = await startPeriod(ctxWith(t), { id: "r1" });
    expect(res.ok).toBe(false);
    expect(t.budgetRound!.update).not.toHaveBeenCalled();
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
