import { describe, it, expect, vi } from "vitest";

/**
 * Die Verdrahtung des Verteilens — Deckel, Fenster, Rechte, Löschzweig.
 *
 * Die reinen Regeln (`art-pot-window`, `art-pot-access`) sind einzeln geprüft;
 * ungeprüft war bisher, dass der Service sie richtig zusammensteckt. Genau dort
 * saßen der fehlende `active`-Filter und die zweite, wortgleiche Topfrechnung.
 */

import {
  setArtEpicAllocation,
  saveArtEpicAllocations,
} from "@/modules/budgeting/server/services/art-pot";

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
    // Der Rahmen wird nicht mehr über einen Relationsfilter gebildet, sondern
    // aus den geteilten Ladern (`budget-reads.ts`): die Positionen sagen, welcher
    // Zuspruch auf welches ART einzahlt. Die Zeilen tragen deshalb die Felder,
    // nach denen im Speicher geschnitten wird — `kind`, `active`, `artId`.
    runTheBusinessItem: {
      findMany: vi.fn(async () => [
        {
          id: "rtb1",
          name: "ART-Rahmen",
          kind: "art_change",
          artId: ART,
          solutionId: null,
          valueStreamId: VS,
          plannedAmount: 0,
          interval: "half_yearly",
          active: true,
        },
      ]),
    },
    rtbItemAward: {
      findMany: vi.fn(async () =>
        awardAmounts.map((a) => ({
          rtbItemId: "rtb1",
          cycleKey: openCycle(new Date()),
          amount: a,
        })),
      ),
    },
    artEpicAllocation: {
      findFirst: vi.fn(async () => null),
      findMany: vi.fn(async () => []),
      create: vi.fn(async () => ({ id: "a1" })),
      update: vi.fn(async () => ({ id: "a1" })),
      delete: vi.fn(async () => ({ id: "a1" })),
    },
    // Ohne Reservierung für ART-eigene Arbeit — sie zehrt denselben Rahmen auf
    // und wird deshalb von `loadArtEpicBudgets` mitgelesen.
    artOwnWorkAllocation: {
      findFirst: vi.fn(async () => null),
      findMany: vi.fn(async () => []),
      create: vi.fn(async () => ({ id: "o1" })),
      update: vi.fn(async () => ({ id: "o1" })),
      delete: vi.fn(async () => ({ id: "o1" })),
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

/**
 * **Die Reservierung für ART-eigene Arbeit** — sie ist keine Epic-Zeile, zehrt
 * aber denselben Rahmen auf. Geprüft wird genau das Zusammenspiel: ein Deckel
 * für beides, und **kein** Eintrag in der Zyklus-Karte eines Epics.
 */
describe("saveArtEpicAllocations — ART-eigene Arbeit", () => {
  const now = new Date();
  const cycle = openCycle(now);

  const eingabe = (over: Partial<Parameters<typeof saveArtEpicAllocations>[1]> = {}) => ({
    artId: ART,
    cycleKey: cycle,
    amounts: [],
    ...over,
  });

  it("legt die Reservierung an und schreibt keine Epic-Zuteilung fort", async () => {
    const tx = txWith();
    const res = await saveArtEpicAllocations(
      ctxWith(tx),
      eingabe({ ownWork: { amount: 20_000, ask: 169_559 } }),
      now,
    );
    expect(res.ok).toBe(true);
    expect(tx.artOwnWorkAllocation!.create).toHaveBeenCalled();
    // Kein Epic, keine Zyklus-Karte — sie finanziert Arbeit ohne Vorhaben.
    expect(tx.budgetAllocation!.upsert).not.toHaveBeenCalled();
  });

  it("prüft den Deckel gegen Epics **und** Reservierung zusammen", async () => {
    const tx = txWith();
    const res = await saveArtEpicAllocations(
      ctxWith(tx),
      eingabe({
        amounts: [{ epicId: EPIC, amount: 90_000, ask: 90_000 }],
        ownWork: { amount: 20_000, ask: 0 },
      }),
      now,
    );
    // 90.000 + 20.000 gegen einen Rahmen von 100.000.
    expect(res.ok).toBe(false);
    expect(tx.artOwnWorkAllocation!.create).not.toHaveBeenCalled();
    expect(tx.artEpicAllocation!.create).not.toHaveBeenCalled();
  });

  /**
   * Ein Formular ohne das Feld darf eine bestehende Reservierung nicht
   * stillschweigend überbuchbar machen.
   */
  it("zählt eine bestehende Reservierung mit, auch wenn sie nicht mitgeschickt wird", async () => {
    const tx = txWith({
      artOwnWorkAllocation: {
        findFirst: vi.fn(async () => ({ id: "o1", amount: 30_000 })),
        findMany: vi.fn(async () => []),
        create: vi.fn(async () => ({ id: "o1" })),
        update: vi.fn(async () => ({ id: "o1" })),
        delete: vi.fn(async () => ({ id: "o1" })),
      },
    });
    const res = await saveArtEpicAllocations(
      ctxWith(tx),
      eingabe({ amounts: [{ epicId: EPIC, amount: 80_000, ask: 80_000 }] }),
      now,
    );
    expect(res.ok).toBe(false);
  });

  it("löscht die Reservierung bei Betrag 0", async () => {
    const tx = txWith({
      artOwnWorkAllocation: {
        findFirst: vi.fn(async () => ({ id: "o1", amount: 30_000 })),
        findMany: vi.fn(async () => []),
        create: vi.fn(async () => ({ id: "o1" })),
        update: vi.fn(async () => ({ id: "o1" })),
        delete: vi.fn(async () => ({ id: "o1" })),
      },
    });
    const res = await saveArtEpicAllocations(
      ctxWith(tx),
      eingabe({ ownWork: { amount: 0, ask: 0 } }),
      now,
    );
    expect(res.ok).toBe(true);
    expect(tx.artOwnWorkAllocation!.delete).toHaveBeenCalled();
  });
});
