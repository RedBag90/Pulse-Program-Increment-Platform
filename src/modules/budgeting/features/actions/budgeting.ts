"use server";

import { z } from "zod";
import { createServerAction } from "@/server/http/server-action";
import { fields } from "@/server/http/form-data";
import { captureBudgetPlanRevision } from "@/modules/budgeting/server/services/budget-plan-revision";
import { formatDomainError } from "@/server/http/domain-error-display";

/**
 * Die **eine** verbliebene Schreib-Aktion der Budgetvergabe: das Einfrieren
 * eines Zeitraums.
 *
 * Topf, Epic-Zuteilung und ART-Verteilung werden nicht mehr von Hand gesetzt —
 * der Topf lebt in der Kachel, Zuteilung und ART-Budget entstehen aus ihrer
 * Finalisierung. Die Zyklus-Fortschreibung ist mit dem tenant-weiten Anker
 * entfallen: es gibt keinen einzelnen aktiven Zyklus mehr, sondern eine
 * laufende Kachel.
 */

/**
 * Friert den Stand eines Budget-Zeitraums als Budget-Plan-Revision ein.
 * Idempotent je `(tenant, cycleKey)` — ein zweiter Klick im selben Zyklus
 * überschreibt den vorherigen Snapshot. Der Zyklus kommt von der Kachel, aus
 * der heraus erfasst wird.
 */
export const captureBudgetPlanRevisionAction = createServerAction({
  schema: z.object({ cycleKey: z.string().optional() }),
  action: "budget_plan.revision.capture",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  parseFormData: (fd) => {
    const cycleKey = fields(fd).nonEmptyString("cycleKey");
    return cycleKey !== undefined ? { cycleKey } : {};
  },
  service: (ctx, input) =>
    captureBudgetPlanRevision(
      ctx,
      input.cycleKey !== undefined ? { cycleKey: input.cycleKey } : {},
    ),
  revalidate: "budgetPlanRevision",
  describeCreated: (v: { id: string; cycleKey: string }) => ({
    id: v.id,
    label: "Budget-Plan-Revision",
    href: `/budgeting/budget-plan/${v.id}`,
  }),
  mapError: (e) => formatDomainError(e, { fallback: "Snapshot konnte nicht erstellt werden" }),
});
