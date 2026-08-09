"use server";

import { z } from "zod";
import { createKpi, updateKpi, deleteKpi, recordKpiMeasurement } from "@/modules/core/kpi/server/kpi";
import type { KpiId } from "@/modules/core/kpi/server/kpi";
import { createServerAction } from "@/server/http/server-action";
import type { ActionState } from "@/server/http/server-action";
import type { EpicId } from "@/domain/types";

export type { ActionState as KpiActionState };

/** Absent Union-Felder liest parseFromSchema als null → auf undefined normalisieren. */
const kindField = z.preprocess((v) => v ?? undefined, z.enum(["one_time", "recurring"]).optional());
const intervalField = z.preprocess((v) => v ?? undefined, z.enum(["monthly", "yearly"]).optional());
const strField = z.preprocess((v) => v ?? undefined, z.string().max(2000).optional());
/** Roh-String für €-Werte; "" = löschen, leer/absent = unverändert. */
const numStrField = z.preprocess((v) => v ?? undefined, z.string().optional());

/** "" | undefined → undefined (create) bzw. null (clear). */
function parseValue(raw: string | undefined, emptyTo: undefined | null): number | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === "") return emptyTo;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

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
    weightPercent: z.coerce.number().min(0).optional(),
    benefitKind: kindField,
    recurringInterval: intervalField,
    valuePerUnit: numStrField,
    calculationNote: strField,
  }),
  action: "epic.update",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: (ctx, input) => {
    const vpu = parseValue(input.valuePerUnit, undefined);
    return createKpi(ctx, {
      initiativeId: input.initiativeId as EpicId,
      name: input.name,
      unit: input.unit,
      baseline: input.baseline,
      target: input.target,
      ...(input.weightPercent !== undefined && { benefitWeight: input.weightPercent / 100 }),
      ...(input.benefitKind !== undefined && { benefitKind: input.benefitKind }),
      ...(input.recurringInterval !== undefined && { recurringInterval: input.recurringInterval }),
      ...(vpu !== undefined && { valuePerUnit: vpu }),
      ...(input.calculationNote !== undefined && {
        calculationNote: input.calculationNote || null,
      }),
    });
  },
  revalidate: "epic",
  mapError: (e) =>
    e.kind === "not_found" ? "Epic nicht gefunden" : "KPI konnte nicht erstellt werden",
});

/**
 * Per-KPI-Detailpflege (Owner, `epic.update`): Benefit-Art, €-Wert-Vorschlag,
 * Kalkulations-Notiz. Jedes Formular sendet nur die Felder, die es ändert —
 * absente Felder bleiben unverändert; "" löscht (Wert/Notiz).
 */
export const updateKpiDetailsAction = createServerAction({
  schema: z.object({
    id: z.string().uuid(),
    initiativeId: z.string().uuid(),
    benefitKind: kindField,
    recurringInterval: intervalField,
    valuePerUnit: numStrField,
    calculationNote: strField,
  }),
  action: "epic.update",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: (ctx, input) => {
    const vpu = parseValue(input.valuePerUnit, null);
    return updateKpi(ctx, {
      id: input.id as KpiId,
      ...(input.benefitKind !== undefined && { benefitKind: input.benefitKind }),
      ...(input.recurringInterval !== undefined && { recurringInterval: input.recurringInterval }),
      ...(vpu !== undefined && { valuePerUnit: vpu }),
      ...(input.calculationNote !== undefined && {
        calculationNote: input.calculationNote === "" ? null : input.calculationNote,
      }),
    });
  },
  revalidate: "epic",
  mapError: (e) =>
    e.kind === "not_found" ? "KPI nicht gefunden" : "KPI konnte nicht gespeichert werden",
});

/** Sets a KPI's share of the recurring benefit (percent input; empty clears it). */
export const updateKpiWeightAction = createServerAction({
  schema: z.object({
    id: z.string().uuid(),
    initiativeId: z.string().uuid(),
    weightPercent: z.coerce.number().min(0).optional(),
  }),
  action: "epic.update",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: (ctx, input) =>
    updateKpi(ctx, {
      id: input.id as KpiId,
      benefitWeight: input.weightPercent !== undefined ? input.weightPercent / 100 : null,
    }),
  revalidate: "epic",
  mapError: (e) =>
    e.kind === "not_found" ? "KPI nicht gefunden" : "Anteil konnte nicht gespeichert werden",
});

export const deleteKpiAction = createServerAction({
  schema: z.object({ id: z.string().uuid(), initiativeId: z.string().uuid() }),
  action: "epic.update",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
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
  service: (ctx, input) =>
    recordKpiMeasurement(ctx, { id: input.id as KpiId, date: input.date, value: input.value }),
  revalidate: "epic",
  mapError: (e) =>
    e.kind === "not_found" ? "KPI nicht gefunden" : "Messwert konnte nicht gespeichert werden",
});
