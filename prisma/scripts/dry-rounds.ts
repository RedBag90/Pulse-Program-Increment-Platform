/* eslint-disable no-console */
/** Trockenlauf des Rundenmotors — schreibt nichts, druckt nur die Zahlen. */
import { buildRoundPlan, type RoundsConfig } from "../seed-large-rounds.js";

const DAY = 86_400_000;
const realNow = new Date();
const HALF_IDX = realNow.getFullYear() * 2 + (realNow.getMonth() < 6 ? 0 : 1);
const keyOfHalf = (h: number): string => `${Math.floor(h / 2)}-H${(h % 2) + 1}`;
/** Dasselbe Fenster wie der Seed: fuenf zurueck, das laufende, zwei voraus. */
const cycles = Array.from({ length: 8 }, (_, k) => keyOfHalf(HALF_IDX - 5 + k));
const cycleStart = (key: string): Date => {
  const [y, h] = key.split("-");
  return new Date(Number(y), h === "H1" ? 0 : 6, 6);
};
const VS_WEIGHTS = [2, 2, 2, 1, 1, 0];

const cfg: RoundsConfig = {
  cycles,
  currentIdx: 5,
  // Dieselbe simulierte Gegenwart wie der Seed.
  now: new Date(Math.min(realNow.getTime(), cycleStart(cycles[5]!).getTime() + 55 * DAY)),
  cycleStart,
  thresholds: [60_000, 70_000, 80_000],
  artsPerVs: 2,
  cyclePool: 2_000_000,
  rtbCycleCost: (c) => 300_000 + c * 12_000 + 6 * (110_000 + c * 5_000),
  artFrame: (_art, c) => 110_000 + c * 5_000,
  intakePerCycle: 22,
  valueStreamOf: (i) => VS_WEIGHTS[i % VS_WEIGHTS.length]!,
};

const plan = buildRoundPlan(cfg);

console.log("Epics gesamt:", plan.epics.length);
console.log("\nRunde   Topf     Betrieb  Kand  finanz  leer  Reserve");
for (const r of plan.rounds) {
  const funded = r.candidates.filter((c) => c.final > 0).length;
  console.log(
    r.cycleKey.padEnd(8),
    String(Math.round(r.pool / 1000) + "k").padStart(7),
    String(Math.round(r.rtbFinal / 1000) + "k").padStart(8),
    String(r.candidates.length).padStart(5),
    String(funded).padStart(7),
    String(r.passedOver.length).padStart(5),
    String(Math.round(r.reserve / 1000) + "k").padStart(8),
  );
}

const byStep: Record<string, number> = {};
for (const e of plan.epics) byStep[e.finalStep] = (byStep[e.finalStep] ?? 0) + 1;
console.log("\nReifegrad-Verteilung:", byStep);

const byClass: Record<string, number> = {};
for (const e of plan.epics) byClass[String(e.epicClass)] = (byClass[String(e.epicClass)] ?? 0) + 1;
console.log("Einordnung:", byClass);

const owned = plan.epics.filter((e) => e.ownerSlot != null).length;
console.log("mit Owner:", owned, "/", plan.epics.length);
const waited = plan.epics.filter((e) => e.timesPassedOver > 0).length;
console.log("mind. einmal leer ausgegangen:", waited);
const trancheCycles = new Set(plan.epics.flatMap((e) => e.tranches.map((t) => t.cycleKey)));
console.log("Zyklen mit Zuteilungen:", [...trancheCycles].sort().join(", "));
const artT = plan.epics.flatMap((e) => e.tranches).filter((t) => t.source === "art_epic_budget");
console.log(
  "ART-Raten:",
  artT.length,
  "· PB-Raten:",
  plan.epics.flatMap((e) => e.tranches).length - artT.length,
);
