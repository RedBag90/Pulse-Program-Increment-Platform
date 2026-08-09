import { describe, it, expect, vi } from "vitest";

/**
 * Pure-write coverage of the `detachArtFromTimeline` rules: which writes
 * happen, against what filter, for a given (Timeline, ART, teams) input.
 * Cannot import the helper directly (it's a file-private function), so we
 * stand up the same flow through the exported `leaveArtFromTimeline`-shaped
 * call surface with a fake Prisma transaction client.
 *
 * Focus: the **PiObjective deletion that ADR-0005 flagged as open** — assert
 * the (piIds × teamIds) filter is exact and a sibling-ART's objective row
 * survives.
 */

import { leaveArtFromTimeline } from "@/server/services/timeline";
import type { ArtId } from "@/modules/core/kernel/domain/types";

type Captured = { table: string; where: unknown };

function fakeContext(opts: {
  artTimelineId: string | null;
  artTeamIds: string[];
  pisOnTimeline: string[];
}) {
  const writes: Captured[] = [];
  const tx = {
    art: {
      findFirst: vi.fn(async () => ({
        id: "A1",
        timelineId: opts.artTimelineId,
        teams: opts.artTeamIds.map((id) => ({ id })),
      })),
      update: vi.fn(async () => undefined),
    },
    programIncrement: {
      findMany: vi.fn(async () => opts.pisOnTimeline.map((id) => ({ id }))),
    },
    sprint: {
      findMany: vi.fn(async () => [{ id: "S1" }]),
      deleteMany: vi.fn(async ({ where }) => {
        writes.push({ table: "sprint", where });
        return { count: 1 };
      }),
    },
    initiative: {
      updateMany: vi.fn(async ({ where }) => {
        writes.push({ table: "initiative", where });
        return { count: 1 };
      }),
    },
    piObjective: {
      deleteMany: vi.fn(async ({ where }) => {
        writes.push({ table: "piObjective", where });
        return { count: 2 };
      }),
    },
    auditEvent: { create: vi.fn(async () => ({})) },
  };

  // Drive the call through `withAuditedTransaction` shim: we patch the import
  // by intercepting Prisma's `$transaction` at the ctx.db layer.
  const ctx = {
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
  } as unknown as Parameters<typeof leaveArtFromTimeline>[0];

  return { ctx, tx, writes };
}

describe("detachArtFromTimeline — PiObjective cleanup (ADR-0005)", () => {
  it("deletes PiObjectives scoped to (Timeline-PIs × leaving-ART-teams)", async () => {
    const { ctx, writes } = fakeContext({
      artTimelineId: "tl-1",
      artTeamIds: ["t-a", "t-b"],
      pisOnTimeline: ["pi-1", "pi-2"],
    });

    const result = await leaveArtFromTimeline(ctx, { artId: "A1" as ArtId });
    expect(result.ok).toBe(true);

    const piObjectiveDelete = writes.find((w) => w.table === "piObjective");
    expect(piObjectiveDelete).toBeDefined();
    expect(piObjectiveDelete!.where).toEqual({
      tenantId: "T",
      piId: { in: ["pi-1", "pi-2"] },
      teamId: { in: ["t-a", "t-b"] },
    });
  });

  it("short-circuits when the ART has no teams (no PiObjective delete)", async () => {
    const { ctx, writes } = fakeContext({
      artTimelineId: "tl-1",
      artTeamIds: [],
      pisOnTimeline: ["pi-1"],
    });

    await leaveArtFromTimeline(ctx, { artId: "A1" as ArtId });
    expect(writes.find((w) => w.table === "piObjective")).toBeUndefined();
  });

  it("short-circuits when the Timeline has no PIs (no PiObjective delete)", async () => {
    const { ctx, writes } = fakeContext({
      artTimelineId: "tl-1",
      artTeamIds: ["t-a"],
      pisOnTimeline: [],
    });

    await leaveArtFromTimeline(ctx, { artId: "A1" as ArtId });
    expect(writes.find((w) => w.table === "piObjective")).toBeUndefined();
  });

  it("returns the objectivesRemoved count in the Result for the audit changeset", async () => {
    const { ctx } = fakeContext({
      artTimelineId: "tl-1",
      artTeamIds: ["t-a"],
      pisOnTimeline: ["pi-1"],
    });

    const result = await leaveArtFromTimeline(ctx, { artId: "A1" as ArtId });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.objectivesRemoved).toBe(2);
    }
  });

  it("is a no-op (zero counts) when the ART has no Timeline at all", async () => {
    const { ctx, writes } = fakeContext({
      artTimelineId: null,
      artTeamIds: ["t-a"],
      pisOnTimeline: ["pi-1"],
    });

    const result = await leaveArtFromTimeline(ctx, { artId: "A1" as ArtId });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({
        sprintsRemoved: 0,
        featuresUnassigned: 0,
        objectivesRemoved: 0,
      });
    }
    expect(writes).toHaveLength(0);
  });
});
