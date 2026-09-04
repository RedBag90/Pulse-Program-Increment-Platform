import { describe, it, expect, vi } from "vitest";
import { getEpicAllocationMaps } from "@/modules/budgeting/server/services/epic-allocation";

/**
 * Der Port, über den das Portfolio-Dashboard die Zuteilungen bezieht. Er
 * existiert, damit `work` die Tabelle nicht selbst liest — und damit der
 * Composition-Root ihn weglassen kann, wenn der Mandant Budgeting nicht
 * lizenziert hat.
 */
function dbWith(rows: { epicId: string; allocations: unknown }[]) {
  return {
    budgetAllocation: { findMany: vi.fn(async () => rows) },
  } as unknown as Parameters<typeof getEpicAllocationMaps>[0];
}

describe("getEpicAllocationMaps", () => {
  it("gibt je Epic die vollständige Halbjahres-Karte", async () => {
    const out = await getEpicAllocationMaps(
      dbWith([
        { epicId: "e1", allocations: { "2026-H1": 120_000, "2026-H2": 80_000 } },
        { epicId: "e2", allocations: { "2026-H1": 50_000 } },
      ]),
      "t1" as never,
    );
    expect(out).toEqual({
      e1: { "2026-H1": 120_000, "2026-H2": 80_000 },
      e2: { "2026-H1": 50_000 },
    });
  });

  it("lässt Epics ohne Zuteilung ganz weg", async () => {
    // Ein leerer Eintrag und ein fehlender wären zwei Darstellungen desselben
    // Zustands — der Aufrufer prüft auf Vorhandensein.
    const out = await getEpicAllocationMaps(
      dbWith([
        { epicId: "leer", allocations: {} },
        { epicId: "null", allocations: null },
        { epicId: "voll", allocations: { "2026-H1": 1 } },
      ]),
      "t1" as never,
    );
    expect(Object.keys(out)).toEqual(["voll"]);
  });

  it("verwirft kaputte Zellen, statt die Zeile fallenzulassen", async () => {
    const out = await getEpicAllocationMaps(
      dbWith([{ epicId: "e1", allocations: { "2026-H1": 100, "2026-H2": "viel", x: null } }]),
      "t1" as never,
    );
    expect(out.e1).toEqual({ "2026-H1": 100 });
  });
});
