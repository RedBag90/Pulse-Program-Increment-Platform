"use server";

import { z } from "zod";
import { createServerAction } from "@/server/http/server-action";
import { fields } from "@/server/http/form-data";
import { formatDomainError } from "@/server/http/domain-error-display";
import {
  createRtbItem,
  updateRtbItem,
  deleteRtbItem,
} from "@/modules/budgeting/server/services/rtb-item-service";
import { RTB_INTERVALS } from "@/modules/budgeting/domain/rtb-interval";

const MANAGE = "rtb_item.manage" as const;
const interval = z.enum(RTB_INTERVALS);
/** Leerer Select-Wert = wertstrom-übergreifend, also ausdrücklich `null`. */
const solutionField = (f: ReturnType<typeof fields>) => f.nonEmptyString("solutionId") ?? null;
// Grober Gate auf Tenant-Ebene; die VS-scoped Prüfung + Finance-Bypass macht der
// Service (Muster `saveArtBudget`).
const tenantResource = (_i: unknown, p: { tenantId: string }) => ({ tenantId: p.tenantId });
const err = (e: Parameters<typeof formatDomainError>[0]) =>
  e.kind === "forbidden" ? e.reason : formatDomainError(e, { fallback: "Aktion fehlgeschlagen" });

export const createRtbItemAction = createServerAction({
  schema: z.object({
    valueStreamId: z.string().uuid(),
    name: z.string().min(1).max(120),
    plannedAmount: z.number().nonnegative(),
    interval,
    solutionId: z.string().uuid().nullable(),
  }),
  action: MANAGE,
  resource: tenantResource,
  parseFormData: (fd) => {
    const f = fields(fd);
    return {
      valueStreamId: f.string("valueStreamId"),
      name: f.string("name"),
      plannedAmount: Number(f.string("plannedAmount")),
      interval: (f.nonEmptyString("interval") ?? "yearly") as z.infer<typeof interval>,
      solutionId: solutionField(f),
    };
  },
  service: (ctx, i) =>
    createRtbItem(ctx, {
      valueStreamId: i.valueStreamId,
      name: i.name,
      plannedAmount: i.plannedAmount,
      interval: i.interval,
      solutionId: i.solutionId,
    }),
  revalidate: "rtbItem",
  mapError: err,
});

export const updateRtbItemAction = createServerAction({
  schema: z.object({
    id: z.string().uuid(),
    name: z.string().min(1).max(120).optional(),
    plannedAmount: z.number().nonnegative().optional(),
    active: z.boolean().optional(),
    interval: interval.optional(),
    solutionId: z.string().uuid().nullable().optional(),
  }),
  action: MANAGE,
  resource: tenantResource,
  parseFormData: (fd) => {
    const f = fields(fd);
    const name = f.nonEmptyString("name");
    const amount = f.nonEmptyString("plannedAmount");
    const active = fd.get("active");
    const iv = f.nonEmptyString("interval");
    return {
      id: f.string("id"),
      ...(name !== undefined ? { name } : {}),
      ...(amount !== undefined ? { plannedAmount: Number(amount) } : {}),
      ...(active !== null ? { active: active === "true" || active === "1" } : {}),
      ...(iv !== undefined ? { interval: iv as z.infer<typeof interval> } : {}),
      // Nur mitschicken, wenn das Formular das Feld überhaupt trägt: die
      // Solution-eigene Fläche hat keinen Solution-Select und darf die
      // Zurechnung nicht versehentlich auf null setzen.
      ...(fd.has("solutionId") ? { solutionId: solutionField(f) } : {}),
    };
  },
  service: (ctx, i) =>
    updateRtbItem(ctx, {
      id: i.id,
      ...(i.name !== undefined ? { name: i.name } : {}),
      ...(i.plannedAmount !== undefined ? { plannedAmount: i.plannedAmount } : {}),
      ...(i.active !== undefined ? { active: i.active } : {}),
      ...(i.interval !== undefined ? { interval: i.interval } : {}),
      ...(i.solutionId !== undefined ? { solutionId: i.solutionId } : {}),
    }),
  revalidate: "rtbItem",
  mapError: err,
});

export const deleteRtbItemAction = createServerAction({
  schema: z.object({ id: z.string().uuid() }),
  action: MANAGE,
  resource: tenantResource,
  parseFormData: (fd) => ({ id: fields(fd).string("id") }),
  service: (ctx, i) => deleteRtbItem(ctx, { id: i.id }),
  revalidate: "rtbItem",
  mapError: err,
});
