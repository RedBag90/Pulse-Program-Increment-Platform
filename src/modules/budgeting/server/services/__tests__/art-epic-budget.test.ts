import { describe, it, expect, vi } from "vitest";
import {
  loadArtEpicBudgets,
  loadArtEpicBudget,
} from "@/modules/budgeting/server/services/art-epic-budget";
import { budgetingStore } from "@/test/fakes/budgeting-store";

/**
 * Die Schnittstelle ist die Testfläche: gefragt wird nach einer **Menge** von
 * ARTs, also wird auch so geprüft. Der Einzelfall ist nur ein Aufruf mit einem
 * Element — dass er eine eigene Funktion hat, ist Bequemlichkeit für die
 * Schreibwege, kein zweiter Weg.
 */

const A1 = "art-1";
const A2 = "art-2";
const A3 = "art-3";
const NOW = new Date("2026-08-15T00:00:00Z"); // 2026-H2 ist offen

function dbWith(
  awards: { amount: number; artId: string | null }[],
  allocations: { artId: string; amount: number }[],
) {
  const awardQuery = vi.fn(async (_args: { where: unknown }) =>
    awards.map((a) => ({ amount: a.amount, rtbItem: { artId: a.artId } })),
  );
  const allocQuery = vi.fn(async (_args: { where: unknown }) => allocations);
  return {
    db: {
      rtbItemAward: { findMany: awardQuery },
      artEpicAllocation: { findMany: allocQuery },
    } as unknown as Parameters<typeof loadArtEpicBudgets>[0],
    awardQuery,
    allocQuery,
  };
}

describe("loadArtEpicBudgets", () => {
  it("beantwortet mehrere ARTs mit zwei Abfragen — nicht mit zwei je ART", async () => {
    const { db, awardQuery, allocQuery } = dbWith(
      [
        { amount: 100_000, artId: A1 },
        { amount: 60_000, artId: A2 },
      ],
      [{ artId: A1, amount: 40_000 }],
    );
    await loadArtEpicBudgets(db, "T", [A1, A2, A3], "2026-H2", NOW);
    // Das ist der Punkt der ganzen Umstellung.
    expect(awardQuery).toHaveBeenCalledTimes(1);
    expect(allocQuery).toHaveBeenCalledTimes(1);
  });

  it("summiert je ART und rechnet den Rest", async () => {
    const { db } = dbWith(
      [
        { amount: 100_000, artId: A1 },
        { amount: 20_000, artId: A1 },
        { amount: 60_000, artId: A2 },
      ],
      [
        { artId: A1, amount: 40_000 },
        { artId: A1, amount: 30_000 },
      ],
    );
    const m = await loadArtEpicBudgets(db, "T", [A1, A2], "2026-H2", NOW);
    expect(m.get(A1)).toMatchObject({ total: 120_000, distributed: 70_000, remaining: 50_000 });
    expect(m.get(A2)).toMatchObject({ total: 60_000, distributed: 0, remaining: 60_000 });
  });

  it("liefert jeden gefragten ART, auch den ohne Budget", async () => {
    const { db } = dbWith([{ amount: 10_000, artId: A1 }], []);
    const m = await loadArtEpicBudgets(db, "T", [A1, A2, A3], "2026-H2", NOW);
    // Sonst müsste jeder Aufrufer zwischen „kein Budget" und „nicht gefragt"
    // unterscheiden — genau die Fallunterscheidung, die vorher viermal stand.
    expect([...m.keys()]).toEqual([A1, A2, A3]);
    expect(m.get(A3)).toMatchObject({ total: 0, distributed: 0, remaining: 0 });
  });

  it("zählt eine deaktivierte Position nicht — und eine Betriebsposition auch nicht", async () => {
    // Verhalten statt Aufrufform: der Speicher wertet das `where` aus, also
    // beantwortet der Test die Frage, um die es geht — nicht die Frage, wie die
    // Abfrage geschrieben ist.
    const store = budgetingStore({
      runTheBusinessItem: [
        { id: "p1", tenantId: "T", artId: A1, kind: "art_change", active: true },
        { id: "p2", tenantId: "T", artId: A1, kind: "art_change", active: false },
        { id: "p3", tenantId: "T", artId: A1, kind: "run", active: true },
      ],
      rtbItemAward: [
        { id: "w1", tenantId: "T", rtbItemId: "p1", cycleKey: "2026-H2", amount: 100_000 },
        { id: "w2", tenantId: "T", rtbItemId: "p2", cycleKey: "2026-H2", amount: 400_000 },
        { id: "w3", tenantId: "T", rtbItemId: "p3", cycleKey: "2026-H2", amount: 900_000 },
      ],
    });
    const m = await loadArtEpicBudgets(store.db, "T", [A1], "2026-H2", NOW);
    // Ohne den `active`-Filter stünden hier 500.000 €, ohne den Art-Filter 1,4 Mio.
    expect(m.get(A1)?.total).toBe(100_000);
  });

  it("hält Halbjahre auseinander", async () => {
    const store = budgetingStore({
      runTheBusinessItem: [
        { id: "p1", tenantId: "T", artId: A1, kind: "art_change", active: true },
      ],
      rtbItemAward: [
        { id: "w1", tenantId: "T", rtbItemId: "p1", cycleKey: "2026-H2", amount: 100_000 },
      ],
    });
    const m = await loadArtEpicBudgets(store.db, "T", [A1], "2027-H1", NOW);
    expect(m.get(A1)?.total).toBe(0);
  });

  it("spart beide Abfragen, wenn niemand gefragt ist", async () => {
    const { db, awardQuery, allocQuery } = dbWith([], []);
    const m = await loadArtEpicBudgets(db, "T", [], "2026-H2", NOW);
    expect(m.size).toBe(0);
    expect(awardQuery).not.toHaveBeenCalled();
    expect(allocQuery).not.toHaveBeenCalled();
  });

  it("trägt den Grund, warum ein Halbjahr gesperrt ist", async () => {
    const { db } = dbWith([], []);
    const offen = await loadArtEpicBudgets(db, "T", [A1], "2026-H2", NOW);
    expect(offen.get(A1)?.closedReason).toBeNull();
    const zu = await loadArtEpicBudgets(db, "T", [A1], "2020-H1", NOW);
    expect(zu.get(A1)?.closedReason).not.toBeNull();
  });

  it("ordnet Awards ohne ART niemandem zu", async () => {
    const { db } = dbWith([{ amount: 99_000, artId: null }], []);
    const m = await loadArtEpicBudgets(db, "T", [A1], "2026-H2", NOW);
    expect(m.get(A1)?.total).toBe(0);
  });
});

describe("loadArtEpicBudget — der Sonderfall der Menge", () => {
  it("gibt dieselbe Antwort wie die Menge mit einem Element", async () => {
    const { db } = dbWith([{ amount: 80_000, artId: A1 }], [{ artId: A1, amount: 25_000 }]);
    const one = await loadArtEpicBudget(db, "T", A1, "2026-H2", NOW);
    expect(one).toMatchObject({ total: 80_000, distributed: 25_000, remaining: 55_000 });
  });
});
