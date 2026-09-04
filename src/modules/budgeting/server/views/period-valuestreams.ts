/**
 * VS-/ART-/RtB-Budget-Tab einer Kachel. Eine Quelle: `BudgetCandidate.finalAmount`.
 * Dreifache Ableitung — je Value Stream, je ART (Grow-the-Business aus Epics,
 * unter dem VS geschachtelt) und Run-the-Business je VS (aus RtB-Kandidaten).
 * Reiner Builder + impurer Loader.
 */

import type { PrismaClient } from "@/generated/prisma";
import type { TenantId } from "@/modules/core/kernel/domain/types";

export interface PeriodArtBudget {
  artId: string | null;
  artName: string;
  total: number;
}

export interface VsBudgetRow {
  valueStreamId: string | null;
  valueStreamName: string;
  runTotal: number;
  changeTotal: number;
  total: number;
  arts: PeriodArtBudget[];
}

export interface PeriodValueStreamsModel {
  rows: VsBudgetRow[];
  grandTotal: number;
}

export interface CandidateFinal {
  kind: string; // epic | rtb
  finalAmount: number;
  valueStreamId: string | null;
  artId: string | null;
}

const NO_VS = "__none__";
const NO_ART = "__none__";

/** Faltet die finalisierten Kandidaten in die VS→ART/RtB-Hierarchie. Rein. */
export function buildPeriodValueStreams(
  candidates: CandidateFinal[],
  vsName: (id: string | null) => string,
  artName: (id: string | null) => string,
): PeriodValueStreamsModel {
  const vsMap = new Map<string, VsBudgetRow>();
  const artMap = new Map<string, Map<string, PeriodArtBudget>>();

  const vsKey = (id: string | null) => id ?? NO_VS;

  for (const c of candidates) {
    if (c.finalAmount === 0) continue;
    const vk = vsKey(c.valueStreamId);
    let vs = vsMap.get(vk);
    if (!vs) {
      vs = {
        valueStreamId: c.valueStreamId,
        valueStreamName: c.valueStreamId ? vsName(c.valueStreamId) : "Ohne Wertstrom",
        runTotal: 0,
        changeTotal: 0,
        total: 0,
        arts: [],
      };
      vsMap.set(vk, vs);
      artMap.set(vk, new Map());
    }
    vs.total += c.finalAmount;

    if (c.kind === "rtb") {
      vs.runTotal += c.finalAmount;
    } else {
      vs.changeTotal += c.finalAmount;
      const arts = artMap.get(vk)!;
      const ak = c.artId ?? NO_ART;
      let art = arts.get(ak);
      if (!art) {
        art = { artId: c.artId, artName: c.artId ? artName(c.artId) : "ohne ART", total: 0 };
        arts.set(ak, art);
      }
      art.total += c.finalAmount;
    }
  }

  const rows = [...vsMap.entries()].map(([vk, vs]) => ({
    ...vs,
    arts: [...(artMap.get(vk)?.values() ?? [])].sort((a, b) => b.total - a.total),
  }));
  rows.sort((a, b) => b.total - a.total);

  return { rows, grandTotal: rows.reduce((s, r) => s + r.total, 0) };
}

export async function loadPeriodValueStreams(
  db: PrismaClient,
  tenantId: TenantId,
  roundId: string,
): Promise<PeriodValueStreamsModel> {
  const [candidates, valueStreams, arts] = await Promise.all([
    db.budgetCandidate.findMany({
      where: { roundId, finalAmount: { not: null } },
      select: { kind: true, finalAmount: true, valueStreamId: true, artId: true },
    }),
    db.valueStream.findMany({ where: { tenantId }, select: { id: true, name: true } }),
    db.art.findMany({ where: { tenantId }, select: { id: true, name: true } }),
  ]);

  const vsName = new Map(valueStreams.map((v) => [v.id, v.name]));
  const artName = new Map(arts.map((a) => [a.id, a.name]));

  return buildPeriodValueStreams(
    candidates.map((c) => ({
      kind: c.kind,
      finalAmount: c.finalAmount != null ? Number(c.finalAmount) : 0,
      valueStreamId: c.valueStreamId,
      artId: c.artId,
    })),
    (id) => (id ? (vsName.get(id) ?? id) : "Ohne Wertstrom"),
    (id) => (id ? (artName.get(id) ?? id) : "ohne ART"),
  );
}
