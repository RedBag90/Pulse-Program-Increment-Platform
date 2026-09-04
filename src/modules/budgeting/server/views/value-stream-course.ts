/**
 * Der Zuteilungs-Verlauf eines **ganzen Wertstroms** — alle Epics, die eine
 * Kachel ihm zugeteilt hat, unabhängig vom ART.
 *
 * Lag bis zum Zerlegen von `art-budget-detail.ts` in dieser Datei: das
 * Seitenmodell einer fremden Seite, mitten in der ART-Sicht. Es teilt sich mit
 * ihr den Falter und die Epic-Ladefunktion, beantwortet aber eine andere Frage.
 */

import type { PrismaClient } from "@/generated/prisma";
import type { TenantId } from "@/modules/core/kernel/domain/types";
import type { AllocationCourse } from "@/modules/budgeting/domain/allocation-course";
import {
  buildArtBudgetDetail,
  type CandidateRow,
} from "@/modules/budgeting/server/views/art-budget-detail";
import { loadEpicRows } from "@/modules/budgeting/server/views/epic-rows";

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
  // interessiert nur der Kurs. `artId: null` sagt ihm das — vorher stand hier
  // ein Sentinel-Wert, gegen den jedes Epic „abwich".
  const detail = buildArtBudgetDetail({
    artId: null,
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
