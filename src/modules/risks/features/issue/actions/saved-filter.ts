"use server";

import { z } from "zod";
import { createServerAction } from "@/server/http/server-action";
import { saveSavedFilter, deleteSavedFilter } from "@/server/services/saved-filter";
import { formatDomainError } from "@/server/http/domain-error-display";
import {
  ISSUE_FILTER_SET_KEYS,
  ISSUE_FILTER_SINGLE_KEYS,
} from "@/modules/risks/domain/issue-filter-keys";

/**
 * Das Schema entsteht aus der Schlüsselliste, statt sie abzuschreiben: eine
 * später ergänzte Facette ist damit an genau **einer** Stelle einzutragen.
 * Jeder Schlüssel ist ein String-Array — auch die Einzelwerte (siehe
 * `issue-filter-keys.ts`).
 */
const criteriaSchema = z.object(
  Object.fromEntries(
    [...ISSUE_FILTER_SET_KEYS, ...ISSUE_FILTER_SINGLE_KEYS].map((k) => [
      k,
      z.array(z.string()).default([]),
    ]),
  ) as Record<string, z.ZodDefault<z.ZodArray<z.ZodString>>>,
);

/**
 * Speichert einen benannten Issue-Filter des aktuellen Nutzers (Upsert per
 * Name). `criteria` kommt als JSON-String im FormData-Feld; `isDefault` macht
 * ihn zum Auto-Standard beim Öffnen von `/issues`.
 */
export const saveIssueFilterAction = createServerAction({
  schema: z.object({
    name: z.string().min(1).max(80),
    criteria: criteriaSchema,
    isDefault: z.boolean().default(false),
  }),
  action: "issue_filter.manage",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  parseFormData: (fd) => ({
    name: String(fd.get("name") ?? "").trim(),
    isDefault: fd.get("isDefault") === "true" || fd.get("isDefault") === "on",
    criteria: JSON.parse(String(fd.get("criteria") ?? "{}")),
  }),
  service: (ctx, input) => saveSavedFilter(ctx, { ...input, scope: "issues" }),
  revalidate: "issueFilter",
  mapError: (e, t) => formatDomainError(e, { fallbackKey: "errors.action.saveFilter" }, t),
});

/** Löscht einen gespeicherten Issue-Filter des aktuellen Nutzers. */
export const deleteIssueFilterAction = createServerAction({
  schema: z.object({ id: z.string().uuid() }),
  action: "issue_filter.manage",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  parseFormData: (fd) => ({ id: String(fd.get("id") ?? "") }),
  service: (ctx, input) => deleteSavedFilter(ctx, { id: input.id, scope: "issues" }),
  revalidate: "issueFilter",
  mapError: (e, t) => formatDomainError(e, { fallbackKey: "errors.action.deleteFilter" }, t),
});
