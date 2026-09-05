/**
 * Der **Faktensammler** für „darf dieser Betrachter das Budget dieses ARTs
 * sehen".
 *
 * Die Entscheidung steht rein in `domain/budget-access.ts`
 * (`artBudgetReadDeniedReason`). Hier wird beschafft — und zwar **in der
 * richtigen Reihenfolge**: der Produkt-Manager-Weg kostet eine Abfrage und wird
 * erst geprüft, wenn keiner der billigen Wege greift.
 *
 * Zwei Stellen brauchen die Antwort: die Budgetfläche des ARTs und der Verweis
 * darauf in der Struktur. Als Kopie wären sie auseinandergelaufen.
 */

import type { PrismaClient } from "@/generated/prisma";
import { InitiativeLevel } from "@/modules/core/kernel/domain/types";
import { hasCapability } from "@/server/auth/authorize";
import type { Principal } from "@/server/auth/principal";
import {
  artBudgetReadDeniedReason,
  readAllowedWithoutProductManagerCheck,
} from "@/modules/budgeting/domain/budget-access";

export async function mayReadArtBudget(
  db: PrismaClient,
  principal: Principal,
  art: { id: string; valueStreamId: string; financeApproverId: string | null },
): Promise<boolean> {
  const cheap = {
    budgetingEnabled: principal.enabledModules.includes("budgeting"),
    isValueStreamFinance: art.financeApproverId === principal.id,
    hasBudgetRead:
      hasCapability(principal, "budget.read", { tenantId: principal.tenantId, artId: art.id }) ||
      hasCapability(principal, "budget.read", {
        tenantId: principal.tenantId,
        valueStreamId: art.valueStreamId,
      }),
    hasArtDistributeCapability: hasCapability(principal, "art_budget.distribute", {
      tenantId: principal.tenantId,
      artId: art.id,
    }),
  };

  if (!cheap.budgetingEnabled) return false;
  if (readAllowedWithoutProductManagerCheck(cheap)) return true;

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

  return artBudgetReadDeniedReason({ ...cheap, isEpicSolutionProductManager: owned > 0 }) == null;
}
