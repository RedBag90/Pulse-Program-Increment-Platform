/**
 * **Der Rundenmotor.** Er spielt Halbjahr für Halbjahr durch, was die elf
 * Anleitungen unter `docs/concepts/` beschreiben — Ideen sammeln, sichten,
 * reifen, budgetieren, umsetzen, wirken lassen — und liefert daraus einen
 * **Bauplan**. Er schreibt nichts; kein Prisma, kein I/O.
 *
 * Warum er existiert: der Seed rechnete die Vergangenheit bisher **rückwärts**.
 * Er würfelte den Ziel-Reifegrad eines Epics aus einem Funnel und leitete daraus
 * Zyklus, Datum und Budget ab. Dabei kann das, was die Anleitungen als Kern des
 * Halbjahres-Takts beschreiben, gar nicht vorkommen:
 *
 * > „Wird ein Portfolio-Epic in der Runde nicht finanziert, bleibt es auf L3.1
 * > stehen — nicht abgelehnt, sondern unbezahlt, und beim nächsten Zeitraum
 * > wieder dabei."
 *
 * Hier läuft es andersherum: **Zyklus → Entscheidung → Reifegrad → Datum.** Wer
 * kein Geld bekommt, wartet eine Runde. Wer umsetzt, bekommt jede Runde seine
 * nächste Rate — genau deshalb ist `BudgetAllocation.allocations` eine Karte
 * über Halbjahre und kein einzelner Betrag.
 *
 * Rein und deterministisch: kein `Math.random`, alle Streuung kommt aus dem
 * Index. Ein zweiter Lauf liefert denselben Bauplan.
 */

import { GATE_STEPS, type GateStep } from "@/modules/work/domain/stage-gate";
import { classifyEpic } from "@/modules/work/domain/pb-submission";
import { computeBusinessCaseTotals, parseBusinessCase } from "@/modules/work/domain/business-case";
import type { GateMove } from "./seed-gate-history.js";

const DAY = 86_400_000;

// ---------------------------------------------------------------------------
// Der Kalender einer Runde
// ---------------------------------------------------------------------------

/**
 * Die Phasen eines Halbjahres als Tagesversatz zum Zyklus-Anfang.
 *
 * Die Reihenfolge ist die Aussage: **die Kachel wird finalisiert, bevor die
 * meisten Business Cases dieses Halbjahres fertig sind.** Wer erst an Tag 90
 * durch L3.1 kommt, steht deshalb in der Runde des *nächsten* Halbjahres auf
 * der Kandidatenliste — „Wer bis zur Frist nicht durch L3.1 ist, ist in dieser
 * Runde nicht dabei" (Ein Halbjahr im Portfolio).
 */
export const PHASE = {
  /** Ideen werden eingereicht — die Karten landen im Funnel. */
  intake: 5,
  /** Erstsichtung: der Owner wird benannt. Kein Tor, nur ein Stempel. */
  triage: 20,
  /** Der Termin: die Runde startet, die Kandidatenliste friert ein. */
  roundStart: 25,
  /** Die Gruppen verteilen. */
  distribute: 32,
  /** Finance schließt und schreibt fest. */
  finalize: 40,
  /** L3.1 → L3.2: erst die Zuteilung, dann der Antrag. */
  invest: 50,
  /** L3.2 → L4.1: die Umsetzung beginnt mit dem ersten PI des Halbjahres. */
  implement: 60,
  /** L4 → L4.2 für die, deren Umsetzungsfenster hier endet. */
  implementDone: 70,
  /** L0 → L1: die Hypothese ist ausgearbeitet und wird freigegeben. */
  hypothesis: 32,
  /** L1 → L2: für die Analyse eingeplant. */
  analyze: 62,
  /** L2 → L3.1: der Business Case ist freigegeben. Nach der Runde — Absicht. */
  businessCase: 92,
  /** Portfolio Review — zweimal je Halbjahr. */
  reviewA: 90,
  reviewB: 150,
  /** L4.2 → L5: Finance bestätigt den Nutzen, deutlich später. */
  impact: 120,
} as const;

// ---------------------------------------------------------------------------
// Ein- und Ausgang
// ---------------------------------------------------------------------------

export interface RoundsConfig {
  /** Die Zyklen in Reihenfolge, z. B. `["2024-H1", … , "2027-H1"]`. */
  cycles: readonly string[];
  /** Index des laufenden Halbjahres in `cycles`. */
  currentIdx: number;
  /** Die simulierte Gegenwart. Nichts wird dahinter geschrieben. */
  now: Date;
  cycleStart: (key: string) => Date;
  /** Portfolio-Limit je Wertstrom — dieselben Werte wie an den Guardrails. */
  thresholds: readonly number[];
  /** Wie viele ARTs je Wertstrom. */
  artsPerVs: number;
  /** Der Topf je Zyklus, **ohne** übertragene Reserve. */
  cyclePool: number;
  /** Was Betrieb + ART-Rahmen je Zyklus vom Topf nehmen. */
  rtbCycleCost: (cycleIdx: number) => number;
  /** Der ART-Epic-Rahmen eines ARTs in einem Zyklus. */
  artFrame: (artIdx: number, cycleIdx: number) => number;
  /** Wie viele Ideen je Halbjahr hereinkommen. */
  intakePerCycle: number;
  /** Zuordnung Epic-Index → Wertstrom; der Aufrufer kennt die Gewichtung. */
  valueStreamOf: (epicIdx: number) => number;
}

/** Eine Rate: was ein Epic in **einem** Halbjahr bekommt, und woher. */
export interface Tranche {
  cycleKey: string;
  cycleIdx: number;
  amount: number;
  source: "pb_list" | "art_epic_budget";
}

export interface PlannedEpic {
  idx: number;
  vs: number;
  /**
   * `true` = aus dem Vorlauf. Das Programm begann vor dem Fenster; diese Epics
   * betreten es bereits gereift, ihre Tore liegen im Halbjahr davor.
   */
  preexisting: boolean;
  /** ART-Index innerhalb des Wertstroms. */
  artInVs: number;
  bornCycle: number;
  createdAt: Date;
  /** `null` = niemand hat die Idee übernommen; sie liegt im Funnel. */
  ownerSlot: number | null;
  moves: GateMove[];
  finalStep: GateStep;
  /** Entsteht erst mit L3.1 — vorher gibt es sie nicht. */
  epicClass: "portfolio" | "art" | null;
  intendedClass: "portfolio" | "art";
  overridden: boolean;
  /** Eine Scheibe je Halbjahr der Umsetzung. `period` ist der Zyklus-Schlüssel. */
  costSlices: { period: string; amount: number }[];
  /** Σ der Scheiben — der Richtwert auf der Kandidatenliste. */
  cost: number;
  tranches: Tranche[];
  /** Wie oft das Epic in einer Runde leer ausgegangen ist. */
  timesPassedOver: number;
  implStart: Date | null;
  implDone: Date | null;
  /** Der Reifegrad-Schritt am Ende **jedes** Zyklus — Grundlage der Budgetregel. */
  stepAtCycleEnd: (GateStep | null)[];
}

export interface PlannedRound {
  cycleIdx: number;
  cycleKey: string;
  /** Topf inklusive der übertragenen Reserve der Vorrunde. */
  pool: number;
  carriedReserve: number;
  /** Was Betrieb und ART-Rahmen vorweg binden. */
  rtbFinal: number;
  /** Epic-Kandidaten: Richtwert (Σ Scheiben) und Endbetrag (die Rate). */
  candidates: { epicIdx: number; ask: number; final: number; running: boolean }[];
  /** Epics, die auf der Liste standen und nichts bekommen haben. */
  passedOver: number[];
  reserve: number;
}

export interface RoundPlan {
  epics: PlannedEpic[];
  rounds: PlannedRound[];
}

// ---------------------------------------------------------------------------
// Deterministische Streuung
// ---------------------------------------------------------------------------

/** Kleiner Streuwert aus dem Index — statt `Math.random`, damit Läufe gleich sind. */
const spread = (i: number, salt: number, mod: number): number =>
  ((i * 2654435761 + salt * 40503) >>> 0) % mod;

// ---------------------------------------------------------------------------
// Der Lauf
// ---------------------------------------------------------------------------

interface Working extends PlannedEpic {
  /** Der Schritt, auf dem das Epic **gerade** steht. */
  step: GateStep | null;
  /** In welchem Zyklus das Umsetzungsfenster endet. */
  implEndCycle: number | null;
  /** Wie viele Halbjahre die Umsetzung dauert. */
  implCycles: number;
  /** Wie viele Halbjahre die Idee liegt, bevor jemand die Hypothese schreibt. */
  startPace: number;
  /** In welchem Halbjahr das Epic für die Analyse ausgewählt wurde. */
  l2Cycle: number | null;
  /** Wie viele Raten schon geflossen sind. */
  paidTranches: number;
  /** Wurde die Umsetzung abgenommen? */
  done: boolean;
}

export function buildRoundPlan(cfg: RoundsConfig): RoundPlan {
  const { cycles, currentIdx, now, cycleStart, thresholds } = cfg;
  const dayIn = (c: number, offset: number): Date =>
    new Date(cycleStart(cycles[c]!).getTime() + offset * DAY);
  /** Liegt dieser Zeitpunkt noch vor der Gegenwart? Sonst passiert er nicht. */
  const happened = (d: Date): boolean => d.getTime() <= now.getTime();

  const epics: Working[] = [];
  const rounds: PlannedRound[] = [];
  let carried = 0;
  let nextIdx = 0;

  // ── Der Vorlauf ─────────────────────────────────────────────────────────
  //
  // Das Programm faengt nicht mit dem Fenster an. Ohne diese Kohorte haette die
  // erste Runde **keine Kandidaten** — die Epics dieses Halbjahres kommen erst
  // an Tag 92 durch L3.1, die Kachel wird an Tag 40 festgeschrieben. Ihre Tore
  // liegen deshalb im Halbjahr **vor** dem Fenster. Das ist erlaubt und ehrlich:
  // Vergangenheit gab es, nur ihre Budget-Runden liegen ausserhalb.
  {
    const windowStart = cycleStart(cycles[0]!);
    const before = (offset: number): Date => new Date(windowStart.getTime() - offset * DAY);
    // Zwei Jahrgaenge, nicht einer: die erste Runde im Fenster soll eine volle
    // Kandidatenliste vorfinden, kein halbes Dutzend.
    for (let n = 0; n < cfg.intakePerCycle * 2; n++) {
      const i = nextIdx++;
      const vs = cfg.valueStreamOf(i);
      const e = newEpic(i, vs, 0, before(150 - spread(i, 40, 20)), cfg);
      e.preexisting = true;
      e.ownerSlot = spread(i, 4, 6);
      // Wie weit die Kohorte schon ist: manche stehen im Funnel, andere haben
      // ihren Business Case fertig und warten auf die erste Runde im Fenster.
      // Die Verteilung ist bewusst kopflastig: wer seit Jahren im Programm ist,
      // steht eher vor der Investitionsentscheidung als im Funnel.
      const reach = [0, 1, 2, 3, 3, 3][spread(i, 41, 6)]!; // 0 = L0 … 3 = L3.1
      if (reach >= 1) push(e, mk("L1", before(120 - spread(i, 42, 10))));
      if (reach >= 2) push(e, mk("analysis", before(80 - spread(i, 43, 10))));
      if (reach >= 3) {
        const at = before(30 - spread(i, 44, 10));
        e.costSlices = sliceCosts(e, 0, cycles);
        e.cost = computeBusinessCaseTotals(
          parseBusinessCase({ costSlices: e.costSlices }).current,
        ).implementationCost;
        push(e, mk("L2", at));
        e.epicClass = classifyEpic(
          {
            businessCase: { costSlices: e.costSlices },
            businessCaseApprovedAt: at,
            portfolioOverrideAt: e.overridden ? at : null,
          },
          thresholds[e.vs]!,
        ).epicClass;
      }
      epics.push(e);
    }
  }

  for (let c = 0; c <= currentIdx; c++) {
    // ── 1 · Ideen sammeln ────────────────────────────────────────────────
    for (let n = 0; n < cfg.intakePerCycle; n++) {
      const i = nextIdx++;
      const at = dayIn(c, PHASE.intake + spread(i, 1, 12));
      if (!happened(at)) break;
      const vs = cfg.valueStreamOf(i);
      epics.push(newEpic(i, vs, c, at, cfg));
    }

    // ── 2 · Erstsichtung: der Owner wird benannt ─────────────────────────
    for (const e of epics) {
      if (e.ownerSlot != null || e.bornCycle > c) continue;
      // Ein Teil bleibt liegen — nicht jede Idee findet jemanden, der sie trägt.
      if (spread(e.idx, 2, 10) < 2 && c - e.bornCycle < 2) continue;
      const at = dayIn(c, PHASE.triage + spread(e.idx, 3, 10));
      if (!happened(at)) continue;
      e.ownerSlot = spread(e.idx, 4, 6);
      // Die Benennung bewegt kein Tor; sie stempelt nur. Der Stempel entsteht
      // beim ersten `advance` (→ L1) mit — deshalb steht hier kein Zug.
    }

    // ── 3 · Die Budget-Runde ────────────────────────────────────────────
    //
    // Sie steht **vor** der Reifung, und das ist keine Umsortierung des Codes,
    // sondern der Kalender: die Kachel wird an Tag 40 festgeschrieben, ein
    // Business Case wird an Tag 92 freigegeben. Wer in diesem Halbjahr durch
    // L3.1 kommt, steht deshalb in der Runde des **nächsten** auf der Liste —
    // „Wer bis zur Frist nicht durch L3.1 ist, ist in dieser Runde nicht dabei."
    const round = runBudgetRound(c, epics, carried, cfg, cycles);
    rounds.push(round);
    carried = round.reserve;

    // ── 4 · Investitionsentscheidung: erst die Zuteilung, dann der Antrag ─
    for (const e of epics) {
      if (e.step !== "L2") continue;
      if (!e.tranches.some((t) => t.cycleIdx === c)) continue;
      advanceIfDue(e, "L3", dayIn(c, PHASE.invest + spread(e.idx, 8, 8)));
    }

    // ── 5 · Umsetzung starten ───────────────────────────────────────────
    for (const e of epics) {
      if (e.step !== "L3") continue;
      const at = dayIn(c, PHASE.implement + spread(e.idx, 9, 10));
      if (!happened(at)) continue;
      push(e, { kind: "advance", to: "L4", requestedAt: addDays(at, -5), decidedAt: at });
      e.implStart = at;
      e.implEndCycle = c + e.implCycles - 1;
    }

    // ── 6 · Reifen: L0 → L1 → zur Analyse ausgewaehlt ───────────────────
    //
    // Nicht jedes Epic marschiert im Gleichschritt: `startPace` lässt manche
    // Ideen ein oder zwei Halbjahre liegen, bevor überhaupt jemand die
    // Hypothese ausarbeitet.
    for (const e of epics) {
      if (e.ownerSlot == null) continue;
      if (c - e.bornCycle < e.startPace) continue;
      advanceIfDue(e, "L1", dayIn(c, PHASE.hypothesis + spread(e.idx, 5, 6)));
      if (
        e.step === "L1" &&
        advanceIfDue(e, "analysis", dayIn(c, PHASE.analyze + spread(e.idx, 6, 8)))
      ) {
        e.l2Cycle = c;
      }
    }

    // ── 7 · Umsetzung fertig melden ─────────────────────────────────────
    for (const e of epics) {
      if (e.step !== "L4" || e.implEndCycle == null || c <= e.implEndCycle) continue;
      const at = dayIn(c, PHASE.implementDone + spread(e.idx, 10, 14));
      if (!happened(at)) continue;
      push(e, { kind: "advance", to: "L4.2", requestedAt: addDays(at, -8), decidedAt: at });
      e.implDone = at;
      e.done = true;
    }

    // ── 8 · Der Business Case wird freigegeben ──────────────────────────
    for (const e of epics) {
      if (e.step !== "analysis") continue;
      /**
       * **Ein Business Case entsteht nicht in vier Wochen.** Er wird im
       * Halbjahr nach der Auswahl geschrieben — sonst stünde die Spalte
       * _Business Case_ im Kanban dauerhaft leer: sie wäre nur zwischen Tag 62
       * und Tag 92 eines Zyklus besetzt, und die Wahrscheinlichkeit, den
       * Mandanten genau dort anzutreffen, ist ein Sechstel.
       */
      if (e.l2Cycle === c) continue;
      const at = dayIn(c, PHASE.businessCase + spread(e.idx, 7, 10));
      if (!happened(at)) continue;
      // **Erst mit dieser Freigabe entsteht die Einordnung.** Vorher gibt es
      // sie nicht — und deshalb kann sie vorher auch nichts steuern.
      e.costSlices = sliceCosts(e, c + 1, cycles);
      e.cost = computeBusinessCaseTotals(
        parseBusinessCase({ costSlices: e.costSlices }).current,
      ).implementationCost;
      push(e, { kind: "advance", to: "L2", requestedAt: addDays(at, -6), decidedAt: at });
      e.epicClass = classifyEpic(
        {
          businessCase: { costSlices: e.costSlices },
          businessCaseApprovedAt: at,
          portfolioOverrideAt: e.overridden ? at : null,
        },
        thresholds[e.vs]!,
      ).epicClass;
    }

    // ── 9 · Finance bestätigt den Nutzen ────────────────────────────────
    for (const e of epics) {
      if (e.step !== "L4.2" || e.implDone == null) continue;
      // „Fertig gebaut" ist nicht „Nutzen nachgewiesen" — zwischen beidem
      // liegt mindestens ein halbes Jahr.
      if (c <= cycleOf(e.implDone, cfg)) continue;
      const at = dayIn(c, PHASE.impact + spread(e.idx, 11, 20));
      if (!happened(at)) continue;
      push(e, { kind: "advance", to: "L5", requestedAt: addDays(at, -10), decidedAt: at });
    }

    // ── Der Stand am Ende dieses Halbjahres ─────────────────────────────
    for (const e of epics) e.stepAtCycleEnd[c] = e.step;
  }

  return { epics: epics.map(strip), rounds };

  // ── Innere Helfer ───────────────────────────────────────────────────────

  /**
   * Haengt einen Zug an — und schiebt sein **Antragsdatum** notfalls hinter die
   * Abnahme des vorigen. Ein Antrag auf L4.1, der vor der Abnahme von L3.2
   * gestellt wurde, waere nicht nur unschoen: `assertGateHistory` verlangt eine
   * chronologische Kette, und die Flaeche koennte ihn gar nicht anbieten.
   */
  function push(e: Working, move: GateMove): void {
    const prev = e.moves[e.moves.length - 1];
    if (prev && move.kind !== "revert") {
      const prevAt = moveAt(prev);
      if (move.requestedAt.getTime() <= prevAt.getTime()) {
        move.requestedAt = addDays(prevAt, 1);
      }
    }
    e.moves.push(move);
    e.step = move.to;
    e.finalStep = move.to;
  }

  /** Ein glatter Zug: beantragt fuenf Tage vorher, abgenommen an `at`. */
  function mk(to: GateStep, at: Date): GateMove {
    return { kind: "advance", to, requestedAt: addDays(at, -5), decidedAt: at };
  }

  /** `true`, wenn der Zug gefallen ist. */
  function advanceIfDue(e: Working, to: GateStep, at: Date): boolean {
    const from = previousStepOf(to);
    if (e.step !== from) return false;
    if (!happened(at)) return false;
    push(e, { kind: "advance", to, requestedAt: addDays(at, -5), decidedAt: at });
    return true;
  }

  function cycleOf(d: Date, conf: RoundsConfig): number {
    for (let k = conf.cycles.length - 1; k >= 0; k--) {
      if (d.getTime() >= conf.cycleStart(conf.cycles[k]!).getTime()) return k;
    }
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Die Runde selbst
// ---------------------------------------------------------------------------

/**
 * **Laufende Epics haben Vorrang.** Das ist keine Bequemlichkeit des Motors,
 * sondern die Regel aus *Ein Halbjahr im Portfolio*: wer in Umsetzung ist, muss
 * im laufenden Zyklus Geld haben — sonst ist es eine Lücke in der Vergabe.
 * Erst danach kommen die neuen Business Cases dran, und zwar so lange, wie der
 * Topf reicht. Wer dann noch übrig ist, wartet eine Runde.
 */
function runBudgetRound(
  c: number,
  epics: Working[],
  carriedReserve: number,
  cfg: RoundsConfig,
  cycles: readonly string[],
): PlannedRound {
  const cycleKey = cycles[c]!;
  const pool = cfg.cyclePool + carriedReserve;
  const rtbFinal = cfg.rtbCycleCost(c);
  let left = pool - rtbFinal;

  const candidates: PlannedRound["candidates"] = [];
  const passedOver: number[] = [];

  // Die ART-Rahmen dieses Zyklus — je ART ein eigener Deckel.
  const artLeft = new Map<string, number>();
  const frameKey = (vs: number, art: number): string => `${vs}:${art}`;

  /** Die Rate dieses Halbjahres: die Kostenscheibe, die auf den Zyklus lautet. */
  const trancheFor = (e: Working): number =>
    e.costSlices.find((s) => s.period === cycleKey)?.amount ?? 0;

  // 1 · Laufende zuerst — sie tragen ihre nächste Rate.
  const running = epics.filter((e) => e.step === "L4" && !e.done);
  for (const e of running) {
    const amount = trancheFor(e);
    if (amount <= 0) continue;
    if (e.epicClass === "art") {
      // **Der Deckel gilt neuen Zusagen, nicht laufenden.** Die Verpflichtung
      // wurde beim ersten Zuteilen eingegangen; sie mitten in der Umsetzung
      // fallen zu lassen hiesse, dass ein Epic auf L4.1 ohne Geld dasteht — und
      // genau das ist die Lücke, die `requiresCurrentAllocation` anzeigt.
      grantFromArtFrame(e, amount, true);
      continue;
    }
    candidates.push({ epicIdx: e.idx, ask: e.cost, final: amount, running: true });
    left -= amount;
    e.tranches.push({ cycleKey, cycleIdx: c, amount, source: "pb_list" });
    e.paidTranches += 1;
  }

  // 2 · Neue Business Cases — Portfolio-Epics auf die Liste, ART-Epics an den
  //     Rahmen ihres ARTs. Beide warten seit ihrer Freigabe; wer länger wartet,
  //     kommt zuerst.
  const fresh = epics
    .filter((e) => e.step === "L2" && e.cost > 0 && !e.tranches.some((t) => t.cycleIdx === c))
    .sort((a, b) => b.timesPassedOver - a.timesPassedOver || a.idx - b.idx);

  for (const e of fresh) {
    /**
     * **Der Plan verschiebt sich mit dem Geld.** Die Scheiben laufen ab dem
     * Zyklus, in dem bewilligt wurde — nicht ab dem, den der Business Case
     * einmal vorgesehen hatte. Wer eine Runde wartet, schiebt seinen ganzen
     * Plan; sonst zeigte die erste Rate auf ein Halbjahr, das längst vorbei
     * ist, und das Epic stünde mitten in der Umsetzung ohne Zuteilung da.
     */
    const shifted = shiftSlicesTo(e.costSlices, c, cycles);
    const amount = shifted[0]?.amount ?? 0;
    if (amount <= 0) continue;

    if (e.epicClass === "art") {
      if (!grantFromArtFrame(e, amount)) {
        e.timesPassedOver += 1;
        passedOver.push(e.idx);
        continue;
      }
      e.costSlices = shifted;
      continue;
    }

    if (amount > left) {
      // Der Topf ist alle. Nicht abgelehnt — unbezahlt, und nächste Runde
      // wieder dabei.
      e.timesPassedOver += 1;
      candidates.push({ epicIdx: e.idx, ask: e.cost, final: 0, running: false });
      passedOver.push(e.idx);
      continue;
    }

    candidates.push({ epicIdx: e.idx, ask: e.cost, final: amount, running: false });
    left -= amount;
    e.tranches.push({ cycleKey, cycleIdx: c, amount, source: "pb_list" });
    e.paidTranches += 1;
    e.costSlices = shifted;
  }

  const finalSum = candidates.reduce((s, x) => s + x.final, 0);
  return {
    cycleIdx: c,
    cycleKey,
    pool,
    carriedReserve,
    rtbFinal,
    candidates,
    passedOver,
    reserve: Math.max(0, pool - rtbFinal - finalSum),
  };

  function grantFromArtFrame(e: Working, amount: number, committed = false): boolean {
    const key = frameKey(e.vs, e.artInVs);
    const remaining = artLeft.get(key) ?? cfg.artFrame(e.vs * cfg.artsPerVs + e.artInVs, c);
    if (amount > remaining && !committed) return false;
    artLeft.set(key, remaining - amount);
    e.tranches.push({ cycleKey, cycleIdx: c, amount, source: "art_epic_budget" });
    e.paidTranches += 1;
    return true;
  }
}

// ---------------------------------------------------------------------------
// Kleinteiliges
// ---------------------------------------------------------------------------

const addDays = (base: Date, d: number): Date => new Date(base.getTime() + d * DAY);

/**
 * Wann ein Zug **wirkt**. Eine Rückstufung trägt nur `at`, alle anderen Züge
 * einen Antrag und — sofern entschieden — eine Abnahme. Ein offener Antrag wirkt
 * mit seinem Antragsdatum, denn entschieden ist er noch nicht.
 */
export function moveAt(move: GateMove): Date {
  if (move.kind === "revert") return move.at;
  return "decidedAt" in move && move.decidedAt ? move.decidedAt : move.requestedAt;
}

/** Wann ein Zug **beantragt** wurde. Eine Rückstufung kennt keinen Antrag. */
export function moveRequestedAt(move: GateMove): Date {
  return move.kind === "revert" ? move.at : move.requestedAt;
}

/**
 * Der Schritt, der einem Schritt vorausgeht — die Leiter rückwärts.
 *
 * Sie stand hier als eigene Abschrift und war damit die fuenfte Kopie derselben
 * Reihenfolge. Jetzt kommt sie aus `GATE_STEPS`; eine Umnummerierung der Achse
 * zieht sie mit, statt sie stillschweigend falsch werden zu lassen.
 */
function previousStepOf(step: GateStep): GateStep | null {
  const i = GATE_STEPS.indexOf(step);
  return i <= 0 ? null : (GATE_STEPS[i - 1] as GateStep);
}

/**
 * **Die Groesse eines Vorhabens bestimmt seine Dauer.** Ein kleiner Hebel ist in
 * einem Halbjahr gezogen und bleibt unter dem Portfolio-Limit — er ist damit ein
 * ART-Epic und geht nie auf die Kandidatenliste. Ein grosser laeuft drei
 * Halbjahre und ist Portfolio-Sache. Waeren Groesse und Dauer unabhaengig,
 * entstuende ein Datensatz voller dreijaehriger Kleinigkeiten.
 */
const SIZE: { base: number; step: number; cycles: number }[] = [
  { base: 24_000, step: 5_000, cycles: 1 }, // klein  → unter dem Limit → ART-Epic
  { base: 50_000, step: 7_000, cycles: 2 }, // mittel
  { base: 90_000, step: 9_000, cycles: 3 }, // gross
];

function newEpic(i: number, vs: number, c: number, at: Date, cfg: RoundsConfig): Working {
  const implCycles = SIZE[spread(i, 20, SIZE.length)]!.cycles;
  // Die Erwartung beim Anlegen. Sie deckt sich meistens mit dem, was die Kosten
  // später sagen — aber nicht immer, und beide Abweichungsrichtungen sollen
  // vorkommen.
  const intendedClass: "portfolio" | "art" = spread(i, 21, 3) === 0 ? "art" : "portfolio";
  return {
    idx: i,
    vs,
    preexisting: false,
    artInVs: spread(i, 22, cfg.artsPerVs),
    bornCycle: c,
    createdAt: at,
    ownerSlot: null,
    moves: [],
    finalStep: "L0",
    step: "L0",
    epicClass: null,
    intendedClass,
    // Die Ausnahme zur Kostenregel: klein, aber übergreifend heikel.
    overridden: spread(i, 23, 17) === 3,
    costSlices: [],
    cost: 0,
    tranches: [],
    timesPassedOver: 0,
    implStart: null,
    implDone: null,
    implEndCycle: null,
    implCycles,
    startPace: spread(i, 24, 3),
    l2Cycle: null,
    paidTranches: 0,
    done: false,
    stepAtCycleEnd: [],
  };
}

/**
 * Die Kostenscheiben: **eine je Halbjahr der Umsetzung, plus eine fürs
 * Abschliessen**, beginnend mit dem Zyklus, in dem das Geld frühestens fließen
 * kann. Ihre Summe ist der Richtwert auf der Kandidatenliste; die einzelne
 * Scheibe ist die Rate, die in diesem Halbjahr bewilligt wird.
 *
 * Die letzte, kleine Scheibe ist kein Zierrat. Die Fertigmeldung (L4.2) fällt
 * im Halbjahr **nach** dem Ende des Umsetzungsfensters — bis dahin steht das
 * Epic auf L4.1, und dort verlangt die Budgetregel eine Zuteilung im laufenden
 * Zyklus. Ohne diese Scheibe stünde jedes Epic in seinem Abschluss-Halbjahr
 * ohne Geld da, und genau das meldet `requiresCurrentAllocation` als Lücke.
 */
function sliceCosts(
  e: Working,
  fromCycle: number,
  cycles: readonly string[],
): { period: string; amount: number }[] {
  const size = SIZE[spread(e.idx, 20, SIZE.length)]!;
  const base = size.base + spread(e.idx, 30, 5) * size.step;
  const share = (k: number): number =>
    k === 0 ? base : k < e.implCycles ? Math.round(base * 0.6) : Math.round(base * 0.25);
  return Array.from({ length: e.implCycles + 1 }, (_, k) => ({
    period: cycles[Math.min(fromCycle + k, cycles.length - 1)]!,
    amount: share(k),
  }));
}

/** Verschiebt die Scheiben, wenn das Geld später kam als geplant. */
function shiftSlicesTo(
  slices: { period: string; amount: number }[],
  fromCycle: number,
  cycles: readonly string[],
): { period: string; amount: number }[] {
  return slices.map((s, k) => ({
    period: cycles[Math.min(fromCycle + k, cycles.length - 1)]!,
    amount: s.amount,
  }));
}

/** Wirft die Arbeitsfelder weg — nach außen zählt nur der Bauplan. */
function strip(e: Working): PlannedEpic {
  const {
    step: _s,
    implEndCycle: _i,
    implCycles: _c,
    startPace: _sp,
    l2Cycle: _l2,
    paidTranches: _p,
    done: _d,
    ...rest
  } = e;
  return rest;
}
