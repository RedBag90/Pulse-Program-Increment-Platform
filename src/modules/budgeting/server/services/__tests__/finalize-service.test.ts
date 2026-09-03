import { describe, it, expect, vi } from "vitest";

/**
 * Fake-Context-Abdeckung der Finance-Finalisierung: setzt je Kandidat
 * `finalAmount`, schreibt für Epic-Kandidaten `BudgetAllocation`, berechnet die
 * Reserve und schließt die Kachel.
 */

import { captureBudgetPlanRevision } from "@/modules/budgeting/server/services/budget-plan-revision";
import {
  finalizePeriod,
  closeDistribution,
  reopenFinalization,
} from "@/modules/budgeting/server/services/finalize-service";

// Der Snapshot ist eine eigene Transaktion nach dem Abschluss — hier nur die
// Naht prüfen, nicht das Falten selbst.
vi.mock("@/modules/budgeting/server/services/budget-plan-revision", () => ({
  captureBudgetPlanRevision: vi.fn(async () => ({ ok: true, value: { id: "rev", cycleKey: "" } })),
}));
const captureMock = vi.mocked(captureBudgetPlanRevision);

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
      budgetRound: {
        findFirst: vi.fn(async () => ({ status: "running" })),
        update: vi.fn(async () => ({})),
      },
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

  // Die Zyklus-Karte ist eine Fortschreibung: sie trägt alle Halbjahre, in denen
  // das Epic je Geld bekommen hat. Ein Finalize darf nur die eigene Zelle setzen.
  // Dieser Test steht hier, bevor der Merge in eine eigene Funktion wandert —
  // er ist die Absicherung der Extraktion, nicht ihre Folge.
  it("ergänzt die Zyklus-Karte, statt frühere Halbjahre zu verlieren", async () => {
    const t = tx();
    t.budgetAllocation!.findUnique = vi.fn(async () => ({
      allocations: { "2025-H2": 300 },
    }));

    const res = await finalizePeriod(ctxWith(t), {
      id: "r1",
      finals: [{ candidateId: "c1", amount: 400 }],
    });

    expect(res.ok).toBe(true);
    const arg = t.budgetAllocation!.upsert!.mock.calls[0]![0] as {
      update: { allocations: Record<string, number> };
      create: { allocations: Record<string, number> };
    };
    expect(arg.update.allocations).toEqual({ "2025-H2": 300, "2026-H1": 400 });
    expect(arg.create.allocations).toEqual({ "2025-H2": 300, "2026-H1": 400 });
  });

  it("ersetzt den Betrag desselben Zyklus, statt ihn zu addieren", async () => {
    const t = tx();
    t.budgetAllocation!.findUnique = vi.fn(async () => ({
      allocations: { "2026-H1": 900 },
    }));

    await finalizePeriod(ctxWith(t), { id: "r1", finals: [{ candidateId: "c1", amount: 400 }] });

    const arg = t.budgetAllocation!.upsert!.mock.calls[0]![0] as {
      update: { allocations: Record<string, number> };
    };
    expect(arg.update.allocations).toEqual({ "2026-H1": 400 });
  });

  it("lehnt ab, wenn nicht decided", async () => {
    const t = tx();
    t.budgetRound!.findFirst = vi.fn(async () => ({
      status: "running",
      cycleKey: "2026-H1",
      poolTotal: 1000,
    }));
    const res = await finalizePeriod(ctxWith(t), { id: "r1", finals: [] });
    expect(res.ok).toBe(false);
  });
});

describe("reopenFinalization", () => {
  it("closed → decided und leert die Reserve; finalAmount bleibt unangetastet", async () => {
    const t: Tx = {
      budgetRound: {
        findFirst: vi.fn(async () => ({ status: "closed" })),
        update: vi.fn(async () => ({})),
      },
      budgetCandidate: { update: vi.fn() },
      auditEvent: { create: vi.fn(async () => ({})) },
    };
    const res = await reopenFinalization(ctxWith(t), { id: "r1" });
    expect(res.ok).toBe(true);
    expect(t.budgetRound!.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "decided", reserveAmount: null }),
      }),
    );
    expect(t.budgetCandidate!.update).not.toHaveBeenCalled();
  });

  it.each(["running", "decided", "draft"])("lehnt Status %s ab", async (status) => {
    const t: Tx = {
      budgetRound: { findFirst: vi.fn(async () => ({ status })), update: vi.fn() },
      auditEvent: { create: vi.fn(async () => ({})) },
    };
    const res = await reopenFinalization(ctxWith(t), { id: "r1" });
    expect(res.ok).toBe(false);
    expect(t.budgetRound!.update).not.toHaveBeenCalled();
  });
});

describe("finalizePeriod — der Abschluss friert ein", () => {
  function tx(): Tx {
    return {
      budgetRound: {
        findFirst: vi.fn(async () => ({ status: "decided", cycleKey: "2026-H2", poolTotal: 1000 })),
        update: vi.fn(async () => ({})),
      },
      budgetCandidate: {
        findMany: vi.fn(async () => [{ id: "c1", kind: "epic", epicId: "e1" }]),
        update: vi.fn(async () => ({})),
      },
      budgetAllocation: {
        findUnique: vi.fn(async () => null),
        upsert: vi.fn(async () => ({})),
      },
      initiative: { findMany: vi.fn(async () => []) },
      tenant: { findUnique: vi.fn(async () => null) },
      auditEvent: { create: vi.fn(async () => ({})) },
    };
  }

  it("erfasst den Budget-Plan mit dem Zyklus der Kachel", async () => {
    captureMock.mockClear();
    const res = await finalizePeriod(ctxWith(tx()), {
      id: "r1",
      finals: [{ candidateId: "c1", amount: 400 }],
    });

    expect(res.ok).toBe(true);
    expect(captureMock).toHaveBeenCalledTimes(1);
    expect(captureMock.mock.calls[0]![1]).toEqual({ cycleKey: "2026-H2" });
  });

  it("ein Fehlschlag der Erfassung kippt die Finalisierung nicht", async () => {
    // Der Abschluss ist bereits committet — ein Rückabwickeln wäre schlimmer
    // als ein fehlender Snapshot.
    captureMock.mockClear();
    captureMock.mockRejectedValueOnce(new Error("DB weg"));
    const t = tx();

    const res = await finalizePeriod(ctxWith(t), {
      id: "r1",
      finals: [{ candidateId: "c1", amount: 400 }],
    });

    expect(res.ok).toBe(true);
    expect(t.budgetRound!.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "closed" }) }),
    );
  });
});
