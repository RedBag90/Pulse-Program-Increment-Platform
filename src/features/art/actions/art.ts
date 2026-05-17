"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createArt, softDeleteArt } from "@/server/services/art";
import { createServerAction } from "@/server/http/server-action";
import type { ValueStreamId, ArtId } from "@/domain/types";

export interface ArtActionState {
  error?: string;
  success?: boolean;
}

export const createArtAction = createServerAction({
  describeCreated: (v: { id: string }) => ({ id: v.id, label: "ART", href: `/art/${v.id}` }),
  schema: z.object({
    valueStreamId: z.string().uuid(),
    name: z.string().min(1).max(100),
    piCadenceWeeks: z.coerce.number().int().min(8).max(12).optional(),
  }),
  action: "art.create",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  parseFormData: (fd) => ({
    valueStreamId: fd.get("valueStreamId"),
    name: fd.get("name"),
    piCadenceWeeks: fd.get("piCadenceWeeks") ?? undefined,
  }),
  service: (ctx, input) =>
    createArt(ctx, {
      valueStreamId: input.valueStreamId as ValueStreamId,
      name: input.name,
      piCadenceWeeks: input.piCadenceWeeks,
    }),
  onSuccess: () => revalidatePath("/art"),
  mapError: (e) => (e.kind === "conflict" ? e.reason : "Failed to create ART"),
});

export const deleteArtAction = createServerAction({
  schema: z.object({ id: z.string().uuid() }),
  action: "art.delete",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  parseFormData: (fd) => ({ id: fd.get("id") }),
  service: (ctx, input) => softDeleteArt(ctx, { id: input.id as ArtId }),
  onSuccess: () => revalidatePath("/art"),
  mapError: (e) =>
    e.kind === "conflict"
      ? e.reason
      : e.kind === "not_found"
        ? "ART not found"
        : "Failed to delete ART",
});
