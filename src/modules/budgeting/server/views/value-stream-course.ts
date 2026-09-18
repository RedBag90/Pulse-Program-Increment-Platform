/**
 * Der Zuteilungs-Verlauf eines **ganzen Wertstroms** — alle Epics, die eine
 * Kachel ihm zugeteilt hat, unabhängig vom ART.
 *
 * Lag bis zum Zerlegen von `art-budget-detail.ts` in dieser Datei: das
 * Seitenmodell einer fremden Seite, mitten in der ART-Sicht. Es teilt sich mit
 * ihr den Falter und die Epic-Ladefunktion, beantwortet aber eine andere Frage.
 *
 * Der Verlauf eines Wertstroms — die Wertstrom-Fläche rendert daraus; den Falter teilt sie sich mit der ART-Fläche (`buildArtBudgetDetail`). Der Ordner `views/` trägt, woraus eine Seite
 * rendert — nicht nur Dateien, die Lader **und** Falter selbst enthalten.
 */

import type { PrismaClient } from "@/generated/prisma";
import type { TenantId } from "@/modules/core/kernel/domain/types";
import type { AllocationCourse } from "@/modules/budgeting/domain/allocation-course";
import { buildArtBudgetDetail } from "@/modules/budgeting/server/views/art-budget-detail";
import { readBudgetCandidates } from "@/modules/budgeting/server/services/budget-reads";
import { loadEpicRows, type CandidateRow } from "@/modules/budgeting/server/services/epic-rows";

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

  // Über den geteilten Lader (REQ-5). Diese Stelle stand nicht in der Liste der
  // Spec und fiel erst am laufenden Server auf: auf der Wertstromseite blieben
  // drei Kandidaten-Abfragen stehen statt einer, weil hier eine vierte Form
  // gelesen wurde.
  const finals = (await readBudgetCandidates(db, tenantId)).filter(
    (c) => c.kind === "epic" && c.valueStreamId === valueStreamId && c.finalAmount != null,
  );

  const candidates: CandidateRow[] = finals
    .filter((f): f is typeof f & { epicId: string } => f.epicId != null)
    .map((f) => ({
      epicId: f.epicId,
      title: f.title,
      ask: f.ask,
      amount: f.finalAmount,
      cycleKey: f.cycleKey,
      decided: f.roundStatus === "closed",
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
