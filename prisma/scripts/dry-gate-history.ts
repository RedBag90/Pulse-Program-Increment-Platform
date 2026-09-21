/* eslint-disable no-console */
/**
 * Trockenlauf der **Tor-Historien**: faltet für jedes Epic des Bauplans die
 * Anträge und Abnahmen, genau wie der Seed es tut, und lässt
 * `assertGateHistory` darüber laufen. Schreibt nichts.
 *
 * Der Sinn: `assertGateHistory` ist die schärfste Prüfung im ganzen Seed — ein
 * offener Antrag zu viel, ein Datum in der Zukunft, eine Kette, die nicht
 * chronologisch steht, und der Lauf bricht ab. Das will man vor dem Schreiben
 * wissen, nicht mittendrin.
 */
import { buildRoundPlan, moveAt, type RoundsConfig } from "../seed-large-rounds.js";
import {
  assertGateHistory,
  buildGateHistory,
  gateRuleRows,
  type GateMove,
} from "../seed-gate-history.js";
import { nextGate, previousGate } from "@/modules/work/domain/gate-readiness";

const DAY = 86_400_000;
const realNow = new Date();
const HALF_IDX = realNow.getFullYear() * 2 + (realNow.getMonth() < 6 ? 0 : 1);
const keyOfHalf = (h: number): string => `${Math.floor(h / 2)}-H${(h % 2) + 1}`;
const cycles = Array.from({ length: 7 }, (_, k) => keyOfHalf(HALF_IDX - 5 + k));
const cycleStart = (key: string): Date => {
  const [y, h] = key.split("-");
  return new Date(Number(y), h === "H1" ? 0 : 6, 6);
};
const addDays = (b: Date, d: number): Date => new Date(b.getTime() + d * DAY);
const now = new Date(Math.min(realNow.getTime(), cycleStart(cycles[5]!).getTime() + 55 * DAY));
const VS_WEIGHTS = [2, 2, 2, 1, 1, 0];
const ART_FRAME = (c: number): number => 110_000 + c * 5_000;
const RUN_COST = (c: number): number => 300_000 + c * 12_000;

const cfg: RoundsConfig = {
  cycles,
  currentIdx: 5,
  now,
  cycleStart,
  thresholds: [60_000, 70_000, 80_000],
  artsPerVs: 2,
  cyclePool: 2_000_000,
  rtbCycleCost: (c) => RUN_COST(c) + 6 * ART_FRAME(c),
  artFrame: (_a, c) => ART_FRAME(c),
  intakePerCycle: 22,
  valueStreamOf: (i) => VS_WEIGHTS[i % VS_WEIGHTS.length]!,
};

const plan = buildRoundPlan(cfg);
const rules = gateRuleRows(null);
const U = {
  admin: "00000000-0000-4000-8000-000000000001",
  owner: "00000000-0000-4000-8000-000000000002",
  vmo: "00000000-0000-4000-8000-000000000003",
  fo: "00000000-0000-4000-8000-000000000004",
  pm: "00000000-0000-4000-8000-000000000005",
  vso: "00000000-0000-4000-8000-000000000006",
  rte: "00000000-0000-4000-8000-000000000007",
};
const pad = (n: number): string => `0000${n}`.slice(-5);

let extrasCount = 0;
const kinds: Record<string, number> = {};
for (const pe of plan.epics) {
  const i = pe.idx;
  const target = pe.finalStep;
  const owned = pe.ownerSlot != null;
  const lastMove = pe.moves[pe.moves.length - 1];
  const after = (d: number): Date =>
    new Date(
      Math.max(addDays(realNow, d).getTime(), lastMove ? moveAt(lastMove).getTime() + 2 * DAY : 0),
    );
  const extras: GateMove[] = [];
  const nextStep = nextGate(target);
  if (nextStep && owned) {
    if (i % 6 === 0) {
      const overdue = i % 18 === 0;
      extras.push({
        kind: "open",
        to: nextStep,
        requestedAt: after(overdue ? -30 - (i % 7) : -6 - (i % 4)),
        decidedRoles: ["epic.party.architect", "epic.party.finance"],
        decidedAt: after(overdue ? -24 : -3),
      });
    } else if (i % 7 === 3) {
      extras.push({
        kind: "rejected",
        to: nextStep,
        requestedAt: after(-38),
        decidedAt: after(-34),
        reason: "Die Einsparung ist nicht belegt.",
      });
    } else if (i % 11 === 5) {
      extras.push({
        kind: "withdrawn",
        to: nextStep,
        requestedAt: after(-42),
        decidedAt: after(-40),
      });
    }
  } else if (owned && target !== "L0" && i % 13 === 4) {
    const back = previousGate(target);
    if (back) {
      extras.push(
        { kind: "revert", to: back, at: after(-40), reason: "Nutzenrechnung hält nicht stand." },
        { kind: "advance", to: target, requestedAt: after(-30), decidedAt: after(-24) },
      );
    }
  }
  extrasCount += extras.length;
  for (const x of extras) kinds[x.kind] = (kinds[x.kind] ?? 0) + 1;

  const history = buildGateHistory({
    tenantId: "00000000-0000-4000-8000-0000000000ff",
    epicId: `00000000-0000-4000-8000-${pad(i)}0000`.slice(0, 36),
    makeId: (sfx) =>
      `00000000-0000-4000-8000-${pad(i)}${pad(sfx.length + sfx.charCodeAt(0))}`.slice(0, 36),
    requestedBy: U.owner,
    createdBy: U.admin,
    ownerId: owned ? U.owner : null,
    valueStreamId: "00000000-0000-4000-8000-0000000000aa",
    valueStreamVmoId: U.vmo,
    valueStreamFinanceApproverId: U.fo,
    rules,
    parties: { architect: U.vso, businessOwner: i % 3 === 2 ? null : U.vso, irtOwner: U.rte },
    solutionProductManagerId: U.pm,
    epicClass: pe.epicClass,
    benefitHypothesis: null,
    businessCase: pe.costSlices.length ? { costSlices: pe.costSlices } : null,
    timeline: { estimates: {}, actuals: {} },
    moves: [...pe.moves, ...extras],
  });
  assertGateHistory(history, `#${i}`);
  if (history.finalStep !== target && extras.every((x) => x.kind !== "revert")) {
    // Ein offener Antrag bewegt nichts; alles andere muss auf dem Ziel landen.
    const openOnly = extras.every((x) => x.kind !== "advance");
    if (openOnly && history.finalStep !== target) {
      throw new Error(`#${i}: finalStep ${history.finalStep} ≠ ${target}`);
    }
  }
}
console.log(`✓ ${plan.epics.length} Tor-Historien gefaltet und geprüft`);
console.log(`  Sonderfälle: ${extrasCount} —`, kinds);
