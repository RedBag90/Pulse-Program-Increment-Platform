/**
 * Der **Faktensammler** für „darf dieser Betrachter das Budget dieses
 * Wertstroms sehen — und wovon".
 *
 * Die Entscheidungen stehen rein in `domain/budget-access.ts`
 * (`valueStreamBudgetReadDeniedReason`, `maySeeValueStreamTotals`). Hier wird
 * beschafft.
 *
 * Gegenstück zu `art-budget-access.ts`, mit einem Zusatz: die Fläche braucht
 * nicht nur ein Ja/Nein, sondern **welche ARTs** Zahlen tragen dürfen. Ein
 * Wertstrom-Verantwortlicher sieht alle; ein RTE sieht seines mit Beträgen und
 * die übrigen nur als Namen.
 *
 * **Die teure Prüfung wird übersprungen, wo sie nichts ändert:** wer das Recht
 * am Wertstrom trägt, sieht ohnehin alle ARTs — dann fällt die Schleife über
 * `mayReadArtBudget` weg, und mit ihr bis zu einer Abfrage je ART.
 */

import type { PrismaClient } from "@/generated/prisma";
import { hasCapability } from "@/server/auth/authorize";
import type { Principal } from "@/server/auth/principal";
import {
  valueStreamBudgetReadDeniedReason,
  maySeeValueStreamTotals,
  type ValueStreamBudgetReadFacts,
} from "@/modules/budgeting/domain/budget-access";
import { mayReadArtBudget } from "@/modules/budgeting/server/services/art-budget-access";

export interface ValueStreamBudgetAccess {
  /** `null` = erlaubt; sonst der Grund im Klartext. */
  deniedReason: string | null;
  /** Budgetplan, Verlauf, Auslastung — die Zahlen über alle ARTs. */
  showTotals: boolean;
  /** Die ARTs, deren Beträge gezeigt werden dürfen. */
  visibleArtIds: ReadonlySet<string>;
}

export async function loadValueStreamBudgetAccess(
  db: PrismaClient,
  principal: Principal,
  vs: { id: string; financeApproverId: string | null },
  arts: ReadonlyArray<{ id: string }>,
): Promise<ValueStreamBudgetAccess> {
  const resource = { tenantId: principal.tenantId, valueStreamId: vs.id };
  const streamLevel = {
    budgetingEnabled: principal.enabledModules.includes("budgeting"),
    isValueStreamFinance: vs.financeApproverId === principal.id,
    hasValueStreamBudgetRead: hasCapability(principal, "budget.read", resource),
    hasRtbCapability: hasCapability(principal, "rtb_item.manage", resource),
  };

  // Der billige Weg zuerst: mit dem Wertstrom-Recht sind alle ARTs sichtbar.
  if (maySeeValueStreamTotals({ ...streamLevel, visibleArtCount: arts.length })) {
    return {
      deniedReason: null,
      showTotals: true,
      visibleArtIds: new Set(arts.map((a) => a.id)),
    };
  }

  const visible = new Set<string>();
  for (const art of arts) {
    const may = await mayReadArtBudget(db, principal, {
      id: art.id,
      valueStreamId: vs.id,
      financeApproverId: vs.financeApproverId,
    });
    if (may) visible.add(art.id);
  }

  const facts: ValueStreamBudgetReadFacts = { ...streamLevel, visibleArtCount: visible.size };
  return {
    deniedReason: valueStreamBudgetReadDeniedReason(facts),
    showTotals: maySeeValueStreamTotals(facts),
    visibleArtIds: visible,
  };
}
