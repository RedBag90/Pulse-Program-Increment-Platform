import type { Prisma } from "@/generated/prisma";
import { generateSprints } from "@/domain/pi-planning";

/**
 * Sprint Backfill — the one place that writes the cartesian product of
 * (PI × Team) → Sprint rows. Callers (Timeline join, PI create, Team create)
 * each compute their own `(pis, teams)` slice and hand them in; this module
 * owns the loop, the `generateSprints` rule, and the Prisma `createMany`
 * shape. Pure-write — no audit emission of its own; the caller's
 * `withAuditedTransaction` owns the event and folds `created` into its
 * changeset where it cares.
 *
 * Returns the number of Sprint rows actually written. Empty inputs short-
 * circuit to `{ created: 0 }`; the call is safe to make unconditionally.
 */

export interface BackfillPi {
  id: string;
  startDate: Date;
  endDate: Date;
}

export interface BackfillTeam {
  id: string;
}

export async function backfillSprints(
  tx: Prisma.TransactionClient,
  tenantId: string,
  pis: readonly BackfillPi[],
  teams: readonly BackfillTeam[],
): Promise<{ created: number }> {
  if (pis.length === 0 || teams.length === 0) return { created: 0 };

  let created = 0;
  for (const pi of pis) {
    const drafts = generateSprints(pi.startDate, pi.endDate, teams);
    if (drafts.length === 0) continue;
    const result = await tx.sprint.createMany({
      data: drafts.map((s) => ({ tenantId, piId: pi.id, ...s })),
    });
    created += result.count;
  }
  return { created };
}
