import { describe, it, expect, vi } from "vitest";

/**
 * Fake-DB-Abdeckung des geteilten PB-Listen-Loaders (F-C1). Der Kosten-Richtwert
 * kommt **allein** aus dem freigegebenen Lean Business Case (Σ costSlices).
 *
 * Bis September 2026 gab es einen zweiten Weg: ein Epic mit bloß freigegebener
 * Benefit-Hypothese landete ebenfalls auf der Liste, mit einem pauschalen
 * Tenant-Default als Richtwert. Damit budgetierte das Portfolio die *Erarbeitung*
 * des Business Case — dieser Weg ist entfallen, und mit ihm der Tenant-Default.
 */

import { loadPbList } from "@/modules/budgeting/server/services/pb-list";

function dbWith(ballot: unknown[]) {
  const findMany = vi.fn().mockResolvedValue(ballot);
  return {
    db: { initiative: { findMany } } as unknown as Parameters<typeof loadPbList>[0],
    findMany,
  };
}

const lbcEpic = (id: string, title: string, slices: number[]) => ({
  id,
  title,
  businessCase: { current: { costSlices: slices.map((amount) => ({ amount })) } },
  benefitHypothesis: null,
  businessCaseApprovedAt: new Date(),
  hypothesisApprovedAt: new Date(),
});

describe("loadPbList", () => {
  it("leitet die Kosten aus den LBC-Slices ab", async () => {
    const { db } = dbWith([lbcEpic("e1", "Alpha", [60_000, 40_000])]);
    const res = await loadPbList(db, "T");
    expect(res.ballot).toEqual([{ id: "e1", title: "Alpha", cost: 100_000 }]);
  });

  it("fragt die Datenbank nur nach Epics mit freigegebenem Business Case", async () => {
    // Die Regel steht in der Abfrage, nicht erst im Fold — sonst lüde die Liste
    // Epics, die sie danach wieder wegwerfen müsste.
    const { db, findMany } = dbWith([]);
    await loadPbList(db, "T");
    const where = findMany.mock.calls[0]![0]!.where;
    expect(where.businessCaseApprovedAt).toEqual({ not: null });
    expect(where.OR).toBeUndefined();
  });

  it("liefert eine leere PB-Liste ohne Einträge", async () => {
    const { db } = dbWith([]);
    expect((await loadPbList(db, "T")).ballot).toEqual([]);
  });
});
