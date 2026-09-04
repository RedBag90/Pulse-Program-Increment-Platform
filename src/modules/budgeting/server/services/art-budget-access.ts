/**
 * Wer darf das Budget eines ARTs **sehen**?
 *
 * Drei Wege, und der dritte ist der Grund, warum diese Regel eine eigene
 * Funktion ist: der **Produkt-Manager** einer Solution darf für die Epics
 * seines Produkts aus dem ART-Epic-Budget zuteilen — dann muss er es auch
 * sehen, sonst ließe sich nicht verteilen. Geprüft wird an der Sache, nicht an
 * einer Rolle.
 *
 * Zwei Stellen brauchen die Antwort: die Budgetfläche des ARTs selbst und der
 * Verweis darauf in der Struktur. Als Kopie wären sie auseinandergelaufen.
 */

import type { PrismaClient } from "@/generated/prisma";
import { InitiativeLevel } from "@/modules/core/kernel/domain/types";
import { hasCapability } from "@/server/auth/authorize";
import type { Principal } from "@/server/auth/principal";

export async function mayReadArtBudget(
  db: PrismaClient,
  principal: Principal,
  art: { id: string; valueStreamId: string; financeApproverId: string | null },
): Promise<boolean> {
  if (!principal.enabledModules.includes("budgeting")) return false;

  if (
    art.financeApproverId === principal.id ||
    hasCapability(principal, "budget.read", { tenantId: principal.tenantId, artId: art.id }) ||
    hasCapability(principal, "budget.read", {
      tenantId: principal.tenantId,
      valueStreamId: art.valueStreamId,
    }) ||
    hasCapability(principal, "art_budget.distribute", {
      tenantId: principal.tenantId,
      artId: art.id,
    })
  ) {
    return true;
  }

  // Dieselben Bedingungen wie die Verteilliste selbst: vorgemerkt und mit
  // freigegebenem Business Case. Sonst öffnete sich die Fläche auch dort, wo
  // sie nichts zu zeigen hat.
  const owned = await db.initiative.count({
    where: {
      tenantId: principal.tenantId,
      level: InitiativeLevel.EPIC,
      deletedAt: null,
      artId: art.id,
      primarySolution: { productManagerId: principal.id },
      stagedForBudgeting: true,
      businessCaseApprovedAt: { not: null },
    },
  });
  return owned > 0;
}
