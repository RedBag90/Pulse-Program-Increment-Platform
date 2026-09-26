import type { PrismaClient } from "@/generated/prisma";
import type { TenantId } from "@/modules/core/kernel/domain/types";
import { currentRunningPeriod } from "@/modules/budgeting/domain/period-validity";
import type { BurnWindow } from "@/modules/budgeting/domain/job-size-burn";

const DAY = 86_400_000;

/**
 * **Die laufende Budget-Kachel als Fenster** — für den Job-Size-Verlauf der
 * Budget-KPIs.
 *
 * Welche Kachel läuft, entscheidet `currentRunningPeriod` (zeitlich, nicht
 * nach Status). Das Fenster reicht vom Starttag bis **einschliesslich** zum
 * Endtag; `end` ist deshalb der Tag danach. Das Geld der Kachel liegt unter
 * ihrem `cycleKey`, wie in allen Geldtabellen.
 */
export async function loadRunningPeriod(
  db: PrismaClient,
  tenantId: TenantId,
  now: Date,
): Promise<BurnWindow | null> {
  const rounds = await db.budgetRound.findMany({
    where: { tenantId },
    select: { id: true, cycleKey: true, status: true, startDate: true, endDate: true },
  });
  const laufend = currentRunningPeriod(rounds, now);
  if (!laufend) return null;
  const round = rounds.find((r) => r.id === laufend.period.id)!;
  return {
    cycleKey: round.cycleKey,
    start: round.startDate!,
    end: new Date(round.endDate!.getTime() + DAY),
    extended: laufend.extended,
  };
}
