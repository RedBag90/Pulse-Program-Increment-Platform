import { describe, it, expect, vi } from "vitest";

/**
 * Pure-write coverage of the `detachArtFromTimeline` rules (exercised through
 * the exported `leaveArtFromTimeline`) with a fake Prisma transaction client.
 * After the Team/PiObjective removal the only cleanup left is unassigning the
 * ART's Features from the Timeline's PIs.
 */

import { leaveArtFromTimeline } from "@/modules/drumbeat/server/services/timeline";
import type { ArtId } from "@/modules/core/kernel/domain/types";

type Captured = { table: string; where: unknown };

function fakeContext(opts: { artTimelineId: string | null; pisOnTimeline: string[] }) {
  const writes: Captured[] = [];
  const tx = {
    art: {
      findFirst: vi.fn(async () => ({ id: "A1", timelineId: opts.artTimelineId })),
      update: vi.fn(async () => undefined),
    },
    programIncrement: {
      findMany: vi.fn(async () => opts.pisOnTimeline.map((id) => ({ id }))),
    },
    initiative: {
      updateMany: vi.fn(async ({ where }: { where: unknown }) => {
        writes.push({ table: "initiative", where });
        return { count: 3 };
      }),
    },
    auditEvent: { create: vi.fn(async () => ({})) },
  };

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

describe("detachArtFromTimeline — feature unassignment", () => {
  it("unassigns the ART's Features from the Timeline PIs and returns the count", async () => {
    const { ctx, writes } = fakeContext({ artTimelineId: "tl-1", pisOnTimeline: ["pi-1", "pi-2"] });

    const result = await leaveArtFromTimeline(ctx, { artId: "A1" as ArtId });
    expect(result.ok).toBe(true);

    const initWrite = writes.find((w) => w.table === "initiative");
    expect(initWrite).toBeDefined();
    expect(initWrite!.where).toEqual({ tenantId: "T", artId: "A1", piId: { in: ["pi-1", "pi-2"] } });
    if (result.ok) expect(result.value.featuresUnassigned).toBe(3);
  });

  it("short-circuits when the Timeline has no PIs (no feature write)", async () => {
    const { ctx, writes } = fakeContext({ artTimelineId: "tl-1", pisOnTimeline: [] });
    await leaveArtFromTimeline(ctx, { artId: "A1" as ArtId });
    expect(writes.find((w) => w.table === "initiative")).toBeUndefined();
  });

  it("is a no-op (zero counts) when the ART has no Timeline at all", async () => {
    const { ctx, writes } = fakeContext({ artTimelineId: null, pisOnTimeline: ["pi-1"] });

    const result = await leaveArtFromTimeline(ctx, { artId: "A1" as ArtId });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({ sprintsRemoved: 0, featuresUnassigned: 0 });
    }
    expect(writes).toHaveLength(0);
  });
});
