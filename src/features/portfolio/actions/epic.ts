"use server";

import { z } from "zod";
import { createEpic, updateEpic, softDeleteEpic } from "@/server/services/epic";
import { createServerAction } from "@/server/http/server-action";
import { fields } from "@/server/http/form-data";
import type { ValueStreamId, EpicId } from "@/domain/types";
import type { ActionState } from "@/server/http/server-action";

export type { ActionState as EpicActionState };

export const createEpicAction = createServerAction({
  describeCreated: (v: { id: string }) => ({
    id: v.id,
    label: "Epic",
    href: `/portfolio/epics/${v.id}`,
  }),
  schema: z.object({
    title: z.string().min(1).max(200),
    description: z.string().optional(),
    valueStreamId: z.string().uuid(),
  }),
  action: "epic.create",
  // valueStreamId carries the scope so a value_stream_owner can only create
  // Epics within their own value stream.
  resource: (input, p) => ({ tenantId: p.tenantId, valueStreamId: input.valueStreamId }),
  parseFormData: (fd) => {
    const f = fields(fd);
    return {
      title: f.string("title"),
      description: f.nonEmptyString("description"),
      valueStreamId: f.string("valueStreamId"),
    };
  },
  service: (ctx, input) =>
    createEpic(ctx, {
      title: input.title,
      description: input.description,
      valueStreamId: input.valueStreamId as ValueStreamId,
    }),
  revalidate: "epic",
  mapError: (e) => (e.kind === "not_found" ? "Value stream not found" : "Failed to create epic"),
});

export const updateEpicAction = createServerAction({
  schema: z.object({
    id: z.string().uuid(),
    title: z.string().min(1).max(200).optional(),
    description: z.string().optional(),
  }),
  action: "epic.update",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  parseFormData: (fd) => {
    const f = fields(fd);
    return {
      id: f.string("id"),
      title: f.nonEmptyString("title"),
      description: f.nonEmptyString("description"),
    };
  },
  service: (ctx, input) =>
    updateEpic(ctx, {
      id: input.id as EpicId,
      title: input.title,
      description: input.description,
    }),
  revalidate: "epic",
  mapError: (e) => (e.kind === "not_found" ? "Epic not found" : "Failed to update epic"),
});

export const deleteEpicAction = createServerAction({
  schema: z.object({ id: z.string().uuid() }),
  action: "epic.delete",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  parseFormData: (fd) => ({ id: fields(fd).string("id") }),
  service: (ctx, input) => softDeleteEpic(ctx, { id: input.id as EpicId }),
  revalidate: "epic",
  mapError: (e) => (e.kind === "not_found" ? "Epic not found" : "Failed to delete epic"),
});
