"use server";

import { z } from "zod";
import { createServerAction } from "@/server/http/server-action";
import { saveSavedFilter, deleteSavedFilter } from "@/server/services/saved-filter";
import { formatDomainError } from "@/server/http/domain-error-display";

const criteriaSchema = z.object({
  period: z.array(z.string()).default([]),
  vs: z.array(z.string()).default([]),
  art: z.array(z.string()).default([]),
  status: z.array(z.string()).default([]),
});

/**
 * Speichert einen benannten Ziele-Filter des aktuellen Nutzers (Upsert per
 * Name). `criteria` kommt als JSON-String im FormData-Feld; `isDefault` macht
 * ihn zum Auto-Standard beim Öffnen von `/ziele`.
 */
export const saveGoalFilterAction = createServerAction({
  schema: z.object({
    name: z.string().min(1).max(80),
    criteria: criteriaSchema,
    isDefault: z.boolean().default(false),
  }),
  action: "goal_filter.manage",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  parseFormData: (fd) => ({
    name: String(fd.get("name") ?? "").trim(),
    isDefault: fd.get("isDefault") === "true" || fd.get("isDefault") === "on",
    criteria: JSON.parse(String(fd.get("criteria") ?? "{}")),
  }),
  service: (ctx, input) => saveSavedFilter(ctx, { ...input, scope: "goals" }),
  revalidate: "goalFilter",
  mapError: (e) => formatDomainError(e, { fallback: "Filter konnte nicht gespeichert werden" }),
});

/** Löscht einen gespeicherten Ziele-Filter des aktuellen Nutzers. */
export const deleteGoalFilterAction = createServerAction({
  schema: z.object({ id: z.string().uuid() }),
  action: "goal_filter.manage",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  parseFormData: (fd) => ({ id: String(fd.get("id") ?? "") }),
  service: (ctx, input) => deleteSavedFilter(ctx, { id: input.id, scope: "goals" }),
  revalidate: "goalFilter",
  mapError: (e) => formatDomainError(e, { fallback: "Filter konnte nicht gelöscht werden" }),
});
