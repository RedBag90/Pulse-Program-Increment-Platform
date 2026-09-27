import type { createPrismaClient } from "@/server/db/prisma";
import type { requirePrincipal } from "@/server/auth/principal";
import { loadBudgetKpis } from "@/modules/budgeting/server/views/budget-kpis";
import { loadBudgetStichtag } from "@/modules/budgeting/server/services/budget-stichtag";
import { JobSizeBurnChart } from "@/modules/budgeting/features/components/art-budget/job-size-burn-chart";

/**
 * **Nur der Job-Size-Verlauf** — für den Portfolio Sync, neben dem
 * Funding-Snapshot.
 *
 * Dieselbe Rechnung wie die Budget-KPIs (`loadBudgetKpis` über der geltenden
 * Kachel des Budget-Stichtags), aber ohne Deckungskarte und ohne PI-Velocity: im Termin reicht die
 * eine Frage „liefern wir, was das Geld kaufen sollte". Geladen werden alle
 * sichtbaren ARTs des Wertstroms — der Wertstrom-Verlauf ist ihre Summe.
 */
export async function BudgetBurnPanel({
  db,
  principal,
  arts,
  artId,
}: {
  db: ReturnType<typeof createPrismaClient>;
  principal: Awaited<ReturnType<typeof requirePrincipal>>;
  /** Nur die ARTs, die der Betrachter sehen darf. */
  arts: readonly { id: string; name: string }[];
  /** `null` = der Verlauf des ganzen Wertstroms. */
  artId: string | null;
}) {
  // Verlauf, Satz und Budget stehen auf derselben Kachel: der geltenden. Ohne
  // sie gibt es keinen Verlauf (der Chart sagt es).
  const stichtag = await loadBudgetStichtag(db, principal.tenantId as never);
  const kpis = await loadBudgetKpis(db, principal.tenantId as never, arts, {
    cycleKey: stichtag.focusKey,
    stichtag,
  });
  const burn =
    artId == null
      ? kpis.stream.burn
      : (kpis.arts.find((a) => a.artId === artId)?.coverage.burn ?? null);
  return <JobSizeBurnChart burn={burn} />;
}
