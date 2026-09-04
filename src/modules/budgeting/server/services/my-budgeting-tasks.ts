/**
 * Abgeleiteter My-Tasks-Hinweis für Gruppenmitglieder (Kachel-Modell). Kein Store:
 * das Prädikat ist *Principal ist `BudgetGroupMember` einer Gruppe, deren Runde
 * `running` ist und die noch NICHT eingereicht hat*. Nach der Abgabe (bzw. wenn
 * die Runde weiterschaltet) verschwindet der Hinweis automatisch — reine Query.
 *
 * Muster: `listMyApprovals` (Work). Wird am Kompositionsroot `my-tasks/page.tsx`
 * importiert (ADR-0013: Work importiert nicht Budgeting).
 *
 * Zweite Quelle: **ein ART, dessen Budget steht und noch nicht verteilt ist.**
 * Ohne sie müsste ein RTE regelmäßig nachsehen, ob der Wertstrom inzwischen
 * aufgeteilt hat — und ungenutztes Budget fiele erst auf, wenn jemand hinsieht.
 * Bewusst **ohne Eskalation zum Fensterende**: eine Erinnerungsregel ohne
 * Schwelle wird Lärm.
 */

import type { PrismaClient } from "@/generated/prisma";
import { halfYearKey, halfYearLabel } from "@/modules/core/kernel/domain/calendar";

export interface MyArtFundingTask {
  artId: string;
  artName: string;
  cycleKey: string;
  cycleLabel: string;
  /** Zugesprochen minus verteilt — der Betrag, um den es geht. */
  remaining: number;
  href: string;
}

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

/**
 * ARTs, für die der Betrachter verteilen darf und deren ART-Epic-Budget im
 * offenen Fenster noch Rest trägt.
 *
 * Das Recht wird hier **nicht** neu erfunden: `art_budget.distribute` ist
 * `art`-scoped, also steht in `principal.scopes.artIds`, welche ARTs gemeint
 * sind; die tenant-weiten Träger bekommen alle.
 */
export async function listMyArtFundingTasks(
  db: PrismaClient,
  principal: { id: string; tenantId: string },
  artIds: readonly string[],
  now: Date = new Date(),
): Promise<MyArtFundingTask[]> {
  if (artIds.length === 0) return [];
  const cycleKey = halfYearKey(now);

  const items = await db.runTheBusinessItem.findMany({
    where: {
      tenantId: principal.tenantId,
      kind: "art_change",
      active: true,
      artId: { in: [...artIds] },
    },
    select: { id: true, artId: true, art: { select: { name: true } } },
  });
  if (items.length === 0) return [];

  const [awards, allocations] = await Promise.all([
    db.rtbItemAward.findMany({
      where: { tenantId: principal.tenantId, cycleKey, rtbItemId: { in: items.map((i) => i.id) } },
      select: { rtbItemId: true, amount: true },
    }),
    db.artEpicAllocation.findMany({
      where: { tenantId: principal.tenantId, cycleKey, artId: { in: [...artIds] } },
      select: { artId: true, amount: true },
    }),
  ]);

  const awardByItem = new Map(awards.map((a) => [a.rtbItemId, Number(a.amount)]));
  const totalByArt = new Map<string, { name: string; total: number }>();
  for (const i of items) {
    if (i.artId == null) continue;
    const cur = totalByArt.get(i.artId) ?? { name: i.art?.name ?? "ART", total: 0 };
    cur.total += awardByItem.get(i.id) ?? 0;
    totalByArt.set(i.artId, cur);
  }
  const distributedByArt = new Map<string, number>();
  for (const a of allocations) {
    distributedByArt.set(a.artId, (distributedByArt.get(a.artId) ?? 0) + Number(a.amount));
  }

  return [...totalByArt.entries()]
    .map(([artId, v]) => ({
      artId,
      artName: v.name,
      cycleKey,
      cycleLabel: halfYearLabel(cycleKey),
      remaining: v.total - (distributedByArt.get(artId) ?? 0),
      href: `/budgeting/arts/${artId}?tab=verteilen`,
    }))
    .filter((t) => t.remaining > 0);
}
