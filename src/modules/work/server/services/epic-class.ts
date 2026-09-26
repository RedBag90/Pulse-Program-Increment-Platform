/**
 * Die Einordnung mehrerer Epics in einem Rutsch — Portfolio-Epic oder ART-Epic.
 *
 * Die Klasse ist kein Feld: sie entsteht aus den Kosten des freigegebenen
 * Business Case gegen ein **wertstromabhängiges** Limit. Wer sie für eine Menge
 * von Epics braucht, muss deshalb die Guardrail-Ziele einmal auflösen und je
 * Zeile den passenden Schwellwert einsetzen — genau das tut dieser Dienst.
 *
 * Und wo noch nichts entschieden ist, springt die beim Anlegen hinterlegte
 * **Erwartung** ein (`resolveEpicClass`). Ohne sie fand die Facette
 * „Epic-Klasse" nur 103 von 226 Epics.
 *
 * Die Primär-Solution kommt gleich mit: sie ist der Sammelpunkt, unter dem die
 * Portfolio-Übersicht ART-Epics zusammenfasst, und wäre sonst eine zweite
 * Abfrage über dieselben Zeilen. Dasselbe gilt für das ART — die Übersicht
 * fasst den Epic-Beitrag wahlweise danach zusammen.
 */

import type { Prisma, PrismaClient } from "@/generated/prisma";
import { InitiativeLevel, type TenantId } from "@/modules/core/kernel/domain/types";
import {
  classifyEpic,
  isEpicClass,
  provisionalEpicClass,
  resolveEpicClass,
  type EpicClass,
  type EpicClassSource,
} from "@/modules/work/domain/pb-submission";
import { resolveGuardrailTargets } from "@/modules/work/domain/portfolio-guardrails";
import type { SolutionRef } from "@/modules/work/domain/epic-class-filter";
import { listValueStreamGuardrailTargets } from "@/modules/work/server/services/guardrail-targets";

/** Das ART eines Epics — Sammelpunkt wie die Solution, gleiche Form. */
export interface ArtRef {
  id: string;
  name: string;
}

export interface EpicClassInfo {
  /**
   * Aufgelöst: die entschiedene Klasse, sonst die beim Anlegen hinterlegte
   * Erwartung. `null` nur, wenn es weder das eine noch das andere gibt — heute
   * trifft das **kein einziges** Epic.
   */
  epicClass: EpicClass | null;
  /**
   * Woher sie stammt. Die Fläche zeigt Erwartung und Entscheidung bewusst
   * gleich; das Feld entsteht trotzdem, weil die Unterscheidung sonst im Modell
   * verschwindet und später nicht ohne erneuten Umbau zurückzuholen wäre.
   */
  classSource: EpicClassSource;
  solution: SolutionRef | null;
  art: ArtRef | null;
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
        // Die Erwartung springt ein, wo noch nichts entschieden ist.
        intendedClass: true,
        primarySolution: { select: { id: true, name: true } },
        art: { select: { id: true, name: true } },
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
        ...resolveEpicClass(
          classifyEpic(r, limitFor(r.valueStreamId)).epicClass,
          isEpicClass(r.intendedClass) ? r.intendedClass : null,
        ),
        solution: r.primarySolution ?? null,
        art: r.art ?? null,
      },
    ]),
  );
}

/**
 * Das Portfolio-Limit **eines** Wertstroms — derselbe Weg wie in
 * `classifyEpics` (Wertstrom → Tenant → Code-Default), nur für eine Zeile.
 */
export async function portfolioThresholdFor(
  db: PrismaClient | Prisma.TransactionClient,
  tenantId: TenantId,
  valueStreamId: string | null,
): Promise<number> {
  const [rows, tenant] = await Promise.all([
    listValueStreamGuardrailTargets(db, tenantId),
    db.tenant.findUnique({ where: { id: tenantId }, select: { guardrailTargets: true } }),
  ]);
  return resolveGuardrailTargets(rows, tenant?.guardrailTargets ?? null, valueStreamId ?? "")
    .targets.approval.portfolioThreshold;
}

/** Was `reclassifyAboveLimit` geändert hat — Form eines Audit-Eintrags. */
export interface IntendedClassChange {
  before: "art";
  after: "portfolio";
}

/**
 * **Über dem Limit bleibt kein Epic ART.**
 *
 * Die Erwartung (`intendedClass`) wird beim Anlegen gesetzt; der Business Case
 * kann sie widerlegen. Nach oben ist das keine Ansichtssache: was über dem
 * Portfolio-Limit liegt, braucht eine Portfolio-Entscheidung, und ein
 * ART-Rahmen könnte es nicht tragen. Bis September 2026 blieb die Erwartung
 * trotzdem auf „art" stehen — zwischen Antrag und Abnahme lief das Epic
 * überall als ART-Epic, und nach der Abnahme meldete die Karte eine
 * „Abweichung von der Erwartung", die niemand mehr auflösen konnte.
 *
 * Jetzt stellt der Gate-Dienst die Erwartung um, beim L2-Antrag **und** bei
 * der Abnahme (der Business Case kann sich dazwischen geändert haben).
 *
 * **Nur nach oben.** Ein Portfolio-Epic unter dem Limit darf Portfolio
 * bleiben — dafür gibt es die begründete Ausnahme (`portfolioOverrideAt`);
 * ohne sie wird es mit der Abnahme ohnehin ART (`classifyEpic`).
 *
 * Läuft in der Transaktion des Aufrufers; idempotent.
 */
export async function reclassifyAboveLimit(
  tx: Prisma.TransactionClient,
  tenantId: TenantId,
  epicId: string,
  actorId: string,
): Promise<IntendedClassChange | null> {
  const row = await tx.initiative.findFirst({
    where: { id: epicId, tenantId },
    select: { intendedClass: true, valueStreamId: true, businessCase: true },
  });
  if (row?.intendedClass !== "art") return null;
  const limit = await portfolioThresholdFor(tx, tenantId, row.valueStreamId);
  if (provisionalEpicClass(row, limit) !== "portfolio") return null;
  await tx.initiative.update({
    where: { id: epicId },
    data: { intendedClass: "portfolio", updatedBy: actorId },
  });
  return { before: "art", after: "portfolio" };
}
