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
import { loadArtCoverage } from "@/modules/budgeting/server/services/art-coverage";
import { readBudgetCandidates } from "@/modules/budgeting/server/services/budget-reads";

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
}

export interface BudgetKpis {
  cycleKey: string;
  stream: StreamKpi;
  arts: ArtKpiRow[];
}

/** Faltet die ART-Rechnungen zur Wertstrom-Zeile. Rein. */
export function buildStreamKpi(arts: readonly ArtKpiRow[]): StreamKpi {
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
  };
}

export async function loadBudgetKpis(
  db: PrismaClient,
  tenantId: TenantId,
  arts: readonly { id: string; name: string }[],
  cycleKey: string,
): Promise<BudgetKpis> {
  /**
   * Die Zuteilungen **je ART und Halbjahr** — Bezugsgröße der Lücke im
   * gewählten Halbjahr und zugleich Zähler des Satzes in den vergangenen.
   * Dieselbe Rechnung steht in `loadArtBudgetDetail`; sie kommt aus demselben
   * geteilten Lader, damit beide Flächen nicht auseinanderlaufen können.
   */
  const candidates = await readBudgetCandidates(db, tenantId);
  const zuteilung = new Map<string, Record<string, number>>();
  for (const c of candidates) {
    if (c.kind !== "epic" || c.artId == null || c.finalAmount == null) continue;
    const je = zuteilung.get(c.artId) ?? {};
    je[c.cycleKey] = (je[c.cycleKey] ?? 0) + c.finalAmount;
    zuteilung.set(c.artId, je);
  }

  const rows = await Promise.all(
    arts.map(async (a) => ({
      artId: a.id,
      name: a.name,
      coverage: await loadArtCoverage(db, tenantId, a.id, cycleKey, zuteilung.get(a.id) ?? {}),
    })),
  );

  return { cycleKey, stream: buildStreamKpi(rows), arts: rows };
}
