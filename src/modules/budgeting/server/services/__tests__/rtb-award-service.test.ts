import { describe, it, expect } from "vitest";
import { budgetingStore } from "@/test/fakes/budgeting-store";
import { loadRtbAwards } from "@/modules/budgeting/server/services/rtb-award-service";
import type { TenantId } from "@/modules/core/kernel/domain/types";

/**
 * Der Zuspruch einer Position ist eine **Entscheidung**, keine Rechnung.
 *
 * Die Vorbelegung existiert nur, solange niemand entschieden hat. Danach
 * erschien eine neu angelegte Position mit einem Anteil, den ihr niemand
 * zugesprochen hatte — gemeldet aus der Praxis: der Solution Manager legt eine
 * Antragszeile an, und im Wertstrom steht sofort ein Betrag.
 */

const T = "t1" as unknown as TenantId;
const VS = "vs1";
const CYCLE = "2026-H1";
// Innerhalb des Fensters, damit `closedReason` die Sicht nicht schließt.
const NOW = new Date("2026-02-01T00:00:00Z");

function item(id: string, ask: number) {
  return {
    id,
    tenantId: T,
    valueStreamId: VS,
    artId: null,
    name: id,
    kind: "run",
    active: true,
    plannedAmount: ask,
    interval: "half_yearly",
  };
}

function store(opts: {
  items: ReturnType<typeof item>[];
  awarded: number | null;
  saved?: Record<string, number>;
}) {
  return budgetingStore({
    runTheBusinessItem: opts.items,
    budgetRound: [{ id: "r1", tenantId: T, cycleKey: CYCLE }],
    budgetCandidate:
      opts.awarded == null
        ? []
        : [
            {
              id: "c1",
              tenantId: T,
              kind: "rtb",
              valueStreamId: VS,
              roundId: "r1",
              finalAmount: opts.awarded,
            },
          ],
    rtbItemAward: Object.entries(opts.saved ?? {}).map(([rtbItemId, amount], n) => ({
      id: `a${n}`,
      tenantId: T,
      rtbItemId,
      cycleKey: CYCLE,
      amount,
    })),
  });
}

const amounts = (view: Awaited<ReturnType<typeof loadRtbAwards>>) =>
  Object.fromEntries(view.rows.map((r) => [r.rtbItemId, r.amount]));

describe("loadRtbAwards", () => {
  it("belegt anteilig vor, solange nichts aufgeteilt ist", async () => {
    const { db } = store({ items: [item("A", 60_000), item("B", 40_000)], awarded: 50_000 });
    const view = await loadRtbAwards(db, T, VS, CYCLE, NOW);
    expect(view.saved).toBe(false);
    expect(amounts(view)).toEqual({ A: 30_000, B: 20_000 });
  });

  it("laesst eine nachtraeglich angelegte Position auf 0", async () => {
    const { db } = store({
      items: [item("A", 60_000), item("B", 40_000), item("NEU", 25_000)],
      awarded: 50_000,
      saved: { A: 30_000, B: 20_000 },
    });
    const view = await loadRtbAwards(db, T, VS, CYCLE, NOW);
    // Vorher erbte NEU einen Anteil der Vorbelegung.
    expect(amounts(view)).toEqual({ A: 30_000, B: 20_000, NEU: 0 });
  });

  it("haelt die angezeigte Summe innerhalb des Zuspruchs", async () => {
    const { db } = store({
      items: [item("A", 60_000), item("B", 40_000), item("NEU", 25_000)],
      awarded: 50_000,
      saved: { A: 30_000, B: 20_000 },
    });
    const view = await loadRtbAwards(db, T, VS, CYCLE, NOW);
    const sum = view.rows.reduce((s, r) => s + r.amount, 0);
    expect(sum).toBeLessThanOrEqual(view.awarded ?? 0);
  });

  it("zeigt 0, wenn die Kachel nichts zugesprochen hat", async () => {
    const { db } = store({ items: [item("A", 60_000)], awarded: null });
    const view = await loadRtbAwards(db, T, VS, CYCLE, NOW);
    expect(view.awarded).toBeNull();
    expect(amounts(view)).toEqual({ A: 0 });
  });
});
