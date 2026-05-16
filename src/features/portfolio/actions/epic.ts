"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createEpic, updateEpic } from "@/server/services/initiative";
import { createServerAction } from "@/server/http/server-action";
import type { ValueStreamId, EpicId } from "@/domain/types";
import type { ActionState } from "@/server/http/server-action";

export type { ActionState as EpicActionState };

export const createEpicAction = createServerAction({
  schema: z.object({
    title: z.string().min(1).max(200),
    description: z.string().optional(),
    valueStreamId: z.string().uuid(),
  }),
  action: "epic.create",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  parseFormData: (fd) => ({
    title: fd.get("title"),
    description: fd.get("description") || undefined,
    valueStreamId: fd.get("valueStreamId"),
  }),
  service: (ctx, input) =>
    createEpic(ctx.db, {
      tenantId: ctx.principal.tenantId,
      actorId: ctx.principal.id,
      title: input.title,
      description: input.description,
      valueStreamId: input.valueStreamId as ValueStreamId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    }),
  onSuccess: () => revalidatePath("/portfolio/epics"),
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
  parseFormData: (fd) => ({
    id: fd.get("id"),
    title: fd.get("title") || undefined,
    description: fd.get("description") || undefined,
  }),
  service: (ctx, input) =>
    updateEpic(ctx.db, {
      tenantId: ctx.principal.tenantId,
      actorId: ctx.principal.id,
      id: input.id as EpicId,
      title: input.title,
      description: input.description,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    }),
  onSuccess: (input) => revalidatePath(`/portfolio/epics/${input.id}`),
  mapError: (e) => (e.kind === "not_found" ? "Epic not found" : "Failed to update epic"),
});
