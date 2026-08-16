"use server";

import { z } from "zod";
import { createServerAction } from "@/server/http/server-action";
import { captureBudgetPlanRevision } from "@/modules/budgeting/server/services/budget-plan-revision";
import { formatDomainError } from "@/server/http/domain-error-display";

/**
 * Freezes the live participatory-budgeting plan into a Budget-Plan-Revision
 * for the current half-year. Idempotent per `(tenant, cycleKey)` — a second
 * click in the same cycle overwrites the prior snapshot.
 */
export const captureBudgetPlanRevisionAction = createServerAction({
  schema: z.object({}),
  action: "budget_plan.revision.capture",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  parseFormData: () => ({}),
  service: (ctx) => captureBudgetPlanRevision(ctx),
  revalidate: "budgetPlanRevision",
  describeCreated: (v: { id: string; cycleKey: string }) => ({
    id: v.id,
    label: "Budget-Plan-Revision",
    href: `/budgeting/budget-plan/${v.id}`,
  }),
  mapError: (e) => formatDomainError(e, { fallback: "Snapshot konnte nicht erstellt werden" }),
});
