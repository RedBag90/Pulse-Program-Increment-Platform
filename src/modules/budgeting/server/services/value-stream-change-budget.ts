import type { PrismaClient } from "@/generated/prisma";
import type { TenantId } from "@/modules/core/kernel/domain/types";
import { loadArtEpicBudgets } from "@/modules/budgeting/server/services/art-epic-budget";

/**
 * **Das Veränderungsgeld eines Wertstroms in einer Budget-Kachel** — die
 * Gruppe „Veränderung" der ART-Budget-Übersicht (`domain/art-budget-origin.ts`),
 * summiert über die ARTs des Wertstroms, plus die Portfolio-Epics der Kachel.
 *
 *  - **portfolio** — Σ `finalAmount` der Epic-Kandidaten des Wertstroms in der
 *    Runde mit diesem `cycleKey`: das Geld von der Portfolio-Kachel.
 *  - **toEpics / toOwnWork / open** — der ART-Rahmen seiner ARTs: an ART-Epics
 *    vergeben, für ART-eigene Arbeit vergeben, noch nicht vergeben. Dieselbe
 *    Quelle wie die ART-Übersicht (`loadArtEpicBudgets`). `open` bleibt
 *    **ungekappt**: ein negativer Rest zeigt einen nachträglich gekürzten
 *    Rahmen, statt ihn zu verstecken.
 *
 * Betrieb gehört nicht hinein — Veränderung und Betrieb stehen nie in einer
 * Summe (REQ-10).
 */
export interface ValueStreamChangeBudget {
  valueStreamId: string;
  name: string;
  portfolio: number;
  toEpics: number;
  toOwnWork: number;
  open: number;
}

/** Faltet die gelesenen Zeilen je Wertstrom. Rein — der Test setzt hier an. */
export function foldValueStreamChange(input: {
  streams: readonly { id: string; name: string }[];
  arts: readonly { id: string; valueStreamId: string }[];
  portfolioFinals: readonly { valueStreamId: string; amount: number }[];
  frames: readonly {
    artId: string;
    distributedToEpics: number;
    distributedToOwnWork: number;
    remaining: number;
  }[];
}): ValueStreamChangeBudget[] {
  const vsOfArt = new Map(input.arts.map((a) => [a.id, a.valueStreamId]));
  const rows = new Map<string, ValueStreamChangeBudget>(
    input.streams.map((s) => [
      s.id,
      { valueStreamId: s.id, name: s.name, portfolio: 0, toEpics: 0, toOwnWork: 0, open: 0 },
    ]),
  );
  for (const f of input.portfolioFinals) {
    const row = rows.get(f.valueStreamId);
    if (row) row.portfolio += f.amount;
  }
  for (const f of input.frames) {
    const vs = vsOfArt.get(f.artId);
    const row = vs ? rows.get(vs) : undefined;
    if (!row) continue;
    row.toEpics += f.distributedToEpics;
    row.toOwnWork += f.distributedToOwnWork;
    row.open += f.remaining;
  }
  // Nur Wertströme mit Geld in dieser Kachel — auch solche nur mit Rahmen.
  return [...rows.values()].filter(
    (r) => r.portfolio !== 0 || r.toEpics !== 0 || r.toOwnWork !== 0 || r.open !== 0,
  );
}

export async function getValueStreamChangeBudgets(
  db: PrismaClient,
  tenantId: TenantId,
  cycleKey: string,
): Promise<ValueStreamChangeBudget[]> {
  const [streams, arts, finals] = await Promise.all([
    db.valueStream.findMany({ where: { tenantId }, select: { id: true, name: true } }),
    db.art.findMany({
      where: { tenantId, deletedAt: null },
      select: { id: true, valueStreamId: true },
    }),
    db.budgetCandidate.findMany({
      where: {
        tenantId,
        kind: "epic",
        valueStreamId: { not: null },
        finalAmount: { not: null },
        round: { cycleKey },
      },
      select: { valueStreamId: true, finalAmount: true },
    }),
  ]);
  const frames = await loadArtEpicBudgets(
    db,
    tenantId,
    arts.map((a) => a.id),
    cycleKey,
  );
  return foldValueStreamChange({
    streams,
    arts,
    portfolioFinals: finals.map((f) => ({
      valueStreamId: f.valueStreamId!,
      amount: Number(f.finalAmount),
    })),
    frames: [...frames.values()],
  });
}
