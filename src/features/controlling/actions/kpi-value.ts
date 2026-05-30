"use server";

import { z } from "zod";
import { setKpiValuePerUnit, setTargetOutcomeValuePerUnit } from "@/server/services/controlling";
import { createServerAction } from "@/server/http/server-action";
import { fields } from "@/server/http/form-data";

/** Empty string → null (clear); otherwise the parsed number. */
const valueOrNull = z
  .union([z.literal(""), z.coerce.number().finite()])
  .transform((v) => (v === "" ? null : v));

export const setKpiValuePerUnitAction = createServerAction({
  schema: z.object({ kpiId: z.string().uuid(), valuePerUnit: valueOrNull }),
  action: "kpi.value.manage",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  parseFormData: (fd) => {
    const f = fields(fd);
    return { kpiId: f.string("kpiId"), valuePerUnit: f.optionalString("valuePerUnit") ?? "" };
  },
  service: (ctx, input) =>
    setKpiValuePerUnit(ctx, { kpiId: input.kpiId, valuePerUnit: input.valuePerUnit }),
  revalidate: "kpiTree",
  mapError: (e) =>
    e.kind === "forbidden"
      ? e.reason
      : e.kind === "not_found"
        ? "KPI nicht gefunden"
        : "Wert konnte nicht gespeichert werden",
});

export const setTargetOutcomeValuePerUnitAction = createServerAction({
  schema: z.object({ id: z.string().uuid(), valuePerUnit: valueOrNull }),
  action: "kpi.value.manage",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  parseFormData: (fd) => {
    const f = fields(fd);
    return { id: f.string("id"), valuePerUnit: f.optionalString("valuePerUnit") ?? "" };
  },
  service: (ctx, input) =>
    setTargetOutcomeValuePerUnit(ctx, { id: input.id, valuePerUnit: input.valuePerUnit }),
  revalidate: "kpiTree",
  mapError: (e) =>
    e.kind === "forbidden"
      ? e.reason
      : e.kind === "not_found"
        ? "Strategische KPI nicht gefunden"
        : "Wert konnte nicht gespeichert werden",
});
