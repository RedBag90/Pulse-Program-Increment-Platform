"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requirePrincipal } from "@/server/auth/principal";
import { authorize } from "@/server/auth/authorize";
import { createPrismaClient } from "@/server/db/prisma";
import {
  createImpediment,
  escalateImpediment,
  resolveImpediment,
  type ImpedimentId,
} from "@/server/services/impediment";
import { createServerAction } from "@/server/http/server-action";
import { isErr } from "@/domain/errors";
import { redirect } from "next/navigation";
import type { TenantId, ArtId } from "@/domain/types";

export type ImpedimentActionState = { error?: string; success?: boolean };

export const createImpedimentAction = createServerAction({
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
    createImpediment(ctx.db, {
      tenantId: ctx.principal.tenantId as TenantId,
      actorId: ctx.principal.id,
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

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const result = await escalateImpediment(
    db,
    principal.tenantId as TenantId,
    principal.id,
    id as ImpedimentId,
  );

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

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const result = await resolveImpediment(db, {
    tenantId: principal.tenantId as TenantId,
    actorId: principal.id,
    id: id as ImpedimentId,
    resolution,
  });

  if (isErr(result)) {
    return { error: result.error.kind === "conflict" ? result.error.reason : "Failed to resolve" };
  }

  revalidatePath(`/art/${artId}/impediments`, "page");
  return { success: true };
}
