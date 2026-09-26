import { describe, it, expect, vi } from "vitest";

vi.mock("@/server/services/tenant-users", () => ({
  listTenantUserLabels: async () => ({ u1: "Ada" }),
}));
vi.mock("@/server/auth/authorize", () => ({
  hasCapability: () => true,
}));

import { loadEpicNetworkModel } from "@/modules/drumbeat/server/views/epic-network-view";
import type { Principal } from "@/server/auth/principal";

/**
 * **Die Lesesicht des Epic-Netzplans** — dieselbe Kartenableitung wie die
 * Umsetzung, aber über ein Epic statt ein ART. Die Datenbank ist hier ein
 * Stand-in; die Abfragen prüft der Integrationslauf, die Ableitung dieser.
 */

const principal = { tenantId: "t1" } as unknown as Principal;

function featureRow(id: string, artId: string, piId: string | null) {
  return {
    id,
    title: `Feature ${id}`,
    status: "approved",
    piId,
    artId,
    parentId: "e1",
    ownerId: "u1",
    wsjfComputed: null,
    wsjfJobSize: 3,
    wsjfBusinessValue: null,
    wsjfTimeCriticality: null,
    wsjfRiskReduction: null,
    featureType: "enabler",
    pi: piId ? { id: piId, startDate: new Date("2026-01-01") } : null,
    art: { id: artId, name: `ART ${artId}` },
    primarySolution: null,
    parent: { id: "e1", title: "Das Epic", primarySolution: { name: "Portal" } },
    dependenciesIn: [],
    dependenciesOut: [],
  };
}

const pi = (id: string, start: string, status: string) => ({
  id,
  name: id.toUpperCase(),
  startDate: new Date(start),
  endDate: new Date(new Date(start).getTime() + 80 * 86_400_000),
  status,
});

function fakeDb(features: ReturnType<typeof featureRow>[]) {
  const piQuery = vi.fn(async () => [
    pi("p1", "2026-01-01", "completed"),
    pi("p2", "2026-04-01", "active"),
  ]);
  const db = {
    initiative: {
      findMany: vi.fn(async () => features),
      groupBy: vi.fn(async () => [{ piId: "p2", _sum: { wsjfJobSize: 7 } }]),
    },
    art: {
      findFirst: vi.fn(async ({ where }: { where: { id: string } }) => ({
        id: where.id,
        timelineId: `tl-${where.id}`,
      })),
    },
    programIncrement: { findMany: piQuery },
    artPiCapacity: { findMany: vi.fn(async () => [{ piId: "p2", capacity: 20 }]) },
    dependency: {
      findMany: vi.fn(async () => [
        {
          id: "d1",
          fromId: "x",
          toId: "a",
          type: "blocks",
          from: { id: "x", title: "Fremde Vorarbeit", parent: { title: "Anderes Epic" } },
          to: { id: "a", title: "Feature a", parent: { title: "Das Epic" } },
        },
      ]),
    },
  };
  return { db: db as never, piQuery };
}

describe("loadEpicNetworkModel", () => {
  const rows = [
    featureRow("a", "art-1", "p2"),
    featureRow("b", "art-2", "p9"), // PI einer anderen Taktung
    featureRow("c", "art-1", null), // Backlog
  ];

  it("liefert alle Features des Epics — über zwei ARTs, samt Backlog", async () => {
    const { db } = fakeDb(rows);
    const m = await loadEpicNetworkModel(db, principal, {
      epicId: "e1",
      epicArtId: "art-1",
      drumbeat: true,
    });
    expect(m.features.map((f) => f.id)).toEqual(["a", "b", "c"]);
    expect(m.features.map((f) => f.artName)).toEqual(["ART art-1", "ART art-2", "ART art-1"]);
    // Dieselbe Ableitung wie die Umsetzung: Owner, Solution des Epics, Typ.
    expect(m.features[0]).toMatchObject({
      ownerName: "Ada",
      solutionName: "Portal",
      featureType: "enabler",
    });
  });

  it("die Spalten sind die Taktung des Epic-ARTs, mit Last und Kapazität", async () => {
    const { db, piQuery } = fakeDb(rows);
    const m = await loadEpicNetworkModel(db, principal, {
      epicId: "e1",
      epicArtId: "art-1",
      drumbeat: true,
    });
    expect(piQuery).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ timelineId: "tl-art-1" }) }),
    );
    expect(m.pis.map((p) => p.id)).toEqual(["p1", "p2"]);
    expect(m.pis[1]).toMatchObject({ plannedJobSize: 7, capacity: 20, featureCount: 1 });
    expect(m.selectedPiId).toBe("p2");
    expect(m.artId).toBe("art-1");
  });

  it("der Geist trägt das Epic seines Features", async () => {
    const { db } = fakeDb(rows);
    const m = await loadEpicNetworkModel(db, principal, {
      epicId: "e1",
      epicArtId: "art-1",
      drumbeat: true,
    });
    expect(m.dependencies).toEqual([
      expect.objectContaining({
        id: "d1",
        offScopeRole: "from",
        offScopeLabel: "Fremde Vorarbeit",
        offScopeEpicTitle: "Anderes Epic",
      }),
    ]);
  });

  it("ohne Epic-ART gilt das ART der meisten Features", async () => {
    const { db } = fakeDb(rows);
    const m = await loadEpicNetworkModel(db, principal, {
      epicId: "e1",
      epicArtId: null,
      drumbeat: true,
    });
    expect(m.artId).toBe("art-1");
  });

  it("ohne Drumbeat keine PIs — nur die Backlog-Spalte", async () => {
    const { db, piQuery } = fakeDb(rows);
    const m = await loadEpicNetworkModel(db, principal, {
      epicId: "e1",
      epicArtId: "art-1",
      drumbeat: false,
    });
    expect(piQuery).not.toHaveBeenCalled();
    expect(m.pis).toEqual([]);
    expect(m.features).toHaveLength(3);
  });
});
