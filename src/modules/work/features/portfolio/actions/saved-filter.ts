"use server";

import { z } from "zod";
import { createServerAction } from "@/server/http/server-action";
import {
  saveSavedPortfolioFilter,
  deleteSavedPortfolioFilter,
} from "@/modules/work/server/services/saved-portfolio-filter";
import { formatDomainError } from "@/server/http/domain-error-display";

const criteriaSchema = z.object({
  vs: z.array(z.string()).default([]),
  gate: z.array(z.string()).default([]),
  status: z.array(z.string()).default([]),
  owner: z.array(z.string()).default([]),
});

/**
 * Speichert einen benannten Portfolio-Filter des aktuellen Nutzers (Upsert per
 * Name). `criteria` kommt als JSON-String im FormData-Feld; `isDefault` markiert
 * ihn als Auto-Standard beim Öffnen der Portfolio-Übersicht.
 */
export const savePortfolioFilterAction = createServerAction({
  schema: z.object({
    name: z.string().min(1).max(80),
    criteria: criteriaSchema,
    isDefault: z.boolean().default(false),
  }),
  action: "portfolio_filter.manage",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  parseFormData: (fd) => ({
    name: String(fd.get("name") ?? "").trim(),
    isDefault: fd.get("isDefault") === "true" || fd.get("isDefault") === "on",
    criteria: JSON.parse(String(fd.get("criteria") ?? "{}")),
  }),
  service: (ctx, input) => saveSavedPortfolioFilter(ctx, input),
  revalidate: "portfolioFilter",
  mapError: (e) => formatDomainError(e, { fallback: "Filter konnte nicht gespeichert werden" }),
});

/** Löscht einen gespeicherten Filter des aktuellen Nutzers. */
export const deletePortfolioFilterAction = createServerAction({
  schema: z.object({ id: z.string().uuid() }),
  action: "portfolio_filter.manage",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  parseFormData: (fd) => ({ id: String(fd.get("id") ?? "") }),
  service: (ctx, input) => deleteSavedPortfolioFilter(ctx, input),
  revalidate: "portfolioFilter",
  mapError: (e) => formatDomainError(e, { fallback: "Filter konnte nicht gelöscht werden" }),
});
