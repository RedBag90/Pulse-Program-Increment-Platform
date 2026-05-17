"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { requirePrincipal } from "@/server/auth/principal";
import { authorize } from "@/server/auth/authorize";
import { createPrismaClient } from "@/server/db/prisma";
import { extractRequestMeta } from "@/server/audit/emit";
import {
  createImpediment,
  escalateImpediment,
  resolveImpediment,
  type ImpedimentId,
} from "@/server/services/impediment";
import { createServerAction } from "@/server/http/server-action";
import type { RequestContext } from "@/server/http/mutation-handler";
import { isErr } from "@/domain/errors";
import { redirect } from "next/navigation";
import type { ArtId } from "@/domain/types";

export type ImpedimentActionState = { error?: string; success?: boolean };

/** Builds a RequestContext for service calls from the resolved principal. */
async function buildContext(
  principal: Awaited<ReturnType<typeof requirePrincipal>>,
): Promise<RequestContext> {
  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const { ipAddress, userAgent } = extractRequestMeta(await headers());
  return {
    principal,
    db,
    ...(ipAddress !== undefined && { ipAddress }),
    ...(userAgent !== undefined && { userAgent }),
  };
}

export const createImpedimentAction = createServerAction({
  describeCreated: (v: { id: string }) => ({ id: v.id, label: "Impediment" }),
  schema: z.object({
    artId: z.string().uuid(),
    title: z.string().min(1, "Title required").max(300),
    description: z.string().max(5000).optional(),
    severity: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  }),
  action: "impediment.create",
  resource: (input, p) => ({ tenantId: p.tenantId, artId: input.artId }),
  parseFormData: (fd) => ({
    artId: fd.get("artId"),
    title: fd.get("title"),
    description: fd.get("description") || undefined,
    severity: fd.get("severity") || "medium",
  }),
  service: (ctx, input) =>
    createImpediment(ctx, {
      artId: input.artId as ArtId,
      title: input.title,
      description: input.description,
      severity: input.severity,
    }),
  onSuccess: () => revalidatePath("/art/[artId]/impediments", "page"),
  mapError: () => "Failed to log impediment",
});

export async function escalateImpedimentAction(
  id: string,
  artId: string,
): Promise<ImpedimentActionState> {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  if (!authorize("impediment.escalate", { tenantId: principal.tenantId, artId }, principal).allow) {
    return { error: "Insufficient permissions" };
  }

  const ctx = await buildContext(principal);
  const result = await escalateImpediment(ctx, { id: id as ImpedimentId });

  if (isErr(result)) {
    return { error: result.error.kind === "conflict" ? result.error.reason : "Failed to escalate" };
  }

  revalidatePath(`/art/${artId}/impediments`, "page");
  return { success: true };
}

export async function resolveImpedimentAction(
  id: string,
  artId: string,
  resolution: string,
): Promise<ImpedimentActionState> {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  if (!authorize("impediment.resolve", { tenantId: principal.tenantId, artId }, principal).allow) {
    return { error: "Insufficient permissions" };
  }

  const ctx = await buildContext(principal);
  const result = await resolveImpediment(ctx, { id: id as ImpedimentId, resolution });

  if (isErr(result)) {
    return { error: result.error.kind === "conflict" ? result.error.reason : "Failed to resolve" };
  }

  revalidatePath(`/art/${artId}/impediments`, "page");
  return { success: true };
}
