import { describe, it, expect, vi } from "vitest";

/**
 * Fake-DB-Abdeckung des geteilten PB-Listen-Loaders (F-C1). Der Kosten-Richtwert wird
 * aus den Artefakten abgeleitet: approved Lean Business Case → Σ costSlices; sonst
 * approved Benefit-Hypothese → tenant-Default-Aufwand (Fallback `DEFAULT_HYPOTHESIS_EFFORT`).
 * Ein `initiative.findMany` (PB-Liste) + `tenant.findUnique` (Default) reichen.
 */

import { loadPbList } from "@/modules/budgeting/server/services/pb-list";
import { DEFAULT_HYPOTHESIS_EFFORT } from "@/modules/work/domain/pb-submission";

function dbWith(ballot: unknown[], defaultEffort: number | null) {
  return {
    initiative: { findMany: vi.fn().mockResolvedValue(ballot) },
    tenant: { findUnique: vi.fn().mockResolvedValue({ defaultHypothesisEffort: defaultEffort }) },
  } as unknown as Parameters<typeof loadPbList>[0];
}

const lbcEpic = (id: string, title: string, slices: number[]) => ({
  id,
  title,
  businessCase: { current: { costSlices: slices.map((amount) => ({ amount })) } },
  benefitHypothesis: null,
  businessCaseApprovedAt: new Date(),
  hypothesisApprovedAt: new Date(),
});

const hypothesisEpic = (id: string, title: string) => ({
  id,
  title,
  businessCase: null,
  benefitHypothesis: { current: { measuresHypothesis: "H" } },
  businessCaseApprovedAt: null,
  hypothesisApprovedAt: new Date(),
});

describe("loadPbList", () => {
  it("leitet Kosten aus LBC-Slices ab, Hypothese-only nutzt den Tenant-Default", async () => {
    const db = dbWith(
      [lbcEpic("e1", "Alpha", [60_000, 40_000]), hypothesisEpic("e2", "Beta")],
      55_000,
    );

    const res = await loadPbList(db, "T");

    expect(res.ballot).toEqual([
      { id: "e1", title: "Alpha", cost: 100_000 },
      { id: "e2", title: "Beta", cost: 55_000 },
    ]);
    // Pflichtvorhaben-Konzept entfällt.
    expect(res.mandatoryCount).toBe(0);
    expect(res.mandatorySum).toBe(0);
  });

  it("fällt ohne Tenant-Default auf den Code-Fallback zurück", async () => {
    const db = dbWith([hypothesisEpic("e1", "Alpha")], null);

    const res = await loadPbList(db, "T");

    expect(res.ballot).toEqual([{ id: "e1", title: "Alpha", cost: DEFAULT_HYPOTHESIS_EFFORT }]);
  });

  it("liefert leeres PB-Liste und Summe 0 ohne Einträge", async () => {
    const res = await loadPbList(dbWith([], 50_000), "T");
    expect(res.ballot).toEqual([]);
    expect(res.mandatoryCount).toBe(0);
    expect(res.mandatorySum).toBe(0);
  });
});
