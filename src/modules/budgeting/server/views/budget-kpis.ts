/**
 * **„Wofür · eingeplant"** — dieselbe Rechnung für den Wertstrom und für jedes
 * seiner ARTs, untereinander.
 *
 * Der Reiter existiert, damit die Arbeitsflächen die Herleitung nicht
 * mitschleppen müssen (`art-budget-process-layout.md`, §4). Das Ergebnis ist
 * keine Detailinformation — die Herleitung schon.
 *
 * **Es gibt keinen Wertstrom-Satz, und das ist der Kern dieser Datei.**
 * `deriveJobSizeRate` leitet den €-Satz aus der Historie **eines** ARTs ab
 * (`domain/art-throughput.ts`); gemessen unterscheiden sich die Sätze zweier
 * ARTs desselben Stroms um den Faktor 1,6. Die Wertstrom-Last ist deshalb die
 * **Summe zweier Rechnungen**, nicht „Σ Job Size × ein Satz". Wer 7.365.983 ÷
 * 635 rechnet, bekommt 11.600 € und hält das für „den Satz" — deshalb trägt die
 * Wertstrom-Zeile hier gar keinen.
 *
 * Impurer Lader **plus** reiner Falter — deshalb `views/`.
 */

import type { PrismaClient } from "@/generated/prisma";
import type { TenantId } from "@/modules/core/kernel/domain/types";
import type { ArtCoverage } from "@/modules/budgeting/domain/art-budget-model";
import { loadArtCoverages } from "@/modules/budgeting/server/services/art-coverage";
import type { BudgetStichtag } from "@/modules/budgeting/domain/budget-stichtag";
import {
  streamBurn,
  type BurnWindow,
  type JobSizeBurn,
} from "@/modules/budgeting/domain/job-size-burn";

export interface ArtKpiRow {
  artId: string;
  name: string;
  coverage: ArtCoverage;
}

/**
 * Die Wertstrom-Zeile. Sie trägt bewusst **keinen** `rate` — siehe oben.
 */
export interface StreamKpi {
  plannedJobSize: number;
  featureCount: number;
  /** Σ der ART-Lasten, soweit berechenbar. `null`, wenn keine einzige es ist. */
  loadEuro: number | null;
  allocated: number;
  /** `loadEuro − allocated`. `null`, wenn keine Last berechenbar war. */
  gap: number | null;
  /**
   * ARTs ohne €-Satz: ihre Last fehlt in der Summe. Die Fläche nennt sie, statt
   * eine unvollständige Zahl als vollständige auszugeben.
   */
  withoutRate: string[];
  /**
   * Plan gegen Ist in Job Size für den Wertstrom — Σ der ARTs **mit** Satz, je
   * mit ihrem eigenen Satz (`streamBurn`). Die ARTs ohne Satz stehen in
   * `withoutRate`; sie fehlen in Plan **und** Ist. `null` ohne laufende Kachel.
   */
  burn: JobSizeBurn | null;
}

export interface BudgetKpis {
  cycleKey: string;
  stream: StreamKpi;
  arts: ArtKpiRow[];
}

/** Faltet die ART-Rechnungen zur Wertstrom-Zeile. Rein. */
export function buildStreamKpi(
  arts: readonly ArtKpiRow[],
  /** Die geltende Budget-Kachel; ohne sie kein Verlauf. */
  burnWindow: BurnWindow | null = null,
  today: Date = new Date(),
): StreamKpi {
  const berechenbar = arts.filter((a) => a.coverage.loadEuro != null);
  const loadEuro =
    berechenbar.length === 0
      ? null
      : berechenbar.reduce((s, a) => s + (a.coverage.loadEuro ?? 0), 0);
  const allocated = arts.reduce((s, a) => s + a.coverage.allocated, 0);

  return {
    plannedJobSize: arts.reduce((s, a) => s + a.coverage.plannedJobSize, 0),
    featureCount: arts.reduce((s, a) => s + a.coverage.featureCount, 0),
    loadEuro,
    allocated,
    gap: loadEuro == null ? null : loadEuro - allocated,
    withoutRate: arts.filter((a) => a.coverage.loadEuro == null).map((a) => a.name),
    burn:
      burnWindow == null
        ? null
        : streamBurn(
            burnWindow,
            today,
            arts.flatMap((a) =>
              a.coverage.burn
                ? [{ burn: a.coverage.burn, completions: a.coverage.cycleCompletions }]
                : [],
            ),
          ),
  };
}

/**
 * **Wie der Job-Size-Verlauf gerade steht** — als Wort, für Kachel und Tabelle.
 * `none`: kein Plan (kein Satz, kein Budget, keine Kachel) oder die Kachel hat
 * noch nicht begonnen.
 */
export type BurnStatus = "inBand" | "over" | "under" | "none";

export function burnStatus(burn: JobSizeBurn | null): BurnStatus {
  if (burn == null || burn.reason !== "ok" || burn.deviation == null || burn.withinBand == null) {
    return "none";
  }
  if (burn.withinBand) return "inBand";
  return burn.deviation > 0 ? "over" : "under";
}

/** Last ÷ Budget. `null` ohne Last oder ohne Budget. */
export function coverageRatio(loadEuro: number | null, allocated: number): number | null {
  return loadEuro == null || allocated <= 0 ? null : loadEuro / allocated;
}

/** Ab welcher Abweichung — in beide Richtungen — der Satz verdächtig ist. */
export const RATE_SUSPICION_THRESHOLD = 0.5;

export interface RateSuspicion {
  artId: string;
  name: string;
  /** `high`: überbucht **und** über Plan; `low`: viel frei **und** unter Plan. */
  direction: "high" | "low";
}

/**
 * **Welche ARTs haben vermutlich einen falschen €-Satz?**
 *
 * Derselbe Satz treibt beide Kennzahlen, aber gegenläufig: die Last ist
 * Job Size × Satz, der Plan im Verlauf ist Budget ÷ Satz. Ist der Satz zu hoch,
 * wird die Last zu gross **und** der Plan zu klein — die Fläche meldet
 * „stark überbucht" und „weit über Plan" zugleich. Im Wertstrom „Produktion"
 * stand im September 2026 genau das: +846 % und +545 %, zwei Alarme, eine
 * Ursache. Ist er zu niedrig, kippt beides ins Gegenteil.
 *
 * Markiert wird nur, wenn **beide** Abweichungen die Schwelle überschreiten und
 * in diese Richtung zeigen. Rein.
 */
export function rateSuspicion(arts: readonly ArtKpiRow[]): RateSuspicion[] {
  const t = RATE_SUSPICION_THRESHOLD;
  return arts.flatMap((a): RateSuspicion[] => {
    const { gap, allocated, burn } = a.coverage;
    const dev = burn?.reason === "ok" ? burn.deviation : null;
    if (gap == null || dev == null || allocated <= 0) return [];
    const share = gap / allocated;
    if (share > t && dev > t) return [{ artId: a.artId, name: a.name, direction: "high" }];
    if (share < -t && dev < -t) return [{ artId: a.artId, name: a.name, direction: "low" }];
    return [];
  });
}

export async function loadBudgetKpis(
  db: PrismaClient,
  tenantId: TenantId,
  arts: readonly { id: string; name: string }[],
  opts: {
    /** Das gewählte Halbjahr — Last, Deckung, Lücke. */
    cycleKey: string;
    /** Der Budget-Stichtag: seine geltende Kachel ist das Fenster des Verlaufs. */
    stichtag: Pick<BudgetStichtag, "applied" | "now">;
  },
): Promise<BudgetKpis> {
  const { cycleKey, stichtag } = opts;
  const source = await loadArtCoverages(
    db,
    tenantId,
    arts.map((a) => a.id),
  );
  const burn = stichtag.applied ? { tile: stichtag.applied, today: stichtag.now } : null;
  const rows = arts.map((a) => ({
    artId: a.id,
    name: a.name,
    coverage: source.coverage(a.id, cycleKey, burn),
  }));
  return {
    cycleKey,
    stream: buildStreamKpi(rows, stichtag.applied, stichtag.now),
    arts: rows,
  };
}
