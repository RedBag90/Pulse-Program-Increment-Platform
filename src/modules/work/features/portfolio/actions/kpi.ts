"use server";

import { z } from "zod";
import {
  createKpi,
  updateKpi,
  deleteKpi,
  recordKpiMeasurement,
} from "@/modules/core/kpi/server/kpi";
import type { KpiId } from "@/modules/core/kpi/server/kpi";
import { createServerAction } from "@/server/http/server-action";
import type { ActionState } from "@/server/http/server-action";
import type { EpicId } from "@/modules/core/kernel/domain/types";
import { formatDomainError } from "@/server/http/domain-error-display";

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
  mapError: (e, t) => formatDomainError(e, { fallbackKey: "errors.action.createKpi" }, t),
});

/**
 * Per-KPI-Detailpflege (Owner, `epic.update`): Benefit-Art, €-Wert-Vorschlag,
 * Kalkulations-Notiz. Jedes Formular sendet nur die Felder, die es ändert —
 * absente Felder bleiben unverändert; "" löscht (Wert/Notiz).
 */
/**
 * **Stammdaten einer KPI: Name, Einheit, Baseline, Ziel.**
 *
 * Der Dienst `updateKpi` nimmt die vier seit jeher entgegen — nur reichte sie
 * niemand durch, und die Fläche bot sie ausschliesslich beim **Anlegen** an.
 * Eine einmal angelegte KPI liess sich deshalb weder umbenennen noch umzielen:
 * wer sich vertippt hatte, löschte sie und legte sie neu an, und verlor dabei
 * die ganze Messreihe.
 *
 * **Baseline und Ziel sind nach L4.2 gesperrt.** Mit der Abnahme „Umsetzung
 * fertig" friert die gelieferte **Menge** ein (ADR-0024 / Wiki „Die Wirkung");
 * ein nachträglich verschobenes Ziel würde die eingefrorene Zielerreichung
 * rückwirkend verändern — aus 70 % würden 90 %, ohne dass jemand etwas
 * geliefert hätte. Der **Name** bleibt jederzeit änderbar: er benennt die
 * Messung, er misst sie nicht.
 */
export const updateKpiBasicsAction = createServerAction({
  schema: z.object({
    id: z.string().uuid(),
    initiativeId: z.string().uuid(),
    name: z.string().min(1).max(200),
    unit: strField,
    baseline: numStrField,
    target: numStrField,
  }),
  action: "epic.update",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: (ctx, input) => {
    const baseline = parseValue(input.baseline, undefined);
    const target = parseValue(input.target, undefined);
    return updateKpi(ctx, {
      id: input.id as KpiId,
      name: input.name,
      // `unit` kennt kein `null` — der Leerstring ist die Löschung.
      ...(input.unit !== undefined && { unit: input.unit }),
      // Baseline und Ziel sind Zahlen ohne Leerwert — ein leeres Feld heisst
      // „nicht anfassen", nicht „auf null setzen": die beiden tragen die
      // Nutzen-Rechnung, und eine stille Null wäre dort eine Aussage.
      // Baseline und Ziel sind Zahlen ohne Leerwert — ein leeres Feld heisst
      // „nicht anfassen", nicht „auf null setzen": die beiden tragen die
      // Nutzen-Rechnung, und eine stille Null wäre dort eine Aussage.
      ...(typeof baseline === "number" && { baseline }),
      ...(typeof target === "number" && { target }),
    });
  },
  revalidate: "epic",
  mapError: (e, t) => formatDomainError(e, { fallbackKey: "errors.action.saveKpi" }, t),
});

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
  mapError: (e, t) => formatDomainError(e, { fallbackKey: "errors.action.saveKpi" }, t),
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
  mapError: (e, t) => formatDomainError(e, { fallbackKey: "errors.action.saveShare" }, t),
});

export const deleteKpiAction = createServerAction({
  schema: z.object({ id: z.string().uuid(), initiativeId: z.string().uuid() }),
  action: "epic.update",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: (ctx, input) => deleteKpi(ctx, { id: input.id as KpiId }),
  revalidate: "epic",
  mapError: (e, t) => formatDomainError(e, { fallbackKey: "errors.action.deleteKpi" }, t),
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
  mapError: (e, t) => formatDomainError(e, { fallbackKey: "errors.action.saveMeasurement" }, t),
});
