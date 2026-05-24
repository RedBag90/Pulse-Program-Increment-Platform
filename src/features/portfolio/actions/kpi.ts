"use server";

import { z } from "zod";
import { createKpi, deleteKpi, recordKpiMeasurement } from "@/server/services/kpi";
import type { KpiId } from "@/server/services/kpi";
import { createServerAction } from "@/server/http/server-action";
import { fields } from "@/server/http/form-data";
import type { ActionState } from "@/server/http/server-action";
import type { EpicId } from "@/domain/types";

export type { ActionState as KpiActionState };

export const createKpiAction = createServerAction({
  describeCreated: (v: { id: string }, input) => ({
    id: v.id,
    label: "KPI",
    href: `/portfolio/epics/${input.initiativeId}?tab=kpis`,
  }),
  schema: z.object({
    initiativeId: z.string().uuid(),
    name: z.string().min(1).max(200),
    unit: z.string().max(40).optional(),
    baseline: z.coerce.number().optional(),
    target: z.coerce.number().optional(),
  }),
  action: "epic.update",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  parseFormData: (fd) => {
    const f = fields(fd);
    return {
      initiativeId: f.string("initiativeId"),
      name: f.string("name"),
      unit: f.nonEmptyString("unit"),
      baseline: f.nonEmptyString("baseline"),
      target: f.nonEmptyString("target"),
    };
  },
  service: (ctx, input) =>
    createKpi(ctx, {
      initiativeId: input.initiativeId as EpicId,
      name: input.name,
      unit: input.unit,
      baseline: input.baseline,
      target: input.target,
    }),
  revalidate: "epic",
  mapError: (e) =>
    e.kind === "not_found" ? "Epic nicht gefunden" : "KPI konnte nicht erstellt werden",
});

export const deleteKpiAction = createServerAction({
  schema: z.object({ id: z.string().uuid(), initiativeId: z.string().uuid() }),
  action: "epic.update",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  parseFormData: (fd) => {
    const f = fields(fd);
    return { id: f.string("id"), initiativeId: f.string("initiativeId") };
  },
  service: (ctx, input) => deleteKpi(ctx, { id: input.id as KpiId }),
  revalidate: "epic",
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
  parseFormData: (fd) => {
    const f = fields(fd);
    return {
      id: f.string("id"),
      initiativeId: f.string("initiativeId"),
      date: f.string("date"),
      value: f.string("value"),
    };
  },
  service: (ctx, input) =>
    recordKpiMeasurement(ctx, { id: input.id as KpiId, date: input.date, value: input.value }),
  revalidate: "epic",
  mapError: (e) =>
    e.kind === "not_found" ? "KPI nicht gefunden" : "Messwert konnte nicht gespeichert werden",
});
