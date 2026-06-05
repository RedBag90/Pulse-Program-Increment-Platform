import { describe, it, expect, vi } from "vitest";
import { backfillSprints, type BackfillPi, type BackfillTeam } from "../sprint-backfill";

/**
 * Sprint Backfill — tested at its interface (the cartesian-product write seam),
 * not through callers. A fake `tx` records the data passed to `createMany` so
 * the test can assert on shape + counts without a real Postgres connection.
 */

function fakeTx() {
  const calls: { piId: string; teamIds: string[] }[] = [];
  return {
    tx: {
      sprint: {
        createMany: vi.fn(async ({ data }: { data: Array<{ piId: string; teamId: string }> }) => {
          const piId = data[0]?.piId ?? "";
          calls.push({ piId, teamIds: data.map((r) => r.teamId) });
          return { count: data.length };
        }),
      },
    } as unknown as Parameters<typeof backfillSprints>[0],
    calls,
  };
}

const pi = (id: string, startDate: string, endDate: string): BackfillPi => ({
  id,
  startDate: new Date(startDate),
  endDate: new Date(endDate),
});
const team = (id: string): BackfillTeam => ({ id });

describe("backfillSprints", () => {
  it("returns 0 when no PIs are passed", async () => {
    const { tx, calls } = fakeTx();
    const result = await backfillSprints(tx, "T", [], [team("t1")]);
    expect(result).toEqual({ created: 0 });
    expect(calls).toHaveLength(0);
  });

  it("returns 0 when no teams are passed", async () => {
    const { tx, calls } = fakeTx();
    const result = await backfillSprints(tx, "T", [pi("p1", "2026-01-01", "2026-03-31")], []);
    expect(result).toEqual({ created: 0 });
    expect(calls).toHaveLength(0);
  });

  it("writes one createMany per PI and folds the counts", async () => {
    const { tx, calls } = fakeTx();
    const result = await backfillSprints(
      tx,
      "T",
      [pi("p1", "2026-01-01", "2026-03-31"), pi("p2", "2026-04-01", "2026-06-30")],
      [team("t1"), team("t2"), team("t3")],
    );
    expect(calls).toHaveLength(2);
    // Every batch covers all (sprintIndex × team) cells for its PI; the test
    // doesn't pin the sprint count (that's `generateSprints`' rule), but each
    // PI's batch must include every team.
    for (const c of calls) {
      expect(new Set(c.teamIds).size).toBe(3);
    }
    expect(result.created).toBe(calls.reduce((s, c) => s + c.teamIds.length, 0));
  });

  it("tags every written row with the caller's tenantId", async () => {
    const seen: string[] = [];
    const tx = {
      sprint: {
        createMany: vi.fn(async ({ data }: { data: Array<{ tenantId: string }> }) => {
          for (const r of data) seen.push(r.tenantId);
          return { count: data.length };
        }),
      },
    } as unknown as Parameters<typeof backfillSprints>[0];
    await backfillSprints(tx, "T-42", [pi("p1", "2026-01-01", "2026-03-31")], [team("t1")]);
    expect(seen.every((id) => id === "T-42")).toBe(true);
  });
});
