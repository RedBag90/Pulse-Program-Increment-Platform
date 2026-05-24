"use server";

import { z } from "zod";
import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { createPi, startPi, completePi, deletePi } from "@/server/services/pi";
import { authorize } from "@/server/auth/authorize";
import { headers } from "next/headers";
import { extractRequestMeta } from "@/server/audit/emit";
import { isErr } from "@/domain/errors";
import { createServerAction } from "@/server/http/server-action";
import { fields } from "@/server/http/form-data";
import { revalidateFor } from "@/server/http/revalidation";
import type { RequestContext } from "@/server/http/mutation-handler";
import type { ArtId, PiId } from "@/domain/types";

export interface PiActionState {
  error?: string;
  success?: boolean;
}

export const createPiAction = createServerAction({
  describeCreated: (v: { id: string }) => ({
    id: v.id,
    label: "Program Increment",
    href: `/pi/${v.id}`,
  }),
  schema: z.object({
    artId: z.string().uuid(),
    name: z.string().min(1).max(100),
    startDate: z.string().date(),
    endDate: z.string().date(),
  }),
  action: "pi.create",
  resource: (input, p) => ({ tenantId: p.tenantId, artId: input.artId }),
  parseFormData: (fd) => {
    const f = fields(fd);
    return {
      artId: f.string("artId"),
      name: f.string("name"),
      startDate: f.string("startDate"),
      endDate: f.string("endDate"),
    };
  },
  service: (ctx, input) =>
    createPi(ctx, {
      artId: input.artId as ArtId,
      name: input.name,
      startDate: new Date(input.startDate),
      endDate: new Date(input.endDate),
    }),
  revalidate: "pi",
  mapError: (e) =>
    e.kind === "conflict"
      ? e.reason
      : e.kind === "not_found"
        ? "ART not found"
        : "Failed to create PI",
});

export async function transitionPiAction(
  piId: string,
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
  const ctx: RequestContext = {
    principal,
    db,
    ...(ipAddress !== undefined && { ipAddress }),
    ...(userAgent !== undefined && { userAgent }),
  };

  const result =
    targetStatus === "active"
      ? await startPi(ctx, { id: piId as PiId })
      : await completePi(ctx, { id: piId as PiId });

  if (isErr(result)) {
    return {
      error: result.error.kind === "conflict" ? result.error.reason : "Failed to update PI status",
    };
  }

  revalidateFor("pi");
  return { success: true };
}

export const deletePiAction = createServerAction({
  schema: z.object({ id: z.string().uuid(), artId: z.string().uuid() }),
  action: "pi.delete",
  resource: (input, p) => ({ tenantId: p.tenantId, artId: input.artId }),
  parseFormData: (fd) => {
    const f = fields(fd);
    return { id: f.string("id"), artId: f.string("artId") };
  },
  service: (ctx, input) => deletePi(ctx, { id: input.id as PiId }),
  revalidate: "pi",
  mapError: (e) =>
    e.kind === "conflict"
      ? e.reason
      : e.kind === "not_found"
        ? "PI not found"
        : "Failed to delete PI",
});
