"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createKpi, deleteKpi, recordKpiMeasurement } from "@/server/services/kpi";
import type { KpiId } from "@/server/services/kpi";
import { createServerAction } from "@/server/http/server-action";
import type { ActionState } from "@/server/http/server-action";
import type { EpicId } from "@/domain/types";

export type { ActionState as KpiActionState };

export const createKpiAction = createServerAction({
  schema: z.object({
    initiativeId: z.string().uuid(),
    name: z.string().min(1).max(200),
    unit: z.string().max(40).optional(),
    baseline: z.coerce.number().optional(),
    target: z.coerce.number().optional(),
  }),
  action: "epic.update",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  parseFormData: (fd) => ({
    initiativeId: fd.get("initiativeId"),
    name: fd.get("name"),
    unit: fd.get("unit") || undefined,
    baseline: fd.get("baseline") || undefined,
    target: fd.get("target") || undefined,
  }),
  service: (ctx, input) =>
    createKpi(ctx, {
      initiativeId: input.initiativeId as EpicId,
      name: input.name,
      unit: input.unit,
      baseline: input.baseline,
      target: input.target,
    }),
  onSuccess: (input) => revalidatePath(`/portfolio/epics/${input.initiativeId}`),
  mapError: (e) =>
    e.kind === "not_found" ? "Epic nicht gefunden" : "KPI konnte nicht erstellt werden",
});

export const deleteKpiAction = createServerAction({
  schema: z.object({ id: z.string().uuid(), initiativeId: z.string().uuid() }),
  action: "epic.update",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  parseFormData: (fd) => ({ id: fd.get("id"), initiativeId: fd.get("initiativeId") }),
  service: (ctx, input) => deleteKpi(ctx, { id: input.id as KpiId }),
  onSuccess: (input) => revalidatePath(`/portfolio/epics/${input.initiativeId}`),
  mapError: (e) =>
    e.kind === "not_found" ? "KPI nicht gefunden" : "KPI konnte nicht gelöscht werden",
});

export const recordKpiMeasurementAction = createServerAction({
  schema: z.object({
    id: z.string().uuid(),
    initiativeId: z.string().uuid(),
    date: z.string().min(1),
    value: z.coerce.number(),
  }),
  action: "epic.update",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  parseFormData: (fd) => ({
    id: fd.get("id"),
    initiativeId: fd.get("initiativeId"),
    date: fd.get("date"),
    value: fd.get("value"),
  }),
  service: (ctx, input) =>
    recordKpiMeasurement(ctx, { id: input.id as KpiId, date: input.date, value: input.value }),
  onSuccess: (input) => revalidatePath(`/portfolio/epics/${input.initiativeId}`),
  mapError: (e) =>
    e.kind === "not_found" ? "KPI nicht gefunden" : "Messwert konnte nicht gespeichert werden",
});
