/**
 * Das Seitenmodell des ART-Budget-Reiters: was diesem ART zugeteilt ist, in
 * welchem Zustand es steht, und was an der Datenlage hakt.
 *
 * Getrennt nach **Geldquelle**, obwohl es heute nur eine gibt. Sobald ART-Epics
 * aus dem eigenen Rahmen finanziert werden (`art-epics.md`), schreiben beide
 * Wege in dieselbe `BudgetAllocation` — die Vermischung entstünde also von
 * selbst, wenn die Form sie nicht von Anfang an trennt.
 */

import type { PrismaClient } from "@/generated/prisma";
import { InitiativeLevel, type TenantId } from "@/modules/core/kernel/domain/types";
import {
  addMonths,
  halfYearKey,
  halfYearLabel,
  monthStart,
  parseHalfYearKey,
} from "@/modules/core/kernel/domain/calendar";
import {
  buildEpicStageTimeline,
  stageAtMonth,
  type StageTransition,
} from "@/modules/work/domain/epic-stage-timeline";
import { classifyEpic } from "@/modules/work/domain/pb-submission";
import { listRtbItems } from "@/modules/budgeting/server/services/rtb-item-service";
import { isChangeKind } from "@/modules/budgeting/domain/rtb-kind";
import { rtbAnnualAmount, rtbCycleAmount } from "@/modules/budgeting/domain/rtb-interval";
import {
  loadArtPot,
  loadArtEpicAllocations,
  type ArtPot,
} from "@/modules/budgeting/server/services/art-pot";
import {
  deriveJobSizeRate,
  loadInEuro,
  type JobSizeRate,
  type ThroughputCycle,
} from "@/modules/budgeting/domain/art-throughput";
import {
  buildAllocationCourse,
  type AllocationCourse,
  type CourseEpic,
} from "@/modules/budgeting/domain/allocation-course";
import {
  summarizeAllocations,
  type AllocatedEpic,
  type AllocationBreakdown,
  type AllocationState,
} from "@/modules/budgeting/domain/allocation-state";

/** Woher das Geld einer Zuteilung kommt. Heute nur `portfolio`. */
export const ALLOCATION_SOURCES = ["portfolio", "art"] as const;
export type AllocationSource = (typeof ALLOCATION_SOURCES)[number];

export const ALLOCATION_SOURCE_LABELS: Record<AllocationSource, string> = {
  portfolio: "Portfolio-Budget",
  art: "ART-Topf",
};

/**
 * Warum ein Vorhaben kein Geld hat. Die Abhilfe unterscheidet sich je Fall —
 * deshalb getrennt geführt und nicht in eine Liste geworfen.
 */
export const UNFUNDED_REASONS = ["ballot", "artPot"] as const;
export type UnfundedReason = (typeof UNFUNDED_REASONS)[number];

export const UNFUNDED_REASON_LABELS: Record<UnfundedReason, string> = {
  ballot: "Auf dem Ballot ohne Zuteilung geblieben",
  artPot: "Vom ART-Rahmen nicht gedeckt",
};

export const UNFUNDED_REMEDIES: Record<UnfundedReason, string> = {
  ballot: "Auf die nächste Kachel setzen.",
  artPot: "Einen größeren Rahmen beantragen.",
};

export interface UnfundedCandidate {
  epicId: string;
  title: string;
  stageGate: string | null;
  ask: number;
  reason: UnfundedReason;
}

export interface ArtBudgetEpicRow {
  epicId: string;
  title: string;
  stageGate: string;
  amount: number;
}

export interface ArtBudgetSourceView {
  source: AllocationSource;
  label: string;
  breakdown: AllocationBreakdown;
  /** Titel je Epic, damit die Fläche die Staffel-Zeilen benennen kann. */
  titles: Record<string, string>;
}

export interface ArtBudgetDetail {
  artId: string;
  /** Halbjahre mit Zuteilung, neueste zuerst — die Auswahl des Umschalters. */
  cycles: { key: string; label: string }[];
  cycleKey: string;
  sources: ArtBudgetSourceView[];
  /** Epics, deren ART sich nach der Zuteilung geändert hat. */
  switchedArt: { epicId: string; title: string; currentArtName: string | null }[];
  /** Zuteilungen des Wertstroms an Epics ohne ART — sie fehlen in jeder ART-Sicht. */
  epicsWithoutArt: { count: number; amount: number };
  /** Beantragt und leer ausgegangen — die Gegenseite der Reallokations-Sicht. */
  unfunded: UnfundedCandidate[];
  /** Der Monatsverlauf des gewählten Halbjahres, je Quelle. */
  course: Record<AllocationSource, AllocationCourse | null>;
  /** Index des laufenden Monats auf der Achse; −1 = außerhalb des Halbjahres. */
  todayIndex: number;
  /** Last gegen Deckung — `null`, solange kein ART-Budget geladen wurde. */
  coverage: ArtCoverage | null;
  /** Der Veränderungsrahmen und seine Verteilung — `null`, wenn Practice aus. */
  pot: ArtPotView | null;
  /** Run-the-Business-Positionen dieses ARTs, nach Art getrennt. */
  rtb: {
    run: { id: string; name: string; cycleAmount: number; annualAmount: number }[];
    change: { id: string; name: string; cycleAmount: number; annualAmount: number }[];
  };
}

export interface ArtPotView {
  pot: ArtPot;
  /**
   * Die ART-Epics dieses ARTs, die vorgemerkt und budgeting-reif sind — mit
   * ihrem eingefrorenen Richtwert, sobald einmal zugeteilt wurde.
   */
  rows: {
    epicId: string;
    title: string;
    stageGate: string;
    ask: number;
    amount: number;
    /** `true`, wenn der aktuelle Business Case vom eingefrorenen Richtwert abweicht. */
    askDrifted: boolean;
  }[];
  /** Die Zustandsstaffel der ART-finanzierten Zuteilungen — die zweite Quelle. */
  breakdown: AllocationBreakdown;
  titles: Record<string, string>;
}

export interface ArtCoverage {
  /** Σ Job Size der Features, die im gewählten Halbjahr eingeplant sind. */
  plannedJobSize: number;
  featureCount: number;
  rate: JobSizeRate;
  /** Last in Geld — `null`, wenn kein Satz vorliegt. */
  loadEuro: number | null;
  allocated: number;
  /** `loadEuro − allocated`; positiv = überbucht. `null` ohne Satz. */
  gap: number | null;
}

/**
 * Wie die Deckungs-Ampel zu lesen ist.
 *
 * `empty` ist der eigene Zustand für „hier ist noch gar nichts": ohne ihn
 * meldete ein ART ohne eingeplante Features und ohne Zuteilung **„Gedeckt"** —
 * eine Entwarnung über nichts.
 */
export type CoverageVerdict = "empty" | "unknown" | "over" | "covered";

export function coverageVerdict(coverage: ArtCoverage): CoverageVerdict {
  if (coverage.plannedJobSize === 0 && coverage.allocated === 0) return "empty";
  if (coverage.gap == null) return "unknown";
  return coverage.gap > 0 ? "over" : "covered";
}

interface CandidateRow {
  epicId: string;
  /** `null` = die Runde hat entschieden und nichts gegeben. */
  amount: number | null;
  ask: number;
  title: string;
  cycleKey: string;
  /** Nur eine abgeschlossene Kachel hat wirklich „nichts gegeben". */
  decided: boolean;
}

interface EpicRow {
  id: string;
  title: string;
  stageGate: string;
  artId: string | null;
  implementationCompletedAt: Date | null;
  /** Reifegrad-Verlauf, sofern geladen — sonst bleibt der Kurs leer. */
  stageTimeline?: StageTransition[] | undefined;
}

/**
 * Der Zustand einer Zuteilung **in einem bestimmten Monat** — dieselbe Regel wie
 * `allocationState`, nur zeitbezogen: der L4.2-Stempel gewinnt vor dem
 * Reifegrad, sobald sein Monat erreicht ist.
 */
function stateInMonth(
  timeline: StageTransition[],
  completedAt: Date | null,
  month: Date,
): AllocationState {
  const done = completedAt != null && monthStart(completedAt).getTime() <= month.getTime();
  const gate = stageAtMonth(timeline, month);
  if (gate === "L5" || done) return "consumed";
  if (gate === "L4") return "committed";
  return "notStarted";
}

/** Die sechs Monate eines Halbjahres, ab seinem ersten Tag. */
function monthsOfCycle(cycleKey: string): { key: string; label: string; date: Date }[] {
  const start = parseHalfYearKey(cycleKey);
  if (!start) return [];
  const LABELS = [
    "Jan",
    "Feb",
    "Mär",
    "Apr",
    "Mai",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Okt",
    "Nov",
    "Dez",
  ];
  return Array.from({ length: 6 }, (_, i) => {
    const date = addMonths(start, i);
    return {
      key: `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`,
      label: LABELS[date.getUTCMonth()]!,
      date,
    };
  });
}

/**
 * Faltet Kandidaten und Epics in das Seitenmodell. Rein — der Server reicht
 * herein, was er geladen hat, damit die Regel testbar bleibt.
 */
export function buildArtBudgetDetail(input: {
  artId: string;
  now: Date;
  candidates: readonly CandidateRow[];
  epics: readonly EpicRow[];
  artNames: Record<string, string>;
  withoutArt: { count: number; amount: number };
  cycleKey?: string | undefined;
  /**
   * Halbjahre, in denen dieser ART aus **seinem eigenen Rahmen** verteilt hat.
   *
   * Ohne sie bildete sich die Achse allein aus den Kachel-Kandidaten: ein
   * Halbjahr, in dem ein ART ausschließlich ART-Epics finanziert hat, wäre gar
   * nicht anwählbar und seine Verteilfläche dauerhaft unsichtbar — genau der
   * Normalfall, den Guardrail 3 herstellen soll.
   */
  artCycleKeys?: readonly string[] | undefined;
}): ArtBudgetDetail {
  const cycleKeys = [
    ...new Set([...input.candidates.map((c) => c.cycleKey), ...(input.artCycleKeys ?? [])]),
  ]
    .sort()
    .reverse();
  // Ohne Zuteilung zeigt die Fläche das laufende Halbjahr statt gar nichts.
  const cycles = (cycleKeys.length > 0 ? cycleKeys : [halfYearKey(input.now)]).map((key) => ({
    key,
    label: halfYearLabel(key),
  }));
  const cycleKey =
    input.cycleKey != null && cycles.some((c) => c.key === input.cycleKey)
      ? input.cycleKey
      : (cycles[0]?.key ?? halfYearKey(input.now));

  const byEpic = new Map<string, EpicRow>(input.epics.map((e) => [e.id, e]));
  const allocated: AllocatedEpic[] = [];
  const titles: Record<string, string> = {};

  const unfunded: UnfundedCandidate[] = [];

  for (const c of input.candidates) {
    if (c.cycleKey !== cycleKey) continue;

    // Ohne Betrag ist die Kachel entweder noch nicht durch — oder sie hat
    // entschieden und nichts gegeben. Nur der zweite Fall ist „nicht finanziert".
    if (c.amount == null || c.amount === 0) {
      if (!c.decided) continue;
      unfunded.push({
        epicId: c.epicId,
        // Der Kandidat trägt seinen eigenen Titel — er gilt auch für ein
        // gelöschtes Epic, dessen Antrag trotzdem stattgefunden hat.
        title: byEpic.get(c.epicId)?.title ?? c.title,
        stageGate: byEpic.get(c.epicId)?.stageGate ?? null,
        ask: c.ask,
        reason: "ballot",
      });
      continue;
    }

    const epic = byEpic.get(c.epicId);
    if (!epic) continue; // gelöschtes Epic — die Kachel-Zeile bleibt, die Sicht nicht
    allocated.push({
      epicId: c.epicId,
      amount: c.amount,
      stageGate: epic.stageGate,
      implementationCompletedAt: epic.implementationCompletedAt,
    });
    titles[c.epicId] = epic.title;
  }

  unfunded.sort((a, b) => b.ask - a.ask);

  // Der Verlauf: je Epic ein Zustand pro Monat, aus seiner Reifegrad-Historie.
  const months = monthsOfCycle(cycleKey);
  const thisMonth = monthStart(input.now).getTime();
  const todayIndex = months.findIndex((m) => m.date.getTime() === thisMonth);
  const courseEpics: CourseEpic[] = allocated.flatMap((a) => {
    const epic = byEpic.get(a.epicId);
    const timeline = epic?.stageTimeline;
    if (!timeline) return [];
    return [
      {
        amount: a.amount,
        states: months.map((m) => stateInMonth(timeline, epic.implementationCompletedAt, m.date)),
      },
    ];
  });

  const sources: ArtBudgetSourceView[] = [
    {
      source: "portfolio",
      label: ALLOCATION_SOURCE_LABELS.portfolio,
      breakdown: summarizeAllocations(allocated),
      titles,
    },
  ];

  // Der ART der Kachel ist eingefroren; wechselt ein Epic danach, bleibt das
  // Budget hier — die Kachel hat es hier entschieden. Sichtbar machen, nicht
  // stillschweigend hinnehmen.
  const switchedArt = allocated
    .map((a) => byEpic.get(a.epicId))
    .filter((e): e is EpicRow => e != null && e.artId !== input.artId)
    .map((e) => ({
      epicId: e.id,
      title: e.title,
      currentArtName: e.artId ? (input.artNames[e.artId] ?? null) : null,
    }));

  return {
    artId: input.artId,
    cycles,
    cycleKey,
    sources,
    switchedArt,
    epicsWithoutArt: input.withoutArt,
    unfunded,
    // Der Builder kennt nur die Zuteilungen; Last und Rahmen kommen aus
    // weiteren Abfragen und werden vom Loader nachgereicht.
    coverage: null,
    pot: null,
    rtb: { run: [], change: [] },
    course: {
      portfolio:
        months.length > 0
          ? buildAllocationCourse(
              months.map((m) => ({ key: m.key, label: m.label })),
              courseEpics,
              todayIndex,
            )
          : null,
      art: null,
    },
    todayIndex,
  };
}

/** Lädt den Budget-Reiter eines ARTs. */
export async function loadArtBudgetDetail(
  db: PrismaClient,
  tenantId: TenantId,
  art: { id: string; valueStreamId: string },
  opts: {
    now?: Date;
    cycleKey?: string | undefined;
    /** Practice `artEpics` — ohne sie gibt es keinen Rahmen und keine Fläche. */
    artEpics?: boolean;
    /** Aufgelöstes Portfolio-Limit des Wertstroms. */
    threshold?: number;
  } = {},
): Promise<ArtBudgetDetail> {
  const now = opts.now ?? new Date();

  const [finals, vsFinals, arts, artCycles] = await Promise.all([
    db.budgetCandidate.findMany({
      where: { tenantId, kind: "epic", artId: art.id },
      select: {
        epicId: true,
        title: true,
        ask: true,
        finalAmount: true,
        round: { select: { cycleKey: true, status: true } },
      },
    }),
    // Zuteilungen des Wertstroms ohne ART — sie tauchen in keiner ART-Sicht auf.
    db.budgetCandidate.findMany({
      where: {
        tenantId,
        kind: "epic",
        valueStreamId: art.valueStreamId,
        artId: null,
        finalAmount: { not: null },
      },
      select: { finalAmount: true },
    }),
    db.art.findMany({ where: { tenantId }, select: { id: true, name: true } }),
    // Die Halbjahre, in denen dieser ART aus seinem Rahmen verteilt hat — zweite
    // Quelle der Achse (siehe `artCycleKeys`).
    db.artEpicAllocation.findMany({
      where: { tenantId, artId: art.id },
      select: { cycleKey: true },
      distinct: ["cycleKey"],
    }),
  ]);

  const candidates: CandidateRow[] = finals
    .filter((f): f is typeof f & { epicId: string } => f.epicId != null)
    .map((f) => ({
      epicId: f.epicId,
      title: f.title,
      ask: Number(f.ask),
      amount: f.finalAmount == null ? null : Number(f.finalAmount),
      cycleKey: f.round.cycleKey,
      decided: f.round.status === "closed",
    }));

  const epics = await loadEpicRows(db, tenantId, candidates);

  const detail = buildArtBudgetDetail({
    artId: art.id,
    now,
    candidates,
    epics,
    artNames: Object.fromEntries(arts.map((a) => [a.id, a.name])),
    withoutArt: {
      count: vsFinals.length,
      amount: vsFinals.reduce((s, f) => s + Number(f.finalAmount), 0),
    },
    artCycleKeys: artCycles.map((c) => c.cycleKey),
    ...(opts.cycleKey != null ? { cycleKey: opts.cycleKey } : {}),
  });

  // Zuteilung je Zyklus — Zähler des Satzes und Bezugsgröße der Lücke.
  const allocatedByCycle: Record<string, number> = {};
  for (const c of candidates) {
    if (c.amount == null) continue;
    allocatedByCycle[c.cycleKey] = (allocatedByCycle[c.cycleKey] ?? 0) + c.amount;
  }

  const [coverage, pot, rtbItems] = await Promise.all([
    loadArtCoverage(db, tenantId, art.id, detail.cycleKey, allocatedByCycle),
    opts.artEpics
      ? loadArtPotView(db, tenantId, art, detail.cycleKey, opts.threshold ?? 100_000, now)
      : Promise.resolve(null),
    listRtbItems(db, tenantId, { artId: art.id }),
  ]);

  const rtbRow = (i: (typeof rtbItems)[number]) => ({
    id: i.id,
    name: i.name,
    cycleAmount: rtbCycleAmount(i.plannedAmount, i.interval),
    annualAmount: rtbAnnualAmount(i.plannedAmount, i.interval),
  });

  return {
    ...detail,
    coverage,
    pot,
    // Betrieb und Veränderungsrahmen getrennt: das eine ist Run, das andere
    // Grow — in einer Summe wären beide falsch dargestellt.
    rtb: {
      run: rtbItems.filter((i) => i.active && !isChangeKind(i.kind)).map(rtbRow),
      change: rtbItems.filter((i) => i.active && isChangeKind(i.kind)).map(rtbRow),
    },
    // Zwei Quellen, getrennt ausgewiesen: beide schreiben in dieselbe
    // `BudgetAllocation`, die Vermischung entstünde also von selbst.
    sources:
      pot && pot.breakdown.total > 0
        ? [
            ...detail.sources,
            {
              source: "art" as const,
              label: ALLOCATION_SOURCE_LABELS.art,
              breakdown: pot.breakdown,
              titles: pot.titles,
            },
          ]
        : detail.sources,
  };
}

/** Lädt die Epics der Kandidaten samt rekonstruierter Reifegrad-Historie. */
async function loadEpicRows(
  db: PrismaClient,
  tenantId: TenantId,
  candidates: readonly CandidateRow[],
): Promise<EpicRow[]> {
  const rows = await db.initiative.findMany({
    where: {
      tenantId,
      level: InitiativeLevel.EPIC,
      deletedAt: null,
      id: { in: [...new Set(candidates.map((c) => c.epicId))] },
    },
    select: {
      id: true,
      title: true,
      stageGate: true,
      artId: true,
      implementationCompletedAt: true,
      // Reifegrad-Historie: aus diesen Stempeln rekonstruiert `buildEpicStageTimeline`,
      // in welchem Zustand das Epic in einem gegebenen Monat stand.
      createdAt: true,
      selectedForDetailingAt: true,
      hypothesisApprovedAt: true,
      selectedForAnalyzingAt: true,
      businessCaseApprovedAt: true,
      implementationStartedAt: true,
      impactRecognizedAt: true,
      timeline: true,
    },
  });

  const iso = (d: Date | null): string | null => (d == null ? null : d.toISOString());
  return rows.map((e) => ({
    id: e.id,
    title: e.title,
    stageGate: e.stageGate,
    artId: e.artId,
    implementationCompletedAt: e.implementationCompletedAt,
    stageTimeline: buildEpicStageTimeline({
      createdAt: e.createdAt.toISOString(),
      selectedForDetailingAt: iso(e.selectedForDetailingAt),
      hypothesisApprovedAt: iso(e.hypothesisApprovedAt),
      selectedForAnalyzingAt: iso(e.selectedForAnalyzingAt),
      businessCaseApprovedAt: iso(e.businessCaseApprovedAt),
      implementationStartedAt: iso(e.implementationStartedAt),
      impactRecognizedAt: iso(e.impactRecognizedAt),
      timeline: e.timeline,
    }),
  }));
}

/**
 * Derselbe Verlauf für einen **ganzen Wertstrom** — alle Epics, die eine
 * Kachel diesem Wertstrom zugeteilt hat, unabhängig vom ART.
 *
 * Bewusst ein eigener, schmaler Einstieg statt eines Scope-Schalters im
 * ART-Modell: die ART-Sicht trägt Aussagen, die es auf Wertstrom-Ebene nicht
 * gibt (gewechselter ART, Epics ohne ART). Ein gemeinsamer Typ mit halb
 * gefüllten Feldern wäre schlechter als zwei ehrliche.
 */
export async function loadValueStreamCourse(
  db: PrismaClient,
  tenantId: TenantId,
  valueStreamId: string,
  opts: { now?: Date; cycleKey?: string | undefined } = {},
): Promise<{
  cycles: { key: string; label: string }[];
  cycleKey: string;
  course: AllocationCourse | null;
  todayIndex: number;
}> {
  const now = opts.now ?? new Date();

  const finals = await db.budgetCandidate.findMany({
    where: { tenantId, kind: "epic", valueStreamId, finalAmount: { not: null } },
    select: {
      epicId: true,
      title: true,
      ask: true,
      finalAmount: true,
      round: { select: { cycleKey: true, status: true } },
    },
  });

  const candidates: CandidateRow[] = finals
    .filter((f): f is typeof f & { epicId: string } => f.epicId != null)
    .map((f) => ({
      epicId: f.epicId,
      title: f.title,
      ask: Number(f.ask),
      amount: f.finalAmount == null ? null : Number(f.finalAmount),
      cycleKey: f.round.cycleKey,
      decided: f.round.status === "closed",
    }));

  const epics = await loadEpicRows(db, tenantId, candidates);

  // Der Builder trägt ART-spezifische Aussagen mit; für den Wertstrom
  // interessiert nur der Kurs, deshalb ein Sentinel-ART, den kein Epic hat.
  const detail = buildArtBudgetDetail({
    artId: "__value_stream__",
    now,
    candidates,
    epics,
    artNames: {},
    withoutArt: { count: 0, amount: 0 },
    ...(opts.cycleKey != null ? { cycleKey: opts.cycleKey } : {}),
  });

  return {
    cycles: detail.cycles,
    cycleKey: detail.cycleKey,
    course: detail.course.portfolio,
    todayIndex: detail.todayIndex,
  };
}

/**
 * Last gegen Deckung eines ARTs im gewählten Halbjahr.
 *
 * Der Nenner des Satzes ist **neu**: `aggregateArtFeatureLoad` bucketet nach
 * geplanter PI und filtert nicht nach Status — für den Durchsatz braucht es die
 * *fertiggestellten* Features, gebucketet nach ihrem **Abschluss**-Halbjahr.
 * Zwei verschiedene Fragen, deshalb zwei Aggregationen statt eines Schalters.
 *
 * Datierungsregel wie bei `buildEpicStageTimeline`: Actual vor Estimate —
 * `completedAt`, ersatzweise das Ende der zugewiesenen PI. Features ohne beides
 * fallen aus dem Nenner **und werden gezählt**, damit die Zahl ihre Lücke kennt.
 */
export async function loadArtCoverage(
  db: PrismaClient,
  tenantId: TenantId,
  artId: string,
  cycleKey: string,
  allocatedByCycle: Record<string, number>,
): Promise<ArtCoverage> {
  const [features, tenant] = await Promise.all([
    db.initiative.findMany({
      where: { tenantId, level: InitiativeLevel.FEATURE, deletedAt: null, artId },
      select: {
        status: true,
        completedAt: true,
        wsjfJobSize: true,
        pi: { select: { startDate: true, endDate: true } },
      },
    }),
    db.tenant.findUnique({ where: { id: tenantId }, select: { costPerJobSizePoint: true } }),
  ]);

  // Nenner: fertiggestellte Features je Abschluss-Halbjahr.
  const doneByCycle = new Map<string, { jobSize: number; count: number }>();
  let undated = 0;
  let placeholder = 0;
  let plannedJobSize = 0;
  let plannedCount = 0;

  for (const f of features) {
    const jobSize = f.wsjfJobSize ?? 0;
    if (f.wsjfJobSize === 3) placeholder += 1;

    if (f.status === "completed") {
      const at = f.completedAt ?? f.pi?.endDate ?? null;
      if (at == null) {
        undated += 1;
      } else {
        const key = halfYearKey(at);
        const cur = doneByCycle.get(key) ?? { jobSize: 0, count: 0 };
        doneByCycle.set(key, { jobSize: cur.jobSize + jobSize, count: cur.count + 1 });
      }
    }

    // Zähler der Last: was im gewählten Halbjahr eingeplant ist.
    if (f.pi?.startDate && halfYearKey(f.pi.startDate) === cycleKey) {
      plannedJobSize += jobSize;
      plannedCount += 1;
    }
  }

  // Nur Zyklen, die vor dem gewählten liegen — der laufende ist nicht abgeschlossen.
  const cycles: ThroughputCycle[] = [...doneByCycle.entries()]
    .filter(([key]) => key < cycleKey)
    .map(([key, v]) => ({
      cycleKey: key,
      budget: allocatedByCycle[key] ?? 0,
      jobSize: v.jobSize,
      featureCount: v.count,
    }));

  const rate = deriveJobSizeRate({
    cycles,
    tenantDefault: tenant?.costPerJobSizePoint != null ? Number(tenant.costPerJobSizePoint) : null,
    undatedFeatures: undated,
    placeholderJobSize: placeholder,
  });

  const loadEuro = loadInEuro(plannedJobSize, rate);
  const allocated = allocatedByCycle[cycleKey] ?? 0;

  return {
    plannedJobSize,
    featureCount: plannedCount,
    rate,
    loadEuro,
    allocated,
    gap: loadEuro == null ? null : loadEuro - allocated,
  };
}

/**
 * Der Veränderungsrahmen eines ARTs und die Epics, auf die er verteilt wird.
 *
 * Gelistet werden nur Epics, die **vorgemerkt** (`stagedForBudgeting`),
 * **budgeting-reif** und der Klasse `art` sind. Die Vormerkung bleibt der aktive
 * Schritt des Owners — sie meldet hier keine Portfolio-Runde an, sondern die
 * Verteilung durch den Wertstrom.
 */
export async function loadArtPotView(
  db: PrismaClient,
  tenantId: TenantId,
  art: { id: string; valueStreamId: string },
  cycleKey: string,
  threshold: number,
  now: Date = new Date(),
): Promise<ArtPotView> {
  const [pot, allocations, candidates] = await Promise.all([
    loadArtPot(db, tenantId, art.id, cycleKey, now),
    loadArtEpicAllocations(db, tenantId, art.id, cycleKey),
    db.initiative.findMany({
      where: {
        tenantId,
        level: InitiativeLevel.EPIC,
        deletedAt: null,
        artId: art.id,
        stagedForBudgeting: true,
        businessCaseApprovedAt: { not: null },
      },
      select: {
        id: true,
        title: true,
        stageGate: true,
        implementationCompletedAt: true,
        businessCase: true,
        businessCaseApprovedAt: true,
        hypothesisApprovedAt: true,
        portfolioOverrideAt: true,
      },
    }),
  ]);

  const byEpic = new Map(allocations.map((a) => [a.epicId, a]));

  const rows = candidates.flatMap((e) => {
    const c = classifyEpic(e, threshold);
    if (c.epicClass !== "art") return [];
    const existing = byEpic.get(e.id);
    const currentAsk = c.cost ?? 0;
    // Der Richtwert friert beim ersten Zuteilen ein — sonst verschöbe sich die
    // Liste zwischen zwei Besuchen, ohne dass jemand etwas getan hat.
    const ask = existing ? existing.ask : currentAsk;
    return [
      {
        epicId: e.id,
        title: e.title,
        stageGate: e.stageGate,
        ask,
        amount: existing?.amount ?? 0,
        askDrifted: existing != null && existing.ask !== currentAsk,
      },
    ];
  });

  rows.sort((a, b) => b.ask - a.ask);

  // Die zweite Quelle bekommt dieselbe Staffel wie die erste — getrennt
  // ausgewiesen, nicht stillschweigend addiert.
  const byId = new Map(candidates.map((c) => [c.id, c]));
  const breakdown = summarizeAllocations(
    rows.map((r) => ({
      epicId: r.epicId,
      amount: r.amount,
      stageGate: r.stageGate,
      implementationCompletedAt: byId.get(r.epicId)?.implementationCompletedAt ?? null,
    })),
  );

  return {
    pot,
    rows,
    breakdown,
    titles: Object.fromEntries(rows.map((r) => [r.epicId, r.title])),
  };
}
