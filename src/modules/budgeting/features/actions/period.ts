"use server";

import type { Translate } from "@/i18n/translate";
import { z } from "zod";
import { createServerAction } from "@/server/http/server-action";
import { fields } from "@/server/http/form-data";
import { formatDomainError } from "@/server/http/domain-error-display";
import {
  createPeriod,
  deletePeriod,
  updatePeriodTimeframe,
} from "@/modules/budgeting/server/services/round-service";

const MANAGE = "budget.round.manage" as const;
const tenantResource = (_i: unknown, p: { tenantId: string }) => ({ tenantId: p.tenantId });
const err = (e: Parameters<typeof formatDomainError>[0], t: Translate) =>
  formatDomainError(
    e,
    {
      notFoundKey: "errors.action.notFoundPlain",
      fallbackKey: "errors.action.createPeriod",
    },
    t,
  );

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const toDay = (d: Date): string => d.toISOString().slice(0, 10);
/** Exakt +6 Kalendermonate (UTC), Standard-Ende einer Kachel. */
function plusSixMonths(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 6, d.getUTCDate()));
}

/**
 * Legt eine Budgeting-Kachel an. Der Zeitraum ist der **Geltungszeitraum des
 * Budgets** — von wann bis wann der Rahmen gilt —, nicht die Dauer der
 * Vorbereitung.
 *
 * Er wird **frei** angegeben; das frühere Raster (H1/H2/Q1–Q4/FY) ist entfallen.
 * Es versprach Quartals- und Jahres-Kacheln, die der Schlüssel der Zuteilungen
 * gar nicht trägt: `cycleKey` ist das Halbjahr des Starts, und zwei Kacheln im
 * selben Halbjahr teilen sich sämtliche Budget-Zuteilungen. Der Dienst weist
 * das jetzt ab, statt still zu überschreiben.
 *
 * Fehlt das Ende, wird Start + 6 Monate genommen.
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
    const startStr = f.nonEmptyString("periodStart");
    const endStr = f.nonEmptyString("periodEnd");

    let startDate = "";
    let endDate = "";
    if (startStr) {
      const s = new Date(`${startStr}T00:00:00.000Z`);
      startDate = toDay(s);
      endDate = endStr ? toDay(new Date(`${endStr}T00:00:00.000Z`)) : toDay(plusSixMonths(s));
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
  mapError: (e, t) =>
    formatDomainError(
      e,
      {
        notFoundKey: "errors.action.notFoundPlain",
        fallbackKey: "errors.action.deletePeriod",
      },
      t,
    ),
});

/**
 * Korrigiert den **Geltungszeitraum** einer Kachel. Was erlaubt ist, entscheidet
 * der Dienst anhand der Geltung: in der Ausarbeitung alles, bei einer geltenden
 * Kachel nur das Verlängern des Endes, bei einer abgelaufenen nichts.
 */
export const updatePeriodTimeframeAction = createServerAction({
  schema: z.object({
    id: z.string().uuid(),
    startDate: isoDate,
    endDate: isoDate,
    submissionDeadline: isoDate.nullable(),
  }),
  action: MANAGE,
  resource: tenantResource,
  parseFormData: (fd) => {
    const f = fields(fd);
    return {
      id: f.string("id"),
      startDate: f.string("periodStart"),
      endDate: f.string("periodEnd"),
      submissionDeadline: f.nonEmptyString("submissionDeadline") ?? null,
    };
  },
  service: (ctx, input) =>
    updatePeriodTimeframe(ctx, {
      id: input.id,
      startDate: new Date(`${input.startDate}T00:00:00.000Z`),
      endDate: new Date(`${input.endDate}T00:00:00.000Z`),
      submissionDeadline: input.submissionDeadline
        ? new Date(`${input.submissionDeadline}T00:00:00.000Z`)
        : null,
    }),
  revalidate: "budgetPeriod",
  mapError: err,
});
