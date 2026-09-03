/**
 * Die Einordnung mehrerer Epics in einem Rutsch — Portfolio-Epic oder ART-Epic.
 *
 * Die Klasse ist kein Feld: sie entsteht aus den Kosten des freigegebenen
 * Business Case gegen ein **wertstromabhängiges** Limit. Wer sie für eine Menge
 * von Epics braucht, muss deshalb die Guardrail-Ziele einmal auflösen und je
 * Zeile den passenden Schwellwert einsetzen — genau das tut dieser Dienst.
 *
 * Die Primär-Solution kommt gleich mit: sie ist der Sammelpunkt, unter dem die
 * Portfolio-Übersicht ART-Epics zusammenfasst, und wäre sonst eine zweite
 * Abfrage über dieselben Zeilen.
 */

import type { PrismaClient } from "@/generated/prisma";
import { InitiativeLevel, type TenantId } from "@/modules/core/kernel/domain/types";
import { classifyEpic, type EpicClass } from "@/modules/work/domain/pb-submission";
import { resolveGuardrailTargets } from "@/modules/work/domain/portfolio-guardrails";
import type { SolutionRef } from "@/modules/work/domain/epic-class-filter";
import { listValueStreamGuardrailTargets } from "@/modules/work/server/services/guardrail-targets";

export interface EpicClassInfo {
  /** `null` = ohne freigegebenen Business Case, also noch nicht entschieden. */
  epicClass: EpicClass | null;
  solution: SolutionRef | null;
}

/**
 * Klassifiziert die genannten Epics; ohne `epicIds` alle des Mandanten.
 *
 * Der Business-Case-JSON ist eine große Spalte — die Aufrufer holen ihn
 * bewusst nur, wenn sie die Klasse wirklich brauchen.
 */
export async function classifyEpics(
  db: PrismaClient,
  tenantId: TenantId,
  epicIds?: readonly string[],
): Promise<Map<string, EpicClassInfo>> {
  if (epicIds != null && epicIds.length === 0) return new Map();

  const [rows, guardrailRows, tenant] = await Promise.all([
    db.initiative.findMany({
      where: {
        tenantId,
        level: InitiativeLevel.EPIC,
        deletedAt: null,
        ...(epicIds ? { id: { in: [...new Set(epicIds)] } } : {}),
      },
      select: {
        id: true,
        valueStreamId: true,
        businessCase: true,
        businessCaseApprovedAt: true,
        hypothesisApprovedAt: true,
        portfolioOverrideAt: true,
        primarySolution: { select: { id: true, name: true } },
      },
    }),
    listValueStreamGuardrailTargets(db, tenantId),
    db.tenant.findUnique({ where: { id: tenantId }, select: { guardrailTargets: true } }),
  ]);

  // Das Limit hängt am Wertstrom, nicht am Epic — je Wertstrom einmal auflösen
  // statt je Zeile.
  const limitByValueStream = new Map<string, number>();
  const limitFor = (valueStreamId: string | null): number => {
    const key = valueStreamId ?? "";
    const cached = limitByValueStream.get(key);
    if (cached != null) return cached;
    const limit = resolveGuardrailTargets(guardrailRows, tenant?.guardrailTargets ?? null, key)
      .targets.approval.portfolioThreshold;
    limitByValueStream.set(key, limit);
    return limit;
  };

  return new Map(
    rows.map((r) => [
      r.id,
      {
        epicClass: classifyEpic(r, limitFor(r.valueStreamId)).epicClass,
        solution: r.primarySolution ?? null,
      },
    ]),
  );
}
