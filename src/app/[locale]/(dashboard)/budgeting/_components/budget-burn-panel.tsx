import type { createPrismaClient } from "@/server/db/prisma";
import type { requirePrincipal } from "@/server/auth/principal";
import { loadBudgetKpis } from "@/modules/budgeting/server/views/budget-kpis";
import { loadRunningPeriod } from "@/modules/budgeting/server/services/running-period";
import { JobSizeBurnChart } from "@/modules/budgeting/features/components/art-budget/job-size-burn-chart";

/**
 * **Nur der Job-Size-Verlauf** — für den Portfolio Sync, neben dem
 * Funding-Snapshot.
 *
 * Dieselbe Rechnung wie die Budget-KPIs (`loadBudgetKpis` über der laufenden
 * Kachel), aber ohne Deckungskarte und ohne PI-Velocity: im Termin reicht die
 * eine Frage „liefern wir, was das Geld kaufen sollte". Geladen werden alle
 * sichtbaren ARTs des Wertstroms — der Wertstrom-Verlauf ist ihre Summe.
 */
export async function BudgetBurnPanel({
  db,
  principal,
  arts,
  cycleKey,
  artId,
}: {
  db: ReturnType<typeof createPrismaClient>;
  principal: Awaited<ReturnType<typeof requirePrincipal>>;
  /** Nur die ARTs, die der Betrachter sehen darf. */
  arts: readonly { id: string; name: string }[];
  cycleKey: string;
  /** `null` = der Verlauf des ganzen Wertstroms. */
  artId: string | null;
}) {
  const heute = new Date();
  const burnWindow = await loadRunningPeriod(db, principal.tenantId as never, heute);
  const kpis = await loadBudgetKpis(
    db,
    principal.tenantId as never,
    arts,
    cycleKey,
    heute,
    burnWindow,
  );
  const burn =
    artId == null
      ? kpis.stream.burn
      : (kpis.arts.find((a) => a.artId === artId)?.coverage.burn ?? null);
  return <JobSizeBurnChart burn={burn} />;
}
