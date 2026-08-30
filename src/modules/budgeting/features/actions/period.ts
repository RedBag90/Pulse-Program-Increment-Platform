"use server";

import { z } from "zod";
import { createServerAction } from "@/server/http/server-action";
import { fields } from "@/server/http/form-data";
import { formatDomainError } from "@/server/http/domain-error-display";
import { createPeriod, deletePeriod } from "@/modules/budgeting/server/services/round-service";
import { goalTimeframe } from "@/modules/core/goals/domain/goal-period";

const MANAGE = "budget.round.manage" as const;
const tenantResource = (_i: unknown, p: { tenantId: string }) => ({ tenantId: p.tenantId });
const err = (e: Parameters<typeof formatDomainError>[0]) =>
  formatDomainError(e, {
    notFound: "Nicht gefunden",
    fallback: "Kachel konnte nicht angelegt werden",
  });

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const toDay = (d: Date): string => d.toISOString().slice(0, 10);
/** Exakt +6 Kalendermonate (UTC), Standard-Ende einer Kachel. */
function plusSixMonths(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 6, d.getUTCDate()));
}

/**
 * Legt eine Budgeting-Kachel an. Der Zeitraum kommt aus dem Ziele-Picker:
 * **Raster** (`period` = H1/H2/Q/FY) ODER **Individuell** (`periodStart`/
 * `periodEnd`). Fehlt das Ende, wird Start + 6 Monate genommen.
 */
export const createPeriodAction = createServerAction({
  schema: z.object({
    startDate: isoDate,
    endDate: isoDate,
    poolTotal: z.number().nonnegative(),
    submissionDeadline: isoDate.nullable(),
    carryOver: z.boolean(),
    carryReserve: z.boolean(),
  }),
  action: MANAGE,
  resource: tenantResource,
  parseFormData: (fd) => {
    const f = fields(fd);
    const period = f.nonEmptyString("period");
    const startStr = f.nonEmptyString("periodStart");
    const endStr = f.nonEmptyString("periodEnd");

    // Bucket ODER Range über den geteilten Ziele-Helfer auflösen; sonst Start
    // + 6 Monate. Fällt alles aus, greift die zod-Validierung (leere Strings).
    const tf = goalTimeframe(period ?? null, startStr ?? null, endStr ?? null);
    let startDate = "";
    let endDate = "";
    if (tf) {
      startDate = toDay(tf.start);
      endDate = toDay(tf.end);
    } else if (startStr) {
      const s = new Date(`${startStr}T00:00:00.000Z`);
      startDate = toDay(s);
      endDate = toDay(plusSixMonths(s));
    }

    const deadline = f.nonEmptyString("submissionDeadline");
    return {
      startDate,
      endDate,
      poolTotal: Number(f.string("poolTotal")),
      submissionDeadline: deadline ?? null,
      carryOver: fd.get("carryOver") != null,
      carryReserve: fd.get("carryReserve") != null,
    };
  },
  service: (ctx, input) =>
    createPeriod(ctx, {
      poolTotal: input.poolTotal,
      startDate: new Date(`${input.startDate}T00:00:00.000Z`),
      endDate: new Date(`${input.endDate}T00:00:00.000Z`),
      submissionDeadline: input.submissionDeadline
        ? new Date(`${input.submissionDeadline}T00:00:00.000Z`)
        : null,
      carryOver: input.carryOver,
      carryReserve: input.carryReserve,
    }),
  revalidate: "budgetPeriod",
  mapError: err,
});

export const deletePeriodAction = createServerAction({
  schema: z.object({ id: z.string().uuid() }),
  action: MANAGE,
  resource: tenantResource,
  parseFormData: (fd) => ({ id: fields(fd).string("id") }),
  service: (ctx, i) => deletePeriod(ctx, { id: i.id }),
  // Listen-Revalidation ohne die [id]-Detailseite (die es gleich nicht mehr gibt).
  revalidate: "budgetPeriodList",
  mapError: (e) =>
    formatDomainError(e, {
      notFound: "Nicht gefunden",
      fallback: "Kachel konnte nicht gelöscht werden",
    }),
});
