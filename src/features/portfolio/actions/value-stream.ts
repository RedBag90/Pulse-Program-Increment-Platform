"use server";

import { z } from "zod";
import {
  createValueStream,
  updateValueStream,
  softDeleteValueStream,
} from "@/server/services/value-stream";
import { createServerAction } from "@/server/http/server-action";
import { fields } from "@/server/http/form-data";
import type { ValueStreamId } from "@/domain/types";
import type { ActionState } from "@/server/http/server-action";

export type { ActionState as ValueStreamActionState };

export const createValueStreamAction = createServerAction({
  describeCreated: (v: { id: string }) => ({ id: v.id, label: "Value Stream" }),
  schema: z.object({
    name: z.string().min(1).max(100),
    description: z.string().optional(),
    budgetAmount: z
      .string()
      .regex(/^\d+(\.\d{1,2})?$/)
      .optional(),
    budgetCurrency: z.string().length(3).optional(),
  }),
  action: "value_stream.create",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  parseFormData: (fd) => {
    const f = fields(fd);
    return {
      name: f.string("name"),
      description: f.nonEmptyString("description"),
      budgetAmount: f.nonEmptyString("budgetAmount"),
      budgetCurrency: f.nonEmptyString("budgetCurrency"),
    };
  },
  service: (ctx, input) =>
    createValueStream(ctx, {
      name: input.name,
      description: input.description,
      budgetAmount: input.budgetAmount,
      budgetCurrency: input.budgetCurrency,
    }),
  revalidate: "valueStream",
  mapError: (e) => (e.kind === "conflict" ? e.reason : "Failed to create"),
});

export const updateValueStreamAction = createServerAction({
  schema: z.object({
    id: z.string().uuid(),
    name: z.string().min(1).max(100).optional(),
    description: z.string().optional(),
    budgetAmount: z
      .string()
      .regex(/^\d+(\.\d{1,2})?$/)
      .optional(),
    budgetCurrency: z.string().length(3).optional(),
    financeApproverId: z.string().uuid().nullable().optional(),
    vmoId: z.string().uuid().nullable().optional(),
  }),
  action: "value_stream.update",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  parseFormData: (fd) => {
    const f = fields(fd);
    return {
      id: f.string("id"),
      name: f.nonEmptyString("name"),
      description: f.nonEmptyString("description"),
      budgetAmount: f.nonEmptyString("budgetAmount"),
      budgetCurrency: f.nonEmptyString("budgetCurrency"),
      // nullableString: "" clears the assignment (→ null); absent leaves it untouched.
      financeApproverId: f.nullableString("financeApproverId"),
      vmoId: f.nullableString("vmoId"),
    };
  },
  service: (ctx, input) =>
    updateValueStream(ctx, {
      id: input.id as ValueStreamId,
      name: input.name,
      description: input.description,
      budgetAmount: input.budgetAmount,
      budgetCurrency: input.budgetCurrency,
      financeApproverId: input.financeApproverId,
      vmoId: input.vmoId,
    }),
  revalidate: "valueStream",
  mapError: (e) =>
    e.kind === "conflict" ? e.reason : e.kind === "not_found" ? "Not found" : "Failed to update",
});

export const deleteValueStreamAction = createServerAction({
  schema: z.object({
    id: z.string().uuid(),
  }),
  action: "value_stream.update",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  parseFormData: (fd) => ({ id: fields(fd).string("id") }),
  service: (ctx, input) => softDeleteValueStream(ctx, { id: input.id as ValueStreamId }),
  revalidate: "valueStream",
  mapError: (e) => (e.kind === "not_found" ? "Value stream not found" : "Failed to delete"),
});
