"use server";

import { z } from "zod";
import { createServerAction } from "@/server/http/server-action";
import { formatDomainError } from "@/server/http/domain-error-display";
import { fields } from "@/server/http/form-data";
import { CUSTOM_FIELD_TYPES } from "@/modules/core/goals/domain/goal-custom-field";
import {
  createCustomFieldDef,
  updateCustomFieldDef,
  deleteCustomFieldDef,
} from "@/modules/core/goals/server/services/goal-custom-field";

/**
 * Admin-Actions für Goal-Custom-Field-Definitionen (Epic 7). Gate
 * `goal.custom_field.manage` (Tenant-Admin). Optionen kommen als eine
 * Textarea (Zeile/Komma-getrennt) und werden zu einem String-Array.
 */
const typeEnum = z.enum(CUSTOM_FIELD_TYPES);

/** Textarea-String ("a\nb, c") → getrimmtes, dedupliziertes String-Array. */
const optionsField = z.preprocess(
  (v) =>
    typeof v === "string"
      ? Array.from(
          new Set(
            v
              .split(/[\n,]/)
              .map((s) => s.trim())
              .filter(Boolean),
          ),
        )
      : undefined,
  z.array(z.string().max(100)).max(50).optional(),
);

export const createCustomFieldDefAction = createServerAction({
  schema: z.object({ name: z.string().min(1).max(100), type: typeEnum, options: optionsField }),
  parseFormData: (fd) => {
    const f = fields(fd);
    return { name: f.string("name"), type: f.string("type"), options: f.string("options") };
  },
  action: "goal.custom_field.manage",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: (ctx, input) =>
    createCustomFieldDef(ctx, {
      name: input.name,
      type: input.type,
      options: input.options ?? null,
    }),
  revalidate: "goalCustomFields",
  mapError: (e) => formatDomainError(e, { fallback: "Feld konnte nicht angelegt werden" }),
});

export const updateCustomFieldDefAction = createServerAction({
  schema: z.object({
    id: z.string().uuid(),
    name: z.string().min(1).max(100),
    type: typeEnum,
    options: optionsField,
  }),
  parseFormData: (fd) => {
    const f = fields(fd);
    return {
      id: f.string("id"),
      name: f.string("name"),
      type: f.string("type"),
      options: f.string("options"),
    };
  },
  action: "goal.custom_field.manage",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: (ctx, input) =>
    updateCustomFieldDef(ctx, {
      id: input.id,
      name: input.name,
      type: input.type,
      options: input.options ?? null,
    }),
  revalidate: "goalCustomFields",
  mapError: (e) => formatDomainError(e, { fallback: "Feld konnte nicht aktualisiert werden" }),
});

export const deleteCustomFieldDefAction = createServerAction({
  schema: z.object({ id: z.string().uuid() }),
  parseFormData: (fd) => ({ id: fields(fd).string("id") }),
  action: "goal.custom_field.manage",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: (ctx, input) => deleteCustomFieldDef(ctx, { id: input.id }),
  revalidate: "goalCustomFields",
  mapError: (e) => formatDomainError(e, { fallback: "Feld konnte nicht gelöscht werden" }),
});
