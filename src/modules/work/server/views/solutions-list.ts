/**
 * Read-Model der Solutions-Liste (`/portfolio/solutions`): je Solution Name,
 * Value Stream, ART, Horizont, Epic-Zähler + Grow. **Grow** = Σ Umsetzungs-
 * kosten der aktiven Primär-Epics (Stage < L5).
 *
 * **Run steht hier bewusst nicht drin.** Betriebskosten sind
 * Run-the-Business-Positionen und gehören dem Budgeting-Modul; das Work-Modul
 * darf es nicht importieren (ADR-0013). Die Route komponiert beides.
 */

import type { PrismaClient } from "@/generated/prisma";
import { InitiativeLevel } from "@/modules/core/kernel/domain/types";
import { notDeleted } from "@/server/db/soft-delete";
import { parseBusinessCase, computeBusinessCaseTotals } from "@/modules/work/domain/business-case";
import { isHorizon, type Horizon } from "@/modules/work/domain/portfolio-guardrails";

export interface SolutionListRow {
  id: string;
  name: string;
  valueStreamName: string | null;
  artName: string | null;
  horizon: Horizon;
  /** Nur H1: investing/extracting — für den Status-Badge. */
  investmentMode: string | null;
  epicCount: number;
  /** Σ Umsetzungskosten aktiver Primär-Epics (Stage < L5). */
  grow: number;
}

/** Summiert die Grow-Kosten je Solution aus den aktiven Primär-Epics. */
export function growByPrimarySolution(
  epics: { primarySolutionId: string | null; stageGate: string; businessCase: unknown }[],
): { grow: Map<string, number>; count: Map<string, number> } {
  const grow = new Map<string, number>();
  const count = new Map<string, number>();
  for (const e of epics) {
    if (e.primarySolutionId == null) continue;
    count.set(e.primarySolutionId, (count.get(e.primarySolutionId) ?? 0) + 1);
    if (e.stageGate === "L5") continue; // abgeschlossen zählt nicht ins laufende Grow
    const cost = computeBusinessCaseTotals(
      parseBusinessCase(e.businessCase).current,
    ).implementationCost;
    grow.set(e.primarySolutionId, (grow.get(e.primarySolutionId) ?? 0) + cost);
  }
  return { grow, count };
}

export async function loadSolutionsList(
  db: PrismaClient,
  tenantId: string,
): Promise<SolutionListRow[]> {
  const solutions = await db.solution.findMany({
    where: { tenantId, ...notDeleted },
    select: {
      id: true,
      name: true,
      horizon: true,
      investmentMode: true,
      valueStream: { select: { name: true } },
      art: { select: { name: true } },
    },
    orderBy: [{ name: "asc" }],
  });

  const epics = solutions.length
    ? await db.initiative.findMany({
        where: {
          tenantId,
          level: InitiativeLevel.EPIC,
          deletedAt: null,
          primarySolutionId: { in: solutions.map((s) => s.id) },
        },
        select: { primarySolutionId: true, stageGate: true, businessCase: true },
      })
    : [];

  const { grow, count } = growByPrimarySolution(epics);

  const rows = solutions.map((s) => ({
    id: s.id,
    name: s.name,
    valueStreamName: s.valueStream?.name ?? null,
    artName: s.art?.name ?? null,
    horizon: (isHorizon(s.horizon) ? s.horizon : "h1") as Horizon,
    investmentMode: s.investmentMode,
    epicCount: count.get(s.id) ?? 0,
    grow: grow.get(s.id) ?? 0,
  }));

  // Anzeige-Reihenfolge nach Horizont (h3 → h2 → h1 → h0), dann Name.
  const rank: Record<Horizon, number> = { h3: 0, h2: 1, h1: 2, h0: 3 };
  return rows.sort((a, b) => rank[a.horizon] - rank[b.horizon] || a.name.localeCompare(b.name));
}
