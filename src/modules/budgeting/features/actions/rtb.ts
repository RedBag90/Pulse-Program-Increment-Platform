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

const MANAGE = "rtb_item.manage" as const;
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
  }),
  action: MANAGE,
  resource: tenantResource,
  parseFormData: (fd) => {
    const f = fields(fd);
    return {
      valueStreamId: f.string("valueStreamId"),
      name: f.string("name"),
      plannedAmount: Number(f.string("plannedAmount")),
    };
  },
  service: (ctx, i) =>
    createRtbItem(ctx, { valueStreamId: i.valueStreamId, name: i.name, plannedAmount: i.plannedAmount }),
  revalidate: "rtbItem",
  mapError: err,
});

export const updateRtbItemAction = createServerAction({
  schema: z.object({
    id: z.string().uuid(),
    name: z.string().min(1).max(120).optional(),
    plannedAmount: z.number().nonnegative().optional(),
    active: z.boolean().optional(),
  }),
  action: MANAGE,
  resource: tenantResource,
  parseFormData: (fd) => {
    const f = fields(fd);
    const name = f.nonEmptyString("name");
    const amount = f.nonEmptyString("plannedAmount");
    const active = fd.get("active");
    return {
      id: f.string("id"),
      ...(name !== undefined ? { name } : {}),
      ...(amount !== undefined ? { plannedAmount: Number(amount) } : {}),
      ...(active !== null ? { active: active === "true" || active === "1" } : {}),
    };
  },
  service: (ctx, i) =>
    updateRtbItem(ctx, {
      id: i.id,
      ...(i.name !== undefined ? { name: i.name } : {}),
      ...(i.plannedAmount !== undefined ? { plannedAmount: i.plannedAmount } : {}),
      ...(i.active !== undefined ? { active: i.active } : {}),
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
