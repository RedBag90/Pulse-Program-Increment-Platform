"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createServerAction } from "@/server/http/server-action";
import { fields } from "@/server/http/form-data";
import {
  createTransformationAction,
  updateTransformationAction,
  deleteTransformationAction,
  ACTION_STATUSES,
} from "@/server/services/target-action";
import type { ActionState } from "@/server/http/server-action";

export type { ActionState as TransformationActionState };

function revalidate() {
  revalidatePath("/transformation", "page");
}

export const createTransformationActionAction = createServerAction({
  schema: z.object({
    title: z.string().min(1).max(300),
    ownerId: z.string().uuid().nullable().optional(),
    dueDate: z.string().nullable().optional(),
  }),
  action: "target.manage",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  parseFormData: (fd) => {
    const f = fields(fd);
    return {
      title: f.string("title"),
      ownerId: f.nullableString("ownerId"),
      dueDate: f.nonEmptyString("dueDate") ?? null,
    };
  },
  service: (ctx, input) =>
    createTransformationAction(ctx, {
      title: input.title,
      ownerId: input.ownerId ?? null,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
    }),
  onSuccess: revalidate,
  mapError: () => "Maßnahme konnte nicht angelegt werden",
});

export const updateTransformationActionAction = createServerAction({
  schema: z.object({
    id: z.string().uuid(),
    status: z.enum(ACTION_STATUSES).optional(),
    ownerId: z.string().uuid().nullable().optional(),
  }),
  action: "target.manage",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  parseFormData: (fd) => {
    const f = fields(fd);
    return {
      id: f.string("id"),
      status: f.nonEmptyString("status"),
      ownerId: f.nullableString("ownerId"),
    };
  },
  service: (ctx, input) =>
    updateTransformationAction(ctx, { id: input.id, status: input.status, ownerId: input.ownerId }),
  onSuccess: revalidate,
  mapError: (e) =>
    e.kind === "not_found" ? "Maßnahme nicht gefunden" : "Speichern fehlgeschlagen",
});

export const deleteTransformationActionAction = createServerAction({
  schema: z.object({ id: z.string().uuid() }),
  action: "target.manage",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  parseFormData: (fd) => ({ id: fields(fd).string("id") }),
  service: (ctx, input) => deleteTransformationAction(ctx, { id: input.id }),
  onSuccess: revalidate,
  mapError: (e) => (e.kind === "not_found" ? "Maßnahme nicht gefunden" : "Löschen fehlgeschlagen"),
});
