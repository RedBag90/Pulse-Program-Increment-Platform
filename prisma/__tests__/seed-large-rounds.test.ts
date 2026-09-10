import { describe, it, expect } from "vitest";
import {
  buildRoundPlan,
  moveAt,
  moveRequestedAt,
  type RoundsConfig,
  type PlannedEpic,
} from "../seed-large-rounds.js";
import {
  allocationRuleViolations,
  formatAllocationViolations,
  mayHoldAllocation,
  type AllocationFacts,
} from "@/modules/budgeting/domain/allocation-eligibility";
import { computeBusinessCaseTotals, parseBusinessCase } from "@/modules/work/domain/business-case";
import type { GateStep } from "@/modules/work/domain/stage-gate";

/**
 * Die Regeln der elf Anleitungen, als Prüfung.
 *
 * Der Rundenmotor ist rein — deshalb lässt sich hier ohne Datenbank prüfen, was
 * am fertigen Mandanten nur mit Mühe zu sehen wäre. Der Datensatz, den dieser
 * Motor ablöst, fiele bei mehreren dieser Tests durch: er trug Zuteilungen in
 * **einem** Zyklus, obwohl zehn Runden geschlossen waren.
 */

const CYCLES = [
  "2024-H1",
  "2024-H2",
  "2025-H1",
  "2025-H2",
  "2026-H1",
  "2026-H2",
  "2027-H1",
] as const;

const cycleStart = (key: string): Date => {
  const [y, h] = key.split("-");
  return new Date(Number(y), h === "H1" ? 0 : 6, 6);
};

const VS_WEIGHTS = [2, 2, 2, 1, 1, 0];

/** Ein Lauf mit fester Gegenwart — sonst wandert das Ergebnis mit der Uhr. */
function plan(over: Partial<RoundsConfig> = {}) {
  const cfg: RoundsConfig = {
    cycles: CYCLES,
    currentIdx: 5,
    now: new Date(2026, 8, 10),
    cycleStart,
    thresholds: [60_000, 70_000, 80_000],
    artsPerVs: 2,
    cyclePool: 2_000_000,
    rtbCycleCost: (c) => 900_000 + c * 30_000,
    artFrame: (_art, c) => 110_000 + c * 5_000,
    intakePerCycle: 22,
    valueStreamOf: (i) => VS_WEIGHTS[i % VS_WEIGHTS.length]!,
    ...over,
  };
  return buildRoundPlan(cfg);
}

const amountIn = (e: PlannedEpic, cycleKey: string): number =>
  e.tranches.filter((t) => t.cycleKey === cycleKey).reduce((s, t) => s + t.amount, 0);

describe("Rundenmotor — die Budgetregel je Runde", () => {
  /**
   * Der wichtigste Test der Datei. `allocationRuleViolations` prüft beide
   * Richtungen: Geld gibt es erst ab L3.1, und wer umsetzt, hat welches. Der
   * bisherige Seed lief diese Prüfung **nur gegen den laufenden Zyklus** — die
   * Vergangenheit sah niemand an.
   */
  it("kein Verstoss in irgendeinem Zyklus", () => {
    const p = plan();
    for (let c = 0; c <= 5; c++) {
      const cycleKey = CYCLES[c]!;
      const facts: AllocationFacts[] = p.epics
        .filter((e) => e.stepAtCycleEnd[c] != null)
        .map((e) => ({
          id: String(e.idx),
          title: `#${e.idx}`,
          step: e.stepAtCycleEnd[c] as GateStep,
          amountInCycle: amountIn(e, cycleKey),
        }));
      const violations = allocationRuleViolations(facts, cycleKey);
      expect(formatAllocationViolations(violations), cycleKey).toBe("");
    }
  });

  it("jeder gespielte Zyklus traegt Zuteilungen — nicht nur der letzte", () => {
    const p = plan();
    const withMoney = CYCLES.slice(0, 6).filter((k) => p.epics.some((e) => amountIn(e, k) > 0));
    expect(withMoney).toEqual(CYCLES.slice(0, 6));
  });

  it("kein Epic traegt Geld vor L3.1", () => {
    const p = plan();
    const early = p.epics
      .filter((e) => e.tranches.length > 0)
      .filter((e) => {
        const first = e.tranches[0]!;
        const step = e.stepAtCycleEnd[first.cycleIdx];
        return step == null || !mayHoldAllocation(step);
      })
      .map((e) => e.idx);
    expect(early).toEqual([]);
  });
});

describe("Rundenmotor — der Topf und die Reserve", () => {
  it("die Summe der Endbetraege sprengt den Topf nie", () => {
    for (const r of plan().rounds) {
      const finals = r.candidates.reduce((s, c) => s + c.final, 0);
      expect(finals + r.rtbFinal, r.cycleKey).toBeLessThanOrEqual(r.pool);
    }
  });

  it("Reserve = Topf minus Betrieb minus Endbetraege", () => {
    for (const r of plan().rounds) {
      const finals = r.candidates.reduce((s, c) => s + c.final, 0);
      expect(r.reserve, r.cycleKey).toBe(r.pool - r.rtbFinal - finals);
    }
  });

  it("die Reserve der Vorrunde steckt im Topf der naechsten", () => {
    const rounds = plan().rounds;
    for (let i = 1; i < rounds.length; i++) {
      expect(rounds[i]!.carriedReserve, rounds[i]!.cycleKey).toBe(rounds[i - 1]!.reserve);
    }
  });

  it("genau eine Runde je Halbjahr", () => {
    const keys = plan().rounds.map((r) => r.cycleKey);
    expect(keys).toEqual([...new Set(keys)]);
  });
});

describe("Rundenmotor — der Rueckkanal", () => {
  /**
   * „Wird ein Portfolio-Epic in der Runde nicht finanziert, bleibt es auf L3.1
   * stehen — nicht abgelehnt, sondern unbezahlt, und beim nächsten Zeitraum
   * wieder dabei." Ohne diesen Test ist der ganze Umbau nicht bewiesen.
   */
  it("wer leer ausgeht, tritt spaeter wieder an", () => {
    const p = plan();
    const waited = p.epics.filter((e) => e.timesPassedOver > 0);
    expect(waited.length).toBeGreaterThan(5);
    const laterFunded = waited.filter((e) => e.tranches.length > 0);
    expect(laterFunded.length).toBeGreaterThan(0);
  });

  it("laufende Epics haben Vorrang vor neuen", () => {
    for (const r of plan().rounds) {
      const firstFresh = r.candidates.findIndex((c) => !c.running);
      const lastRunning = r.candidates.map((c) => c.running).lastIndexOf(true);
      if (firstFresh >= 0 && lastRunning >= 0) {
        expect(lastRunning, r.cycleKey).toBeLessThan(firstFresh);
      }
    }
  });
});

describe("Rundenmotor — eine Zahl, drei Stellen", () => {
  it("der Richtwert ist die Summe der Kostenscheiben", () => {
    for (const e of plan().epics) {
      if (e.costSlices.length === 0) continue;
      const total = computeBusinessCaseTotals(
        parseBusinessCase({ costSlices: e.costSlices }).current,
      ).implementationCost;
      expect(e.cost, `#${e.idx}`).toBe(total);
    }
  });

  it("jeder Kandidat traegt den Richtwert seines Epics als ask", () => {
    const p = plan();
    const byIdx = new Map(p.epics.map((e) => [e.idx, e]));
    for (const r of p.rounds) {
      for (const c of r.candidates) {
        expect(c.ask, `${r.cycleKey}/#${c.epicIdx}`).toBe(byIdx.get(c.epicIdx)!.cost);
      }
    }
  });

  it("Kostenscheiben nennen nur Zyklen, die es gibt", () => {
    const known = new Set<string>(CYCLES);
    for (const e of plan().epics) {
      for (const s of e.costSlices) expect(known.has(s.period), `#${e.idx}`).toBe(true);
    }
  });

  it("eine Rate je Epic und Zyklus, aus genau einer Quelle", () => {
    for (const e of plan().epics) {
      const seen = new Set<string>();
      for (const t of e.tranches) {
        expect(seen.has(t.cycleKey), `#${e.idx} ${t.cycleKey}`).toBe(false);
        seen.add(t.cycleKey);
      }
    }
  });
});

describe("Rundenmotor — die Einordnung entsteht mit L3.1", () => {
  it("vor der Business-Case-Freigabe gibt es keine Klasse", () => {
    for (const e of plan().epics) {
      const reachedBc = e.moves.some((m) => m.to === "L3.1");
      if (!reachedBc) expect(e.epicClass, `#${e.idx}`).toBeNull();
      else expect(e.epicClass, `#${e.idx}`).not.toBeNull();
    }
  });

  it("beide Klassen kommen vor, und beide Wege zum Geld werden benutzt", () => {
    const p = plan();
    const classes = new Set(p.epics.map((e) => e.epicClass).filter((c) => c != null));
    expect([...classes].sort()).toEqual(["art", "portfolio"]);
    const sources = new Set(p.epics.flatMap((e) => e.tranches).map((t) => t.source));
    expect([...sources].sort()).toEqual(["art_epic_budget", "pb_list"]);
  });
});

describe("Rundenmotor — die Zeit", () => {
  it("kein Zug liegt in der Zukunft", () => {
    const now = new Date(2026, 8, 10).getTime();
    for (const e of plan().epics) {
      for (const m of e.moves) {
        expect(moveAt(m).getTime(), `#${e.idx} → ${m.to}`).toBeLessThanOrEqual(now);
      }
    }
  });

  it("die Zuege eines Epics stehen chronologisch", () => {
    for (const e of plan().epics) {
      for (let k = 1; k < e.moves.length; k++) {
        expect(moveRequestedAt(e.moves[k]!).getTime(), `#${e.idx}`).toBeGreaterThan(
          moveAt(e.moves[k - 1]!).getTime(),
        );
      }
    }
  });

  it("kein Epic entsteht vor seinem Zyklus oder nach seinem ersten Antrag", () => {
    const p = plan();
    for (const e of p.epics) {
      // Der Vorlauf ist die Ausnahme: diese Epics gab es vor dem Fenster.
      if (e.preexisting) {
        expect(e.createdAt.getTime(), `#${e.idx}`).toBeLessThan(cycleStart(CYCLES[0]).getTime());
      } else {
        expect(e.createdAt.getTime(), `#${e.idx}`).toBeGreaterThanOrEqual(
          cycleStart(CYCLES[e.bornCycle]!).getTime(),
        );
      }
      const first = e.moves[0];
      if (first) {
        expect(e.createdAt.getTime(), `#${e.idx}`).toBeLessThan(moveRequestedAt(first).getTime());
      }
    }
  });
});

describe("Rundenmotor — der Funnel steht", () => {
  it("jeder Reifegrad kommt vor", () => {
    const steps = new Set(plan().epics.map((e) => e.finalStep));
    for (const s of ["L0", "L1", "L2", "L3.1", "L3.2", "L4", "L4.2", "L5"]) {
      expect(steps.has(s as GateStep), s).toBe(true);
    }
  });

  it("ein Teil der Ideen findet keinen Owner und bleibt im Funnel", () => {
    const p = plan();
    const unowned = p.epics.filter((e) => e.ownerSlot == null);
    expect(unowned.length).toBeGreaterThan(0);
    for (const e of unowned) expect(e.moves, `#${e.idx}`).toEqual([]);
  });

  it("der Lauf ist deterministisch", () => {
    expect(JSON.stringify(plan())).toBe(JSON.stringify(plan()));
  });
});
