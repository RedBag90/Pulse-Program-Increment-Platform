/**
 * **Guardrail 2, gerechnet** — je ART ein Plan, je Wertstrom ihre Summe.
 *
 * Die Form steht in `work/server/views/value-stream-capacity-mix.ts`, die Regel
 * in `budgeting/domain/capacity-plan.ts`. Hier wird beschafft: das
 * Veränderungsgeld je ART und Halbjahr, der €-Satz aus der Historie desselben
 * ARTs, und die eingeplante Last je Arbeitstyp.
 *
 * **Je ART, nicht je Wertstrom.** Einen Wertstrom-Satz gibt es nicht und darf es
 * nicht geben — `budget-kpis.ts` begründet das im eigenen Kopf: gemessen
 * unterscheiden sich die Sätze zweier ARTs desselben Stroms um den Faktor 1,6,
 * und „wer 7.365.983 ÷ 635 rechnet, bekommt 11.600 € und hält das für *den*
 * Satz". Die Summe entsteht deshalb aus Punkten, nie aus einem gemittelten Satz.
 *
 * Impurer Lader plus reiner Falter — deshalb `views/`.
 */

import type { PrismaClient } from "@/generated/prisma";
import { halfYearLabel } from "@/modules/core/kernel/domain/calendar";
import type { TenantId } from "@/modules/core/kernel/domain/types";
import { currentCycle, compareCycles } from "@/modules/budgeting/domain/cycle";
import {
  buildCapacityPlan,
  capacityInPoints,
  emptyPointCell,
  sumCapacityPlans,
  type CapacityPlan,
  type PointCell,
} from "@/modules/budgeting/domain/capacity-plan";
import { loadArtChangeBudgetByCycle } from "@/modules/budgeting/server/services/art-epic-budget";
import { loadArtCoverage } from "@/modules/budgeting/server/services/art-coverage";
import {
  CAPACITY_BUCKETS,
  type GuardrailTargets,
} from "@/modules/work/domain/portfolio-guardrails";
import type {
  ArtWithoutRate,
  CapacityPlanByCycle,
  ValueStreamCapacityPlan,
} from "@/modules/work/server/views/value-stream-capacity-mix";

/** Wie viele vergangene Halbjahre die Entwicklungs-Tabelle zeigt. */
const HISTORY_CYCLES = 3;

interface ArtPlan {
  id: string;
  name: string;
  plan: CapacityPlan;
  /** Der erste Vorbehalt des Satzes — nur gefüllt, wenn es keinen Satz gibt. */
  rateReason: string | null;
}

/**
 * Der Plan **eines** ARTs in **einem** Halbjahr.
 *
 * Die Deckungsrechnung liefert bereits alles: die Last je Arbeitstyp, den Satz
 * und seine Herkunft. Sie wird hier nicht nachgebaut, sondern benutzt — sonst
 * gäbe es zwei Stellen, an denen „eingeplant in diesem Halbjahr" definiert ist.
 */
async function planForArt(
  db: PrismaClient,
  tenantId: TenantId,
  art: { id: string; name: string },
  cycleKey: string,
  budgetByCycle: Record<string, number>,
): Promise<ArtPlan> {
  const coverage = await loadArtCoverage(db, tenantId, art.id, cycleKey, budgetByCycle);
  const budget = budgetByCycle[cycleKey] ?? 0;
  const capacity = capacityInPoints(budget, coverage.rate);

  return {
    id: art.id,
    name: art.name,
    rateReason: capacity == null ? (coverage.rate.caveats[0] ?? "Kein €-Satz ableitbar.") : null,
    plan: buildCapacityPlan({
      budget,
      capacity,
      // Die Ziele je ART sind die des Wertstroms; die Aufteilung passiert auf
      // der ART-Kapazität, damit ein grosses ART nicht das Ziel eines kleinen
      // mitbestimmt.
      targets: { business: 0, enabler: 0, maintenance: 0 },
      plannedByBucket: coverage.plannedByBucket,
      unclassified: coverage.plannedUnclassified,
    }),
  };
}

/**
 * **Guardrail 2 eines Wertstroms.**
 *
 * Ein ART **ohne** €-Satz bringt seine geplanten Punkte mit, aber keine
 * verfügbaren — und wird namentlich genannt. Ihn mit dem mandantenweiten Satz
 * zu rechnen wäre eine Zahl, die dieses ART nie erreicht hat; ihn wegzulassen
 * verschwiege Arbeit, die eingeplant ist. Dasselbe Muster wie
 * `StreamKpi.withoutRate`.
 */
export async function loadValueStreamCapacityPlan(
  db: PrismaClient,
  tenantId: TenantId,
  valueStreamId: string,
  targets: GuardrailTargets,
  opts: { cycleKey?: string | undefined; now?: Date | undefined } = {},
): Promise<ValueStreamCapacityPlan> {
  const now = opts.now ?? new Date();
  const cycleKey = opts.cycleKey ?? currentCycle(now);

  const arts = await db.art.findMany({
    where: { tenantId, valueStreamId, deletedAt: null },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const budgets = await loadArtChangeBudgetByCycle(
    db,
    tenantId,
    arts.map((a) => a.id),
  );

  const cycles = historyCycles(cycleKey, budgets);

  // Je ART und je gezeigtem Halbjahr eine Rechnung. Die Zyklen liegen
  // hintereinander, die ARTs nebeneinander — der teure Teil ist die Abfrage je
  // ART, und die passiert ohnehin einmal je Zyklus.
  const byCycleArtPlans = new Map<string, ArtPlan[]>();
  for (const key of cycles) {
    byCycleArtPlans.set(
      key,
      await Promise.all(arts.map((a) => planForArt(db, tenantId, a, key, budgets.get(a.id) ?? {}))),
    );
  }

  const current = byCycleArtPlans.get(cycleKey) ?? [];
  return buildValueStreamPlan({
    cycleKey,
    targets,
    current,
    history: cycles.map((key) => ({ key, plans: byCycleArtPlans.get(key) ?? [] })),
  });
}

/**
 * Welche Halbjahre die Entwicklung zeigt: das gewählte und bis zu drei davor,
 * aber nur solche, in denen dieser Wertstrom überhaupt Geld hatte. Eine Zeile
 * über ein Halbjahr ohne Budget ist keine Entwicklung, sondern eine Null.
 */
function historyCycles(cycleKey: string, budgets: Map<string, Record<string, number>>): string[] {
  const seen = new Set<string>([cycleKey]);
  for (const byCycle of budgets.values()) {
    for (const [key, amount] of Object.entries(byCycle)) {
      if (amount > 0 && compareCycles(key, cycleKey) <= 0) seen.add(key);
    }
  }
  return [...seen].sort(compareCycles).slice(-(HISTORY_CYCLES + 1));
}

const addCells = (a: PointCell, b: PointCell): PointCell => ({
  count: a.count + b.count,
  jobSize: a.jobSize + b.jobSize,
});

/** Der reine Falter — aus ART-Plänen wird die Sicht des Wertstroms. */
export function buildValueStreamPlan(input: {
  cycleKey: string;
  targets: GuardrailTargets;
  current: readonly ArtPlan[];
  history: readonly { key: string; plans: readonly ArtPlan[] }[];
}): ValueStreamCapacityPlan {
  const summed = sumCapacityPlans(input.current.map((a) => a.plan));

  // Die Ziele des Wertstroms auf die **Summe** der Kapazitäten anwenden. Je ART
  // aufzuteilen und dann zu addieren ergäbe dasselbe — aber nur, solange jeder
  // ART einen Satz hat. Auf der Summe bleibt die Rechnung auch dann stimmig,
  // wenn ein ART fehlt.
  const withTargets = buildCapacityPlan({
    budget: summed.budget,
    capacity: summed.capacity,
    targets: input.targets.capacity,
    plannedByBucket: Object.fromEntries(
      CAPACITY_BUCKETS.map((b, i) => [b, summed.rows[i]!.planned]),
    ) as Record<(typeof CAPACITY_BUCKETS)[number], PointCell>,
    unclassified: summed.unclassified,
  });

  const artsWithoutRate: ArtWithoutRate[] = input.current
    .filter((a) => a.rateReason != null)
    .map((a) => ({
      id: a.id,
      name: a.name,
      jobSize: a.plan.totalPlanned.jobSize,
      reason: a.rateReason!,
    }));

  const byCycle: CapacityPlanByCycle[] = input.history.map(({ key, plans }) => {
    const sum = sumCapacityPlans(plans.map((p) => p.plan));
    const withT = buildCapacityPlan({
      budget: sum.budget,
      capacity: sum.capacity,
      targets: input.targets.capacity,
      plannedByBucket: Object.fromEntries(
        CAPACITY_BUCKETS.map((b, i) => [b, sum.rows[i]!.planned]),
      ) as Record<(typeof CAPACITY_BUCKETS)[number], PointCell>,
      unclassified: sum.unclassified,
    });
    return {
      cycleKey: key,
      label: halfYearLabel(key),
      rows: withT.rows.map((r) => ({
        bucket: r.bucket,
        planned: r.planned.jobSize,
        available: r.available,
      })),
    };
  });

  return {
    cycleKey: input.cycleKey,
    cycleLabel: halfYearLabel(input.cycleKey),
    budget: withTargets.budget,
    capacity: withTargets.capacity,
    rows: withTargets.rows,
    targets: input.targets.capacity,
    unclassified: withTargets.unclassified,
    totalPlanned: input.current.reduce(
      (acc, a) => addCells(acc, a.plan.totalPlanned),
      emptyPointCell(),
    ),
    artCount: input.current.length,
    artsWithoutRate,
    byCycle,
  };
}

/**
 * **Guardrail 2 fuers ganze Portfolio** — die Summe seiner Wertstroeme.
 *
 * Jeder Wertstrom rechnet mit **seinen** Zielen; die Summe addiert Punkte, nie
 * Prozente. Ein gemittelter Ziel-Anteil waere eine Zahl, die niemand gesetzt
 * hat — der ausgewiesene Anteil der Summe ergibt sich hinterher aus den Punkten.
 *
 * Die Ziele kommen als **Funktion** herein, statt dass dieser Lader sie
 * aufloest: die Aufloesung Wertstrom → Tenant → Code gehoert `work`, und der
 * Kompositionsroot hat sie ohnehin schon gebaut.
 */
export async function loadPortfolioCapacityPlan(
  db: PrismaClient,
  tenantId: TenantId,
  targetsFor: (valueStreamId: string) => GuardrailTargets,
  opts: { cycleKey?: string | undefined; now?: Date | undefined } = {},
): Promise<ValueStreamCapacityPlan> {
  const streams = await db.valueStream.findMany({
    where: { tenantId, deletedAt: null },
    select: { id: true },
    orderBy: { name: "asc" },
  });

  const plans = await Promise.all(
    streams.map((vs) => loadValueStreamCapacityPlan(db, tenantId, vs.id, targetsFor(vs.id), opts)),
  );
  return mergePlans(plans, opts.cycleKey ?? currentCycle(opts.now ?? new Date()));
}

/**
 * Mehrere Wertstrom-Plaene zu einem zusammenziehen.
 *
 * Die Ziel-Anteile der Summe werden aus den **verfuegbaren Punkten** abgeleitet
 * — sie sind das Ergebnis der einzelnen Vorgaben, nicht ihr Durchschnitt.
 */
function mergePlans(
  plans: readonly ValueStreamCapacityPlan[],
  cycleKey: string,
): ValueStreamCapacityPlan {
  const withRate = plans.filter((p) => p.capacity != null);
  const capacity =
    withRate.length === 0 ? null : withRate.reduce((s, p) => s + (p.capacity ?? 0), 0);

  const rows = CAPACITY_BUCKETS.map((bucket, i) => {
    const planned = plans.reduce((acc, p) => addCells(acc, p.rows[i]!.planned), emptyPointCell());
    const available =
      withRate.length === 0 ? null : withRate.reduce((s, p) => s + (p.rows[i]!.available ?? 0), 0);
    return {
      bucket,
      targetShare: capacity != null && capacity > 0 ? (available ?? 0) / capacity : 0,
      available,
      planned,
      delta: available == null ? null : planned.jobSize - available,
    };
  });

  const first = plans[0];
  return {
    cycleKey,
    cycleLabel: first?.cycleLabel ?? halfYearLabel(cycleKey),
    // Wie in `sumCapacityPlans`: nur das Geld, das zu Punkten wurde.
    budget: withRate.reduce((s, p) => s + p.budget, 0),
    capacity,
    rows,
    // Die Ziele der Summe sind die abgeleiteten Anteile — als Prozentwerte, wie
    // sie das Formular kennt. Gesetzt werden sie je Wertstrom.
    targets: Object.fromEntries(
      rows.map((r) => [r.bucket, Math.round(r.targetShare * 100)]),
    ) as ValueStreamCapacityPlan["targets"],
    unclassified: plans.reduce((acc, p) => addCells(acc, p.unclassified), emptyPointCell()),
    totalPlanned: plans.reduce((acc, p) => addCells(acc, p.totalPlanned), emptyPointCell()),
    artCount: plans.reduce((s, p) => s + p.artCount, 0),
    artsWithoutRate: plans.flatMap((p) => p.artsWithoutRate),
    byCycle: [],
  };
}
