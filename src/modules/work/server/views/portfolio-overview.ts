import type { PrismaClient } from "@/generated/prisma";
import type { TenantId, ArtId } from "@/modules/core/kernel/domain/types";
import { listEpics } from "@/modules/work/server/services/epic";
import { listOverviewFeatures } from "@/modules/work/server/services/feature";
import { parseTimeline } from "@/modules/work/domain/timeline";
import {
  computeStructureGap,
  computePracticeAdoption,
  deriveNextSteps,
  type StructureGap,
  type PracticeAdoption,
  type NextStep,
} from "@/server/services/transformation";
import { halfYearKey, dayStart, isoDay, MS_PER_DAY } from "@/modules/core/kernel/domain/calendar";
import { epicBucket } from "@/modules/work/domain/stage-gate";
import { isAtRisk, type RollupTrio } from "@/modules/core/goals/domain/goals-rollup";
import { isClosed } from "@/modules/core/goals/domain/goal-status";
import { loadStrategyTree } from "@/modules/core/goals/server/views/ziele-view";
import {
  loadEpicGoalContributions,
  type EpicGoalContribution,
} from "@/modules/core/goals/server/views/epic-goal-contributions";
import type { RoamStatus } from "@/modules/core/kernel/domain/roam";
import { listTenantUserLabels } from "@/server/services/tenant-users";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

/** Stage gate keys, in canonical Funnel→Done order. */
export const STAGE_GATES = ["L0", "L1", "L2", "L3", "L4", "L5"] as const;
export type StageGate = (typeof STAGE_GATES)[number];

export const STAGE_GATE_LABEL: Record<StageGate, string> = {
  L0: "Funnel",
  L1: "Hypothese erstellen",
  L2: "Analyzing",
  L3: "Portfolio Backlog",
  L4: "Implementing",
  L5: "Done",
};

/**
 * Portfolio-Filter (Mehrfachauswahl je Dimension; leere Arrays = keine
 * Einschränkung). Wirkt „auf die gesamte Übersicht": der Loader reicht ihn an
 * `listEpics`/`listOverviewFeatures`/`loadStrategyTree` weiter; die Risks- und
 * Budgeting-Adapter (Composition-Root) filtern zusätzlich (Wertstrom/Owner).
 */
export interface PortfolioFilter {
  valueStreamIds: string[];
  stageGates: string[];
  statuses: string[];
  ownerIds: string[];
}

export const EMPTY_PORTFOLIO_FILTER: PortfolioFilter = {
  valueStreamIds: [],
  stageGates: [],
  statuses: [],
  ownerIds: [],
};

// ---------------------------------------------------------------------------
// Output shape — what the three Mission/Hero/Executive variants consume.
// ---------------------------------------------------------------------------

export interface OverviewEpicCard {
  id: string;
  title: string;
  status: string;
  stageGate: string;
  /** Genutzt fuer Kanban-Bucket-Splitt L0+Owner → „Hypothese erstellen". */
  ownerId: string | null;
  /** Stamp aus dem BC-Approval-Pfad. Treibt den L2+BC-approved → L3-Bucket. */
  businessCaseApprovedAt: Date | null;
  valueStream: { id: string; name: string } | null;
  updatedAt: Date;
  daysSinceUpdate: number;
  needsSteeringAttention: boolean;
}

/** Exposure-Band eines Risikos (score = probability·impact → Band). Lokale Union,
 *  da `ExposureBand` im `risks`-Modul liegt, das `work` nicht importieren darf. */
export type OverviewRiskBand = "low" | "medium" | "high" | "critical";

/**
 * Ein dokumentiertes, noch offenes Risiko für die Portfolio-Übersicht. Der
 * Risks-Adapter (Composition-Root) formt es fertig; `work` berechnet nichts an
 * `risks` (ADR-0013). `band`/`score` = aktuelle Exposure (null = ungescored).
 */
export interface OverviewRisk {
  id: string;
  riskNumber: number | null;
  title: string;
  band: OverviewRiskBand | null;
  score: number | null;
  roamStatus: RoamStatus;
  /** Erstes verknüpftes Epic (Risiken können 0..n Epics verlinken). */
  epic: { id: string; title: string } | null;
}

/**
 * Eine Zeile der Steering-Tabelle — ein Epic mit `needsSteeringAttention`.
 * `ownerName` aus `ownerLabels` aufgelöst; `daysSinceUpdate` treibt die Agenda-
 * Sortierung (längste ohne Update zuerst).
 */
export interface SteeringEpicRow {
  id: string;
  title: string;
  stageGate: StageGate;
  status: string;
  ownerName: string | null;
  valueStreamName: string | null;
  daysSinceUpdate: number;
}

export interface OverviewGoal {
  id: string;
  title: string;
  status: string | null;
  progress: number;
  epicLinkCount: number;
}

/**
 * One row of a "fällig"-Liste (Epic L4-Abschluss / Feature-Abschluss): what
 * lands soon (or is overdue). `dateIso` = the planned/estimated completion day;
 * `daysUntil` is signed (negative ⇒ overdue). `epic` set only for Feature rows.
 */
export interface DueSoonItem {
  id: string;
  title: string;
  /** Value-Stream name (muted subtitle). */
  subtitle: string | null;
  /** Parent Epic — Feature rows only; null for Epic rows. */
  epic: { id: string; title: string } | null;
  /** Planned completion, ISO yyyy-mm-dd. */
  dateIso: string;
  daysUntil: number;
  overdue: boolean;
}

export interface OverviewBudget {
  valueStreamId: string;
  name: string;
  total: number;
  currentPeriod: number;
  byPeriod: Record<string, number>;
}

export interface OverviewFundingPeriod {
  key: string;
  label: string;
  pool: number;
  allocated: number;
  remaining: number;
  isCurrent: boolean;
  isPast: boolean;
}

export interface OverviewFunding {
  currentPeriodKey: string;
  periods: OverviewFundingPeriod[];
  currentPeriod: OverviewFundingPeriod | null;
  upcomingPeriods: OverviewFundingPeriod[];
}

export interface OverviewActivePi {
  id: string;
  name: string;
  endDate: Date;
  daysRemaining: number;
}

export interface OverviewRecentEvent {
  id: string;
  title: string;
  stageGate: string;
  status: string;
  updatedAt: Date;
  valueStreamName: string | null;
}

export interface PortfolioOverview {
  epics: OverviewEpicCard[];
  epicsByGate: Record<StageGate, OverviewEpicCard[]>;
  epicsCount: number;

  oldestPerGate: Record<StageGate, OverviewEpicCard | null>;
  doneInLast90Days: number;
  funnelConversion: number;

  staleEpics: OverviewEpicCard[];
  blockedEpics: OverviewEpicCard[];
  /** Epics mit `needsSteeringAttention` — die Steering-Agenda-Tabelle. */
  steeringEpics: SteeringEpicRow[];
  impedimentsOpen: number;

  goals: OverviewGoal[];
  goalsOnTrack: number;
  goalAverageProgress: number;
  topGoal: OverviewGoal | null;

  /** Epics in L4 whose estimated implementation-end is ≤ 4 weeks out (or overdue). */
  l4DueSoon: DueSoonItem[];
  /** Open Features whose PI ends ≤ 2 weeks out (or overdue). */
  featuresDueSoon: DueSoonItem[];

  /** Dokumentierte, nicht-resolved Risiken, nach Kritikalität absteigend. */
  risks: OverviewRisk[];

  /** Epics mit Beitrag zu Kopf-Zielen, nach Gesamt-Plan-Beitrag absteigend. */
  goalContributions: EpicGoalContribution[];

  budgets: OverviewBudget[];
  poolTotal: number;
  poolAllocated: number;
  poolFree: number;
  valueStreamCount: number;
  funding: OverviewFunding;

  activePis: OverviewActivePi[];
  nearestPiEnd: OverviewActivePi | null;

  recentActivity: OverviewRecentEvent[];

  nextSteps: NextStep[];
}

// ---------------------------------------------------------------------------
// Input shape — what the service loader hands the builder.
// ---------------------------------------------------------------------------

/**
 * Theme-Eingabe fuer die Portfolio-Overview. Entspricht der V2-Ziele-Welt:
 * ein `Objective` (in der UI "Theme") mit seinen Key-Result-Trios und der
 * Zahl direkt verlinkter Epics. Ersetzt die fruehere TransformationGoal-
 * Form, die seit der Hierarchie-Vereinfachung leer bleibt.
 */
export interface PortfolioOverviewTheme {
  id: string;
  title: string;
  status: string | null;
  /** Completion 0..1 = normalisierter Ø der KR-Fortschritte (ADR-0008). */
  progress: number | null;
  trio: RollupTrio;
  epicLinkCount: number;
}

export interface PortfolioOverviewInputs {
  epics: Awaited<ReturnType<typeof listEpics>>;
  features: Awaited<ReturnType<typeof listOverviewFeatures>>;
  /** Dokumentierte, offene Risiken — vom Risks-Adapter fertig geformt (ADR-0013). */
  risks: OverviewRisk[];
  /** Epic→Kopf-Ziel-Beiträge (aus dem Goals-Modul; work↓core erlaubt). */
  goalContributions: EpicGoalContribution[];
  /** ownerId → Anzeigename, für die Owner-Spalte der Steering-Tabelle. */
  ownerLabels: Record<string, string>;
  themes: PortfolioOverviewTheme[];
  board: PortfolioBudgetingBoard;
  vsBudgets: PortfolioVsBudgets;
  activePis: Array<{ id: string; name: string; endDate: Date }>;
  impedimentsOpen: number;
  structureGap: StructureGap;
  practiceAdoption: PracticeAdoption;
  /** Pinned "today" — server passes `new Date()`, tests pass a fixed instant. */
  now: Date;
}

// ---------------------------------------------------------------------------
// Builder — pure presentation-glue. No I/O.
// ---------------------------------------------------------------------------

/**
 * Portfolio Overview page-model — turns the loaded aggregates into the
 * render-ready DTO every overview variant (Mission/Hero/Executive) consumes.
 * Pure: takes a typed `PortfolioOverviewInputs` bag with `now` injected, so
 * tests can pin the "current cycle" and "stale window" deterministically.
 *
 * The shape is wide (15 top-level fields) by design — the three variant
 * components stay pure pass-through.
 */
export function buildPortfolioOverviewModel(inputs: PortfolioOverviewInputs): PortfolioOverview {
  const {
    epics,
    features,
    risks: risksRaw,
    goalContributions: goalContributionsRaw,
    ownerLabels,
    themes,
    board,
    vsBudgets,
    activePis: activePisRaw,
    impedimentsOpen,
    structureGap,
    practiceAdoption,
    now,
  } = inputs;
  const nowMs = now.getTime();

  const cards: OverviewEpicCard[] = epics.map((e) => ({
    id: e.id,
    title: e.title,
    status: e.status,
    stageGate: e.stageGate,
    ownerId: e.ownerId,
    businessCaseApprovedAt: e.businessCaseApprovedAt,
    valueStream: e.valueStream,
    updatedAt: e.updatedAt,
    daysSinceUpdate: Math.floor((nowMs - new Date(e.updatedAt).getTime()) / (24 * 60 * 60 * 1000)),
    needsSteeringAttention: e.needsSteeringAttention,
  }));

  // Group epics by Kanban-Bucket. Wichtig: Bucket != Stage-Gate.
  // Bucket-Regel lebt in `domain/stage-gate.ts` (`epicBucket`). Konsumenten
  // (compact-kanban, period-banner) sehen die Karte in der jeweiligen Spalte;
  // STAGE_GATE_LABEL und das `stageGate`-Feld am Card sind unangetastet.
  const epicsByGate = Object.fromEntries(
    STAGE_GATES.map((g) => [g, [] as OverviewEpicCard[]]),
  ) as Record<StageGate, OverviewEpicCard[]>;
  for (const c of cards) {
    const gate = (STAGE_GATES as readonly string[]).includes(c.stageGate)
      ? (c.stageGate as StageGate)
      : null;
    if (!gate) continue;
    const bucket = epicBucket({
      stageGate: gate,
      ownerId: c.ownerId,
      businessCaseApprovedAt: c.businessCaseApprovedAt,
    });
    epicsByGate[bucket].push(c);
  }
  for (const gate of STAGE_GATES) {
    // Sortierung im Kanban: zuerst die fürs nächste Steering markierten
    // Epics (gelbe Karten), danach unmarkierte. Innerhalb jeder Gruppe
    // weiter oldest-first, damit der „liegt am längsten"-Hinweis bleibt.
    epicsByGate[gate].sort((a, b) => {
      if (a.needsSteeringAttention !== b.needsSteeringAttention) {
        return a.needsSteeringAttention ? -1 : 1;
      }
      return b.daysSinceUpdate - a.daysSinceUpdate;
    });
  }

  // `oldestPerGate` bewusst von der Display-Sortierung entkoppelt:
  // der „Flow & Pipeline"-Block braucht das tatsächlich älteste Epic
  // pro Gate, egal ob es markiert ist oder nicht.
  const oldestPerGate = Object.fromEntries(
    STAGE_GATES.map((g) => {
      const arr = epicsByGate[g];
      if (arr.length === 0) return [g, null];
      const oldest = arr.reduce((max, c) => (c.daysSinceUpdate > max.daysSinceUpdate ? c : max));
      return [g, oldest];
    }),
  ) as Record<StageGate, OverviewEpicCard | null>;

  // L5 (Done) epics whose last update is within 90 days serve as a coarse
  // throughput proxy until we have explicit stage-entry timestamps.
  const doneInLast90Days = cards.filter(
    (c) => c.stageGate === "L5" && nowMs - new Date(c.updatedAt).getTime() <= NINETY_DAYS_MS,
  ).length;
  const funnelCount = epicsByGate.L0.length;
  const funnelConversion =
    doneInLast90Days + funnelCount === 0 ? 0 : doneInLast90Days / (doneInLast90Days + funnelCount);

  const staleEpics = cards.filter(
    (c) =>
      nowMs - new Date(c.updatedAt).getTime() > THIRTY_DAYS_MS &&
      c.status !== "completed" &&
      c.status !== "cancelled",
  );
  const blockedEpics = cards.filter((c) => c.status === "blocked");

  // Steering-Agenda: Epics, die fürs nächste Steering-Meeting markiert sind.
  // Owner-Name aus `ownerLabels` (nur `ownerId` liegt auf der Card). Sortierung:
  // längste ohne Update zuerst — das braucht am ehesten eine Entscheidung.
  const steeringEpics: SteeringEpicRow[] = cards
    .filter((c) => c.needsSteeringAttention)
    .map((c) => ({
      id: c.id,
      title: c.title,
      stageGate: (STAGE_GATES as readonly string[]).includes(c.stageGate)
        ? (c.stageGate as StageGate)
        : "L0",
      status: c.status,
      ownerName: c.ownerId ? (ownerLabels[c.ownerId] ?? null) : null,
      valueStreamName: c.valueStream?.name ?? null,
      daysSinceUpdate: c.daysSinceUpdate,
    }))
    .sort((a, b) => b.daysSinceUpdate - a.daysSinceUpdate);

  // Risiken kommen fertig geformt vom Adapter (Exposure bereits berechnet).
  // Hier nur die Präsentations-Sortierung: kritischste zuerst (score desc),
  // ungescorte (score null) ans Ende, Tie-Break riskNumber aufsteigend.
  const risks: OverviewRisk[] = [...risksRaw].sort((a, b) => {
    const sa = a.score ?? -1;
    const sb = b.score ?? -1;
    if (sa !== sb) return sb - sa;
    return (a.riskNumber ?? Infinity) - (b.riskNumber ?? Infinity);
  });

  // Epic-Beitrag zu Kopf-Zielen: nach Gesamt-Plan (Σ planned über alle Einheiten
  // von wiederkehrend + einmalig) absteigend — die größten „Beiträge" oben.
  // Einheiten-Mix ist beim Ranking bewusst heuristisch; die Anzeige bleibt je
  // Einheit getrennt. Werte kommen fertig aggregiert.
  const totalPlanned = (c: EpicGoalContribution): number =>
    [...c.recurring, ...c.oneTime].reduce((s, v) => s + v.planned, 0);
  const goalContributions: EpicGoalContribution[] = [...goalContributionsRaw].sort(
    (a, b) => totalPlanned(b) - totalPlanned(a),
  );

  // Strategy — Themes (Objectives in V2) statt legacy TransformationGoals.
  // Completion = normalisierter Ø der KR-Fortschritte (ADR-0008), konsistent
  // mit Ziele-Liste + Detail. Das €-Trio bleibt die separate Geld-Sicht.
  const goals: OverviewGoal[] = themes.map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    progress: t.progress ?? 0,
    epicLinkCount: t.epicLinkCount,
  }));
  // In-flight = offen oder noch ohne Check-in (null); geschlossene Ziele
  // (achieved/partial/missed/dropped) zaehlen nicht zu den aktiven.
  const isInFlight = (s: string | null) => !isClosed(s);
  const activeGoals = goals.filter((g) => isInFlight(g.status));
  const goalAverageProgress =
    activeGoals.length === 0
      ? 0
      : activeGoals.reduce((s, g) => s + g.progress, 0) / activeGoals.length;
  // "On-track" = nicht im Drift-Bereich (Run-Rate >= 70% des Planned).
  const activeThemes = themes.filter((t) => isInFlight(t.status));
  const goalsOnTrack = activeThemes.filter((t) => !isAtRisk(t.trio)).length;
  const topGoal =
    activeGoals.length === 0 ? null : [...activeGoals].sort((a, b) => b.progress - a.progress)[0]!;

  // "Fällig"-Listen — was in den nächsten N Wochen laut Plan/Estimate landet
  // (oder schon überfällig ist). Kein unteres Datumsfenster ⇒ Überfällige sind
  // dabei (`overdue`, sortieren durch die aufsteigende Datumssortierung nach oben).
  const today = dayStart(now).getTime();
  const signedDays = (ms: number) => Math.round((ms - today) / MS_PER_DAY);

  // (A) Epics in L4: geschätzter Umsetzungs-Abschluss (`estimates.implementation`) ≤ 4 Wochen.
  const l4Horizon = today + 28 * MS_PER_DAY;
  const l4DueSoon: DueSoonItem[] = epics
    .map((e) => ({ e, iso: parseTimeline(e.timeline).estimates.implementation ?? null }))
    .filter(
      (x): x is { e: (typeof epics)[number]; iso: string } =>
        x.iso != null && x.e.stageGate === "L4" && Date.parse(x.iso) <= l4Horizon,
    )
    .map(({ e, iso }) => ({
      id: e.id,
      title: e.title,
      subtitle: e.valueStream?.name ?? null,
      epic: null,
      dateIso: iso,
      daysUntil: signedDays(Date.parse(iso)),
      overdue: Date.parse(iso) < today,
    }))
    .sort((a, b) => a.dateIso.localeCompare(b.dateIso));

  // (B) Offene Features: Plan-Abschluss = PI-Ende (`pi.endDate`) ≤ 2 Wochen.
  // Der Loader filtert bereits completed/cancelled + Backlog (kein PI) heraus.
  const featureHorizon = today + 14 * MS_PER_DAY;
  const featuresDueSoon: DueSoonItem[] = features
    .filter((f): f is typeof f & { pi: { endDate: Date } } => f.pi != null)
    .filter((f) => f.pi.endDate.getTime() <= featureHorizon)
    .map((f) => {
      const ms = dayStart(f.pi.endDate).getTime();
      return {
        id: f.id,
        title: f.title,
        subtitle: f.parent?.valueStream?.name ?? null,
        epic: f.parent ? { id: f.parent.id, title: f.parent.title } : null,
        dateIso: isoDay(f.pi.endDate),
        daysUntil: signedDays(ms),
        overdue: ms < today,
      };
    })
    .sort((a, b) => a.dateIso.localeCompare(b.dateIso));

  // Funding — derive pool vs allocated per half-year. Pool lives on the
  // tenant (`budgetPoolByPeriod`); allocations come from per-Epic budget rows
  // rolled up by Value Stream.
  const currentPeriodKey = halfYearKey(now);
  const fundingPeriods: OverviewFundingPeriod[] = board.periods.map((p) => {
    const pool = board.pool[p.key] ?? 0;
    const allocated = vsBudgets.valueStreams.reduce((s, vs) => s + (vs.byPeriod[p.key] ?? 0), 0);
    return {
      key: p.key,
      label: p.label,
      pool,
      allocated,
      remaining: pool - allocated,
      isCurrent: p.key === currentPeriodKey,
      isPast: p.key < currentPeriodKey,
    };
  });
  const currentPeriod = fundingPeriods.find((p) => p.isCurrent) ?? null;
  const upcomingPeriods = fundingPeriods.filter((p) => p.key > currentPeriodKey).slice(0, 2);

  const budgets: OverviewBudget[] = vsBudgets.valueStreams.map((b) => ({
    valueStreamId: b.valueStreamId,
    name: b.name,
    total: b.total,
    currentPeriod: b.byPeriod[currentPeriodKey] ?? 0,
    byPeriod: b.byPeriod,
  }));

  // Headline numbers across the whole horizon — Hero/Executive variants read
  // these for their KPI strips.
  const poolTotal = fundingPeriods.reduce((s, p) => s + p.pool, 0);
  const poolAllocated = fundingPeriods.reduce((s, p) => s + p.allocated, 0);
  const poolFree = Math.max(0, poolTotal - poolAllocated);

  const activePis: OverviewActivePi[] = activePisRaw.map((p) => ({
    id: p.id,
    name: p.name,
    endDate: p.endDate,
    daysRemaining: Math.max(
      0,
      Math.ceil((new Date(p.endDate).getTime() - nowMs) / (24 * 60 * 60 * 1000)),
    ),
  }));
  const nearestPiEnd = activePis[0] ?? null;

  // Recent activity: top 5 most recently touched epics, regardless of status.
  const recentActivity: OverviewRecentEvent[] = [...cards]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5)
    .map((c) => ({
      id: c.id,
      title: c.title,
      stageGate: c.stageGate,
      status: c.status,
      updatedAt: c.updatedAt,
      valueStreamName: c.valueStream?.name ?? null,
    }));

  // Coaching layer reuses the transformation recommendation engine.
  const nextSteps = deriveNextSteps(structureGap, practiceAdoption);

  return {
    epics: cards,
    epicsByGate,
    epicsCount: cards.length,
    oldestPerGate,
    doneInLast90Days,
    funnelConversion,
    staleEpics,
    blockedEpics,
    steeringEpics,
    impedimentsOpen,
    goals,
    goalsOnTrack,
    goalAverageProgress,
    topGoal,
    l4DueSoon,
    featuresDueSoon,
    risks,
    goalContributions,
    budgets,
    poolTotal,
    poolAllocated,
    poolFree,
    valueStreamCount: vsBudgets.valueStreams.length,
    funding: {
      currentPeriodKey,
      periods: fundingPeriods,
      currentPeriod,
      upcomingPeriods,
    },
    activePis,
    nearestPiEnd,
    recentActivity,
    nextSteps,
  };
}

/**
 * Loads every input the Portfolio Overview page-model needs in one parallel
 * wave. Pure I/O — no reshape, no business derivation. The companion builder
 * `buildPortfolioOverviewModel` (above) owns the reshape; this loader exists
 * separately so the builder is testable against in-memory fixtures.
 */
/** Port: liefert die Anzahl offener Impediments für die ARTs. Der Composition-
 *  Root (Portfolio-Route) reicht den Drumbeat-Adapter herein — Work importiert
 *  den Impediment-Service (Drumbeat) nicht direkt (ADR-0013). */
export type OpenImpedimentsCountPort = (artIds: ArtId[]) => Promise<number>;

/** Budgeting-Daten, die die Portfolio-Übersicht anzeigt — als Struktur-Vertrag,
 *  damit das Work-View den Budgeting-Service (oberer Layer) nicht importiert
 *  (ADR-0013). Der Composition-Root (Route) reicht den Budgeting-Adapter herein. */
export interface PortfolioBudgetingBoard {
  periods: { key: string; label: string }[];
  pool: Record<string, number>;
}
export interface PortfolioVsBudgets {
  valueStreams: {
    valueStreamId: string;
    name: string;
    total: number;
    byPeriod: Record<string, number>;
  }[];
}
export type BudgetingDataPort = () => Promise<{
  board: PortfolioBudgetingBoard;
  vsBudgets: PortfolioVsBudgets;
}>;

/** Port: liefert die render-fertigen, dokumentierten Risiken. Der Composition-
 *  Root reicht den Risks-Adapter herein — Work importiert `@/modules/risks`
 *  nicht direkt (ADR-0013). */
export type RisksSummaryPort = () => Promise<OverviewRisk[]>;

export async function loadPortfolioOverviewInputs(
  db: PrismaClient,
  tenantId: TenantId,
  getOpenImpedimentsCount: OpenImpedimentsCountPort,
  getBudgetingData: BudgetingDataPort,
  getRisks: RisksSummaryPort,
  filter: PortfolioFilter = EMPTY_PORTFOLIO_FILTER,
): Promise<PortfolioOverviewInputs> {
  const [
    epics,
    features,
    risks,
    goalContributions,
    ownerLabels,
    strategyTree,
    budgeting,
    arts,
    activePis,
    structureGap,
    practiceAdoption,
  ] = await Promise.all([
    listEpics(db, tenantId, {
      valueStreamIds: filter.valueStreamIds,
      stageGates: filter.stageGates,
      statuses: filter.statuses,
      ownerIds: filter.ownerIds,
    }),
    listOverviewFeatures(db, tenantId, {
      valueStreamIds: filter.valueStreamIds,
      statuses: filter.statuses,
      ownerIds: filter.ownerIds,
    }),
    getRisks(),
    loadEpicGoalContributions(db, tenantId),
    listTenantUserLabels(db, tenantId),
    // Ziele: nur der Wertstrom-Filter greift (loadStrategyTree kennt nur diesen).
    loadStrategyTree(db, tenantId, { valueStreamIds: filter.valueStreamIds }),
    getBudgetingData(),
    db.art.findMany({
      where: { tenantId, deletedAt: null },
      select: { id: true },
    }),
    db.programIncrement.findMany({
      where: { tenantId, status: "active" },
      select: { id: true, name: true, endDate: true },
      orderBy: { endDate: "asc" },
    }),
    computeStructureGap(db, tenantId),
    computePracticeAdoption(db, tenantId),
  ]);

  // ThemeEpicLink-Bridge ist V2-schema-ready, hat aber noch keine UI-Pflege —
  // bis dahin koennen Themes keine direkten Epic-Links zaehlen. Zeigt als 0.
  const themes: PortfolioOverviewTheme[] = strategyTree.themes.map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    progress: t.progress,
    trio: t.trio,
    epicLinkCount: 0,
  }));

  const artIds = arts.map((a) => a.id as ArtId);
  const impedimentsOpen = artIds.length === 0 ? 0 : await getOpenImpedimentsCount(artIds);
  const { board, vsBudgets } = budgeting;

  return {
    epics,
    features,
    risks,
    goalContributions,
    ownerLabels,
    themes,
    board,
    vsBudgets,
    activePis,
    impedimentsOpen,
    structureGap,
    practiceAdoption,
    now: new Date(),
  };
}

/**
 * Convenience wrapper: load + build, returned as one DTO. The page calls this;
 * tests prefer `buildPortfolioOverviewModel` with fixtures.
 */
export async function loadPortfolioOverview(
  db: PrismaClient,
  tenantId: TenantId,
  getOpenImpedimentsCount: OpenImpedimentsCountPort,
  getBudgetingData: BudgetingDataPort,
  getRisks: RisksSummaryPort,
  filter: PortfolioFilter = EMPTY_PORTFOLIO_FILTER,
): Promise<PortfolioOverview> {
  return buildPortfolioOverviewModel(
    await loadPortfolioOverviewInputs(
      db,
      tenantId,
      getOpenImpedimentsCount,
      getBudgetingData,
      getRisks,
      filter,
    ),
  );
}
