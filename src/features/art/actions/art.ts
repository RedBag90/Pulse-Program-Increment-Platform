"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createArt } from "@/server/services/art";
import { createServerAction } from "@/server/http/server-action";
import type { ValueStreamId } from "@/domain/types";

export interface ArtActionState {
  error?: string;
  success?: boolean;
}

export const createArtAction = createServerAction({
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
    createArt(ctx.db, {
      tenantId: ctx.principal.tenantId,
      actorId: ctx.principal.id,
      valueStreamId: input.valueStreamId as ValueStreamId,
      name: input.name,
      piCadenceWeeks: input.piCadenceWeeks,
      ...(ctx.ipAddress !== undefined && { ipAddress: ctx.ipAddress }),
      ...(ctx.userAgent !== undefined && { userAgent: ctx.userAgent }),
    }),
  onSuccess: () => revalidatePath("/art"),
  mapError: (e) => (e.kind === "conflict" ? e.reason : "Failed to create ART"),
});
