"use server";

import { z } from "zod";
import { createServerAction } from "@/server/http/server-action";
import { fields } from "@/server/http/form-data";
import { formatDomainError } from "@/server/http/domain-error-display";
import { saveDefaultHypothesisEffort } from "@/modules/budgeting/server/services/budgeting";

const MANAGE = "budget.round.manage" as const;
const tenantResource = (_i: unknown, p: { tenantId: string }) => ({ tenantId: p.tenantId });

/**
 * Setzt den tenant-weiten Default-Aufwand (Kosten-Richtwert) für Epics, die erst
 * eine Benefit-Hypothese haben. Leeres Feld ⇒ zurück auf den Code-Fallback.
 */
export const setBudgetingDefaultsAction = createServerAction({
  schema: z.object({ defaultHypothesisEffort: z.number().nonnegative().nullable() }),
  action: MANAGE,
  resource: tenantResource,
  parseFormData: (fd) => {
    const raw = fields(fd).nonEmptyString("defaultHypothesisEffort");
    return { defaultHypothesisEffort: raw !== undefined ? Number(raw) : null };
  },
  service: (ctx, input) => saveDefaultHypothesisEffort(ctx, input),
  revalidate: "budgetPeriod",
  mapError: (e) =>
    formatDomainError(e, {
      notFound: "Nicht gefunden",
      fallback: "Standard-Aufwand konnte nicht gespeichert werden",
    }),
});
