"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { createPi, startPi, completePi } from "@/server/services/pi";
import { authorize } from "@/server/auth/authorize";
import { headers } from "next/headers";
import { extractRequestMeta } from "@/server/audit/emit";
import { isErr } from "@/domain/errors";
import { createServerAction } from "@/server/http/server-action";
import type { ArtId, PiId } from "@/domain/types";

export interface PiActionState {
  error?: string;
  success?: boolean;
}

export const createPiAction = createServerAction({
  schema: z.object({
    artId: z.string().uuid(),
    name: z.string().min(1).max(100),
    startDate: z.string().date(),
    endDate: z.string().date(),
  }),
  action: "pi.create",
  resource: (input, p) => ({ tenantId: p.tenantId, artId: input.artId }),
  parseFormData: (fd) => ({
    artId: fd.get("artId"),
    name: fd.get("name"),
    startDate: fd.get("startDate"),
    endDate: fd.get("endDate"),
  }),
  service: (ctx, input) =>
    createPi(ctx.db, {
      tenantId: ctx.principal.tenantId,
      actorId: ctx.principal.id,
      artId: input.artId as ArtId,
      name: input.name,
      startDate: new Date(input.startDate),
      endDate: new Date(input.endDate),
      ...(ctx.ipAddress !== undefined && { ipAddress: ctx.ipAddress }),
      ...(ctx.userAgent !== undefined && { userAgent: ctx.userAgent }),
    }),
  onSuccess: () => revalidatePath("/art/[artId]/pi", "page"),
  mapError: (e) =>
    e.kind === "conflict"
      ? e.reason
      : e.kind === "not_found"
        ? "ART not found"
        : "Failed to create PI",
});

export async function transitionPiAction(
  piId: string,
  artId: string,
  targetStatus: "active" | "completed",
): Promise<PiActionState> {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) return { error: "Not authenticated" };

  const action = targetStatus === "active" ? "pi.start" : "pi.complete";
  if (!authorize(action, { tenantId: principal.tenantId }, principal).allow) {
    return { error: "Insufficient permissions" };
  }

  const { ipAddress, userAgent } = extractRequestMeta(await headers());
  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });

  const lifecycleInput = {
    tenantId: principal.tenantId,
    actorId: principal.id,
    id: piId as PiId,
    ipAddress,
    userAgent,
  };
  const result =
    targetStatus === "active"
      ? await startPi(db, lifecycleInput)
      : await completePi(db, lifecycleInput);

  if (isErr(result)) {
    return {
      error: result.error.kind === "conflict" ? result.error.reason : "Failed to update PI status",
    };
  }

  revalidatePath("/art/[artId]/pi/[piId]", "page");
  revalidatePath(`/art/${artId}/pi/${piId}`, "page");
  return { success: true };
}
