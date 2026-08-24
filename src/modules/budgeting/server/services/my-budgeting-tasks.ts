/**
 * Abgeleiteter My-Tasks-Hinweis für Gruppenmitglieder (Kachel-Modell). Kein Store:
 * das Prädikat ist *Principal ist `BudgetGroupMember` einer Gruppe, deren Runde
 * `running` ist und die noch NICHT eingereicht hat*. Nach der Abgabe (bzw. wenn
 * die Runde weiterschaltet) verschwindet der Hinweis automatisch — reine Query.
 *
 * Muster: `listMyApprovals` (Work). Wird am Kompositionsroot `my-tasks/page.tsx`
 * importiert (ADR-0013: Work importiert nicht Budgeting).
 */

import type { PrismaClient } from "@/generated/prisma";
import { halfYearLabel } from "@/modules/core/kernel/domain/calendar";

export interface MyBudgetingTask {
  groupId: string;
  roundId: string;
  groupName: string;
  cycleLabel: string;
  deadline: Date | null;
  href: string;
}

export async function listMyBudgetingTasks(
  db: PrismaClient,
  principal: { id: string; tenantId: string },
): Promise<MyBudgetingTask[]> {
  const memberships = await db.budgetGroupMember.findMany({
    where: {
      userId: principal.id,
      group: {
        submittedAt: null,
        round: { tenantId: principal.tenantId, status: "running" },
      },
    },
    select: {
      group: {
        select: {
          id: true,
          name: true,
          round: { select: { id: true, cycleKey: true, submissionDeadline: true } },
        },
      },
    },
  });

  return memberships.map((m) => ({
    groupId: m.group.id,
    roundId: m.group.round.id,
    groupName: m.group.name,
    cycleLabel: halfYearLabel(m.group.round.cycleKey),
    deadline: m.group.round.submissionDeadline,
    href: `/budgeting/periods/${m.group.round.id}/distribute/${m.group.id}`,
  }));
}
