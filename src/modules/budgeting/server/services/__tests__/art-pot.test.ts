import { describe, it, expect, vi } from "vitest";

/**
 * Die Verdrahtung des Verteilens — Deckel, Fenster, Rechte, Löschzweig.
 *
 * Die reinen Regeln (`art-pot-window`, `art-pot-access`) sind einzeln geprüft;
 * ungeprüft war bisher, dass der Service sie richtig zusammensteckt. Genau dort
 * saßen der fehlende `active`-Filter und die zweite, wortgleiche Topfrechnung.
 */

import { setArtEpicAllocation } from "@/modules/budgeting/server/services/art-pot";

type Tx = Record<string, Record<string, ReturnType<typeof vi.fn>>>;

const ART = "11111111-1111-4111-8111-111111111111";
const EPIC = "22222222-2222-4222-8222-222222222222";
const VS = "33333333-3333-4333-8333-333333333333";

/** Ein Zyklus, der sicher im offenen Fenster liegt. */
function openCycle(now: Date): string {
  const h = now.getMonth() < 6 ? 1 : 2;
  return `${now.getFullYear()}-H${h}`;
}

/**
 * @param principalId  "finance" ist die Finance-Partei des Wertstroms.
 * @param capabilities Leer = keine Capability; der Finance-Weg trägt allein.
 */
function ctxWith(
  tx: Tx,
  principalId = "finance",
  capabilities: { action: string; scope?: string }[] = [],
) {
  return {
    principal: {
      id: principalId,
      tenantId: "T",
      email: "x",
      roles: [],
      scopes: { artIds: [ART], teamIds: [], valueStreamIds: [VS] },
      capabilities,
    },
    db: {
      $transaction: async (cb: (t: unknown) => Promise<unknown>) => cb(tx),
      auditEvent: { create: vi.fn(async () => ({})) },
    },
  } as unknown as Parameters<typeof setArtEpicAllocation>[0];
}

/** Ein Standard-Tx: ein ART, ein Wertstrom mit „finance" als Finance-Partei. */
function txWith(over: Partial<Tx> = {}, awardAmounts: number[] = [100_000]): Tx {
  return {
    art: { findFirst: vi.fn(async () => ({ id: ART, valueStreamId: VS })) },
    valueStream: { findFirst: vi.fn(async () => ({ financeApproverId: "finance" })) },
    initiative: { findFirst: vi.fn(async () => ({ primarySolution: null })) },
    runTheBusinessItem: { findMany: vi.fn(async () => [{ id: "rtb1" }]) },
    // Das Budget wird seit `art-epic-budget.ts` über die Relation gefiltert;
    // die Awards tragen deshalb ihren ART mit.
    rtbItemAward: {
      findMany: vi.fn(async () =>
        awardAmounts.map((a) => ({ amount: a, rtbItem: { artId: ART } })),
      ),
    },
    artEpicAllocation: {
      findFirst: vi.fn(async () => null),
      findMany: vi.fn(async () => []),
      create: vi.fn(async () => ({ id: "a1" })),
      update: vi.fn(async () => ({ id: "a1" })),
      delete: vi.fn(async () => ({ id: "a1" })),
    },
    budgetAllocation: {
      findUnique: vi.fn(async () => null),
      upsert: vi.fn(async () => ({})),
    },
    auditEvent: { create: vi.fn(async () => ({})) },
    ...over,
  } as Tx;
}

describe("setArtEpicAllocation", () => {
  const now = new Date();
  const cycle = openCycle(now);

  it("schreibt innerhalb des Budgets und meldet den Rest", async () => {
    const tx = txWith();
    const res = await setArtEpicAllocation(
      ctxWith(tx),
      { artId: ART, epicId: EPIC, cycleKey: cycle, amount: 60_000, ask: 60_000 },
      now,
    );
    expect(res.ok).toBe(true);
    expect(tx.artEpicAllocation!.create).toHaveBeenCalled();
    expect(tx.budgetAllocation!.upsert).toHaveBeenCalled();
  });

  it("weist ab, was das Budget überschreitet", async () => {
    const tx = txWith();
    const res = await setArtEpicAllocation(
      ctxWith(tx),
      { artId: ART, epicId: EPIC, cycleKey: cycle, amount: 140_000, ask: 140_000 },
      now,
    );
    expect(res.ok).toBe(false);
    expect(tx.artEpicAllocation!.create).not.toHaveBeenCalled();
  });

  it("löscht die Zeile bei Betrag 0, statt eine Null zu schreiben", async () => {
    const tx = txWith({
      artEpicAllocation: {
        findFirst: vi.fn(async () => ({ id: "a1", amount: 50_000, ask: 50_000 })),
        findMany: vi.fn(async () => []),
        create: vi.fn(async () => ({ id: "a1" })),
        update: vi.fn(async () => ({ id: "a1" })),
        delete: vi.fn(async () => ({ id: "a1" })),
      },
    });
    const res = await setArtEpicAllocation(
      ctxWith(tx),
      { artId: ART, epicId: EPIC, cycleKey: cycle, amount: 0, ask: 50_000 },
      now,
    );
    expect(res.ok).toBe(true);
    expect(tx.artEpicAllocation!.delete).toHaveBeenCalled();
    expect(tx.artEpicAllocation!.create).not.toHaveBeenCalled();
  });

  it("weist ein geschlossenes Halbjahr ab, bevor es irgendetwas liest", async () => {
    const tx = txWith();
    const res = await setArtEpicAllocation(
      ctxWith(tx),
      { artId: ART, epicId: EPIC, cycleKey: "2020-H1", amount: 10_000, ask: 10_000 },
      now,
    );
    expect(res.ok).toBe(false);
    expect(tx.art!.findFirst).not.toHaveBeenCalled();
  });

  it("weist ab, wer keinen der vier Wege trägt", async () => {
    const tx = txWith();
    const res = await setArtEpicAllocation(
      ctxWith(tx, "fremder"),
      { artId: ART, epicId: EPIC, cycleKey: cycle, amount: 10_000, ask: 10_000 },
      now,
    );
    expect(res.ok).toBe(false);
    expect(tx.artEpicAllocation!.create).not.toHaveBeenCalled();
  });

  it("lässt den RTE seines ARTs durch — der vierte Weg", async () => {
    const tx = txWith();
    const res = await setArtEpicAllocation(
      ctxWith(tx, "rte", [{ action: "art_budget.distribute", scope: "art" }]),
      { artId: ART, epicId: EPIC, cycleKey: cycle, amount: 30_000, ask: 30_000 },
      now,
    );
    expect(res.ok).toBe(true);
    expect(tx.artEpicAllocation!.create).toHaveBeenCalled();
  });
});
