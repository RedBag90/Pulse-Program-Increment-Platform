/**
 * Read-Model der Solutions-Liste: je Solution Name, Wertstrom, ART, Horizont
 * und Investitionsmodus — der **Strukturknoten**.
 *
 * **Grow und Run stehen hier bewusst nicht drin.** Run sind
 * Run-the-Business-Positionen (Budgeting), Grow ist die Σ Umsetzungskosten der
 * aktiven Primär-Epics (Work). Core darf nach ADR-0013 in keines von beiden
 * importieren. Die Route komponiert, was der Mandant gebucht hat — dieselbe
 * Regel, nach der Run schon immer aussen vor blieb.
 */

import type { PrismaClient } from "@/generated/prisma";
import { notDeleted } from "@/server/db/soft-delete";
import { isHorizon, type Horizon } from "@/modules/core/org/domain/horizon";

export interface SolutionListRow {
  id: string;
  name: string;
  valueStreamName: string | null;
  artName: string | null;
  horizon: Horizon;
  /** Nur H1: investing/extracting — für den Status-Badge. */
  investmentMode: string | null;
}

/** Einschränkung auf einen Knoten der Struktur-Fläche; leer = der ganze Mandant. */
export interface SolutionListFilter {
  valueStreamId?: string | undefined;
  artId?: string | undefined;
}

export async function loadSolutionsList(
  db: PrismaClient,
  tenantId: string,
  filter: SolutionListFilter = {},
): Promise<SolutionListRow[]> {
  const solutions = await db.solution.findMany({
    where: {
      tenantId,
      ...notDeleted,
      ...(filter.valueStreamId ? { valueStreamId: filter.valueStreamId } : {}),
      ...(filter.artId ? { artId: filter.artId } : {}),
    },
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

  const rows = solutions.map((s) => ({
    id: s.id,
    name: s.name,
    valueStreamName: s.valueStream?.name ?? null,
    artName: s.art?.name ?? null,
    horizon: (isHorizon(s.horizon) ? s.horizon : "h1") as Horizon,
    investmentMode: s.investmentMode,
  }));

  // Anzeige-Reihenfolge nach Horizont (h3 → h2 → h1 → h0), dann Name.
  const rank: Record<Horizon, number> = { h3: 0, h2: 1, h1: 2, h0: 3 };
  return rows.sort((a, b) => rank[a.horizon] - rank[b.horizon] || a.name.localeCompare(b.name));
}
