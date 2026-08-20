import { describe, it, expect, vi } from "vitest";

/**
 * Pure-write coverage of the DB-side PI-lifecycle invariants — exercised through
 * the real services with a fake Prisma transaction client (no test DB needed,
 * same pattern as `detach-art-from-timeline.test.ts`). The pure *rules*
 * (`canTransition`, `nextPiFromCadence`) are unit-tested in the domain; this
 * pins their *wiring*: the one-active-PI guard, the advance-cadence
 * create-or-activate branch, and the delete cascade.
 */

import { startPi, deletePi, advanceCadence } from "@/modules/drumbeat/server/services/pi";
import type { PiId } from "@/modules/core/kernel/domain/types";

type Tx = Record<string, Record<string, ReturnType<typeof vi.fn>>>;

/** ctx whose `db.$transaction` runs the callback against the supplied fake tx. */
function ctxWith(tx: Tx) {
  return {
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
  } as unknown as Parameters<typeof startPi>[0];
}

const D = (s: string) => new Date(s);

describe("startPi — one-active-PI-per-Timeline guard", () => {
  function tx(existing: unknown, otherActive: unknown): Tx {
    return {
      programIncrement: {
        findFirst: vi.fn(async ({ where }: { where: { status?: string } }) =>
          where.status === "active" ? otherActive : existing,
        ),
        update: vi.fn(async () => ({})),
      },
      auditEvent: { create: vi.fn(async () => ({})) },
    };
  }

  it("rejects starting when another PI is already active on the Timeline", async () => {
    const t = tx(
      { id: "pi1", status: "planned", timelineId: "tl", name: "PI 1" },
      { id: "pi0", name: "PI 0" },
    );
    const result = await startPi(ctxWith(t), { id: "pi1" as PiId });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("conflict");
      expect(result.error).toMatchObject({ reason: expect.stringContaining("bereits") });
    }
    expect(t.programIncrement!.update).not.toHaveBeenCalled();
  });

  it("rejects starting a non-planned PI (pure transition rule)", async () => {
    const t = tx({ id: "pi1", status: "active", timelineId: "tl", name: "PI 1" }, null);
    const result = await startPi(ctxWith(t), { id: "pi1" as PiId });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("conflict");
    expect(t.programIncrement!.update).not.toHaveBeenCalled();
  });

  it("activates a planned PI when no sibling is active", async () => {
    const t = tx({ id: "pi1", status: "planned", timelineId: "tl", name: "PI 1" }, null);
    const result = await startPi(ctxWith(t), { id: "pi1" as PiId });
    expect(result.ok).toBe(true);
    expect(t.programIncrement!.update).toHaveBeenCalledWith({
      where: { id: "pi1" },
      data: { status: "active" },
    });
  });
});

describe("deletePi — planned-only + cascade", () => {
  function tx(pi: unknown): Tx {
    return {
      programIncrement: {
        findFirst: vi.fn(async () => pi),
        delete: vi.fn(async () => ({})),
      },
      initiative: { updateMany: vi.fn(async () => ({ count: 2 })) },
      issue: { updateMany: vi.fn(async () => ({ count: 1 })) },
      auditEvent: { create: vi.fn(async () => ({})) },
    };
  }

  it("refuses to delete a non-planned PI (no cascade)", async () => {
    const t = tx({ id: "pi1", status: "active" });
    const result = await deletePi(ctxWith(t), { id: "pi1" as PiId });
    expect(result.ok).toBe(false);
    expect(t.initiative!.updateMany).not.toHaveBeenCalled();
    expect(t.programIncrement!.delete).not.toHaveBeenCalled();
  });

  it("returns features to the backlog and detaches issues, then deletes", async () => {
    const t = tx({ id: "pi1", status: "planned" });
    const result = await deletePi(ctxWith(t), { id: "pi1" as PiId });
    expect(result.ok).toBe(true);
    expect(t.initiative!.updateMany).toHaveBeenCalledWith({
      where: { tenantId: "T", piId: "pi1" },
      data: { piId: null },
    });
    expect(t.issue!.updateMany).toHaveBeenCalledWith({
      where: { tenantId: "T", piId: "pi1" },
      data: { piId: null },
    });
    expect(t.programIncrement!.delete).toHaveBeenCalledWith({ where: { id: "pi1" } });
  });
});

describe("advanceCadence — complete active + open next", () => {
  function tx(active: unknown, siblings: unknown[], created?: unknown): Tx {
    return {
      programIncrement: {
        findFirst: vi.fn(async () => active),
        findMany: vi.fn(async () => siblings),
        update: vi.fn(async () => ({})),
        create: vi.fn(async () => created ?? { id: "new", name: "PI neu" }),
      },
      art: { findMany: vi.fn(async () => []) },
      issue: { count: vi.fn(async () => 0) },
      auditEvent: { create: vi.fn(async () => ({})) },
    };
  }

  const active = {
    id: "a",
    status: "active",
    timelineId: "tl",
    name: "PI 1",
    startDate: D("2026-01-01"),
  };

  it("activates an existing later PI without creating a new one", async () => {
    const siblings = [
      { id: "a", name: "PI 1", startDate: D("2026-01-01"), endDate: D("2026-03-31") },
      { id: "b", name: "PI 2", startDate: D("2026-04-01"), endDate: D("2026-06-30") },
    ];
    const t = tx(active, siblings);
    const result = await advanceCadence(ctxWith(t), { piId: "a" as PiId });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.to).toBe("PI 2");
    expect(t.programIncrement!.create).not.toHaveBeenCalled();
    // active completed, next activated
    expect(t.programIncrement!.update).toHaveBeenCalledWith({
      where: { id: "a" },
      data: { status: "completed" },
    });
    expect(t.programIncrement!.update).toHaveBeenCalledWith({
      where: { id: "b" },
      data: { status: "active" },
    });
  });

  it("creates the next PI from cadence when none is scheduled after the active one", async () => {
    const siblings = [{ id: "a", name: "PI 1", startDate: D("2026-01-01"), endDate: D("2026-03-31") }];
    const t = tx(active, siblings, { id: "c", name: "PI 2" });
    const result = await advanceCadence(ctxWith(t), { piId: "a" as PiId });
    expect(result.ok).toBe(true);
    expect(t.programIncrement!.create).toHaveBeenCalledTimes(1);
    expect(t.programIncrement!.update).toHaveBeenCalledWith({
      where: { id: "c" },
      data: { status: "active" },
    });
  });

  it("refuses to advance a non-active PI", async () => {
    const t = tx({ id: "a", status: "planned", timelineId: "tl", name: "PI 1" }, []);
    const result = await advanceCadence(ctxWith(t), { piId: "a" as PiId });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("conflict");
    expect(t.programIncrement!.update).not.toHaveBeenCalled();
  });
});
