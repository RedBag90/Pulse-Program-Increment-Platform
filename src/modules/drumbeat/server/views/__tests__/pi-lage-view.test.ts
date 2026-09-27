import { describe, it, expect, vi } from "vitest";

vi.mock("@/server/services/tenant-users", () => ({
  listTenantUserLabels: async () => ({ u1: "lena@pulse.dev" }),
}));

import { loadPiLage } from "@/modules/drumbeat/server/views/pi-lage-view";
import type { TenantId } from "@/modules/core/kernel/domain/types";

/**
 * **Der Lage-Lader** mit gefälschter Datenbank: blockiert-seit aus dem
 * jüngsten Audit, „wartet" nur auf offene Vorgänger, Risiken ohne „resolved".
 */
const D = (s: string) => new Date(`${s}T00:00:00Z`);

function fakeDb() {
  const issueFind = vi.fn(async () => [
    {
      id: "i1",
      title: "Security-Freigabe",
      roamStatus: "open",
      probability: null,
      impact: null,
      targetResolutionDate: null,
      ownerId: null,
      initiativeId: "f-block",
    },
    {
      id: "i2",
      title: "Lizenzkosten",
      roamStatus: "owned",
      probability: null,
      impact: null,
      targetResolutionDate: D("2026-09-20"),
      ownerId: "u1",
      initiativeId: null,
    },
  ]);
  const db = {
    programIncrement: {
      findFirst: vi.fn(async ({ where }: { where: { id?: string } }) =>
        where.id
          ? {
              id: "pi",
              name: "PI 2026.3",
              status: "active",
              startDate: D("2026-08-30"),
              endDate: D("2026-11-07"),
              timelineId: "tl",
              systemDemoAt: null,
            }
          : { id: "pi-next", name: "PI 2026.4" },
      ),
    },
    initiative: {
      findMany: vi.fn(async () => [
        {
          id: "f-block",
          title: "Zahlungsdienst",
          status: "blocked",
          wsjfJobSize: 5,
          wsjfBusinessValue: 8,
          completedAt: null,
          updatedAt: D("2026-09-21"),
          ownerId: "u1",
        },
        {
          id: "f-wait",
          title: "SLA-Ampel",
          status: "approved",
          wsjfJobSize: 3,
          wsjfBusinessValue: 5,
          completedAt: null,
          updatedAt: D("2026-09-20"),
          ownerId: null,
        },
        {
          id: "f-done",
          title: "Routing",
          status: "completed",
          wsjfJobSize: 3,
          wsjfBusinessValue: 8,
          completedAt: D("2026-09-07"),
          updatedAt: D("2026-09-07"),
          ownerId: null,
        },
      ]),
      count: vi.fn(async () => 18),
    },
    auditEvent: {
      findMany: vi.fn(async ({ where }: { where: { action: string } }) =>
        where.action === "feature.delivery.transitioned"
          ? [
              // jüngster zuerst (orderBy desc)
              {
                resourceId: "f-block",
                occurredAt: D("2026-09-21"),
                changes: { status: { after: "blocked" }, reason: { after: "Wartet auf Security" } },
              },
              {
                resourceId: "f-block",
                occurredAt: D("2026-09-02"),
                changes: { status: { after: "blocked" }, reason: { after: "alt" } },
              },
            ]
          : [],
      ),
    },
    issue: { findMany: issueFind },
  };
  return { db, issueFind };
}

describe("loadPiLage", () => {
  it("blockiert seit und Grund aus dem jüngsten Wechsel nach „blockiert“", async () => {
    const { db } = fakeDb();
    const lage = await loadPiLage(
      db as never,
      "T" as TenantId,
      { piId: "pi", artId: "art" },
      D("2026-09-27"),
    );
    const block = lage!.attention.find((a) => a.feature.id === "f-block")!;
    expect(block).toMatchObject({ days: 6 });
    expect(block.feature.blockedReason).toBe("Wartet auf Security");
    expect(block.feature.ownerName).toBe("lena@pulse.dev");
  });

  it("nur Blockierte brauchen Hilfe", async () => {
    const { db } = fakeDb();
    const lage = await loadPiLage(
      db as never,
      "T" as TenantId,
      { piId: "pi", artId: "art" },
      D("2026-09-27"),
    );
    expect(lage!.attention.map((a) => a.feature.id)).toEqual(["f-block"]);
  });

  it("Risiken: PI oder seine Features, ohne „resolved“, nicht ge-ROAM-te zuerst", async () => {
    const { db, issueFind } = fakeDb();
    const lage = await loadPiLage(
      db as never,
      "T" as TenantId,
      { piId: "pi", artId: "art" },
      D("2026-09-27"),
    );
    const where = (issueFind.mock.calls[0] as unknown as [{ where: Record<string, unknown> }])[0]
      .where;
    expect(where).toMatchObject({ roamStatus: { not: "resolved" }, deletedAt: null });
    expect(where.OR).toEqual([
      { piId: "pi" },
      { initiativeId: { in: ["f-block", "f-wait", "f-done"] } },
    ]);
    expect(lage!.risks.map((r) => [r.id, r.overdue, r.featureTitle])).toEqual([
      ["i1", false, "Zahlungsdienst"],
      ["i2", true, null],
    ]);
  });

  it("Wert und nächster PI", async () => {
    const { db } = fakeDb();
    const lage = await loadPiLage(
      db as never,
      "T" as TenantId,
      { piId: "pi", artId: "art" },
      D("2026-09-27"),
    );
    expect(lage!.value).toEqual({ plannedBv: 21, deliveredBv: 8 });
    expect(lage!.nextPi).toEqual({ name: "PI 2026.4", featureCount: 18 });
  });
});
