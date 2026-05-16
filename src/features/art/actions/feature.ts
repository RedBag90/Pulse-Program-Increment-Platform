"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createFeature, scoreFeature, setFeaturePi } from "@/server/services/feature";
import { softDeleteFeature } from "@/server/services/initiative";
import { createServerAction } from "@/server/http/server-action";
import { requirePrincipal } from "@/server/auth/principal";
import { authorize } from "@/server/auth/authorize";
import { createPrismaClient } from "@/server/db/prisma";
import { isErr } from "@/domain/errors";
import { fibonacci } from "@/domain/schemas/initiative";
import type { EpicId, ArtId, FeatureId, PiId, TenantId } from "@/domain/types";

export interface FeatureActionState {
  error?: string;
  success?: boolean;
}

export const createFeatureAction = createServerAction({
  schema: z.object({
    artId: z.string().uuid(),
    parentId: z.string().uuid(),
    title: z.string().min(1).max(200),
    description: z.string().max(10_000).optional(),
    wsjfBusinessValue: z.coerce.number().pipe(fibonacci),
    wsjfTimeCriticality: z.coerce.number().pipe(fibonacci),
    wsjfRiskReduction: z.coerce.number().pipe(fibonacci),
    wsjfJobSize: z.coerce.number().pipe(fibonacci),
    acceptanceCriteria: z.string().optional(),
  }),
  action: "feature.create",
  resource: (input, p) => ({ tenantId: p.tenantId, artId: input.artId }),
  parseFormData: (fd) => ({
    artId: fd.get("artId"),
    parentId: fd.get("parentId"),
    title: fd.get("title"),
    description: (fd.get("description") as string | null) ?? undefined,
    wsjfBusinessValue: fd.get("wsjfBusinessValue"),
    wsjfTimeCriticality: fd.get("wsjfTimeCriticality"),
    wsjfRiskReduction: fd.get("wsjfRiskReduction"),
    wsjfJobSize: fd.get("wsjfJobSize"),
    acceptanceCriteria: (fd.get("acceptanceCriteria") as string | null) ?? undefined,
  }),
  service: (ctx, input) => {
    const acceptanceCriteria = input.acceptanceCriteria
      ? input.acceptanceCriteria
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
    return createFeature(ctx.db, {
      tenantId: ctx.principal.tenantId,
      actorId: ctx.principal.id,
      parentId: input.parentId as EpicId,
      artId: input.artId as ArtId,
      title: input.title,
      description: input.description,
      wsjfBusinessValue: input.wsjfBusinessValue,
      wsjfTimeCriticality: input.wsjfTimeCriticality,
      wsjfRiskReduction: input.wsjfRiskReduction,
      wsjfJobSize: input.wsjfJobSize,
      acceptanceCriteria,
      ...(ctx.ipAddress !== undefined && { ipAddress: ctx.ipAddress }),
      ...(ctx.userAgent !== undefined && { userAgent: ctx.userAgent }),
    });
  },
  onSuccess: () => revalidatePath("/art/[artId]/features", "page"),
  mapError: (e) =>
    e.kind === "not_found" ? `${e.resourceType} not found` : "Failed to create feature",
});

export const scoreFeatureAction = createServerAction({
  schema: z.object({
    featureId: z.string().uuid(),
    artId: z.string().uuid(),
    wsjfBusinessValue: z.coerce.number().pipe(fibonacci),
    wsjfTimeCriticality: z.coerce.number().pipe(fibonacci),
    wsjfRiskReduction: z.coerce.number().pipe(fibonacci),
    wsjfJobSize: z.coerce.number().pipe(fibonacci),
  }),
  action: "feature.wsjf.set",
  resource: (input, p) => ({ tenantId: p.tenantId, artId: input.artId }),
  parseFormData: (fd) => ({
    featureId: fd.get("featureId"),
    artId: fd.get("artId"),
    wsjfBusinessValue: fd.get("wsjfBusinessValue"),
    wsjfTimeCriticality: fd.get("wsjfTimeCriticality"),
    wsjfRiskReduction: fd.get("wsjfRiskReduction"),
    wsjfJobSize: fd.get("wsjfJobSize"),
  }),
  service: (ctx, input) =>
    scoreFeature(ctx.db, {
      tenantId: ctx.principal.tenantId,
      actorId: ctx.principal.id,
      id: input.featureId as FeatureId,
      wsjfBusinessValue: input.wsjfBusinessValue,
      wsjfTimeCriticality: input.wsjfTimeCriticality,
      wsjfRiskReduction: input.wsjfRiskReduction,
      wsjfJobSize: input.wsjfJobSize,
      ...(ctx.ipAddress !== undefined && { ipAddress: ctx.ipAddress }),
      ...(ctx.userAgent !== undefined && { userAgent: ctx.userAgent }),
    }),
  onSuccess: () => revalidatePath("/art/[artId]/features", "page"),
  mapError: () => "Failed to update WSJF score",
});

export const deleteFeatureAction = createServerAction({
  schema: z.object({ id: z.string().uuid(), artId: z.string().uuid() }),
  action: "feature.delete",
  resource: (input, p) => ({ tenantId: p.tenantId, artId: input.artId }),
  parseFormData: (fd) => ({ id: fd.get("id"), artId: fd.get("artId") }),
  service: (ctx, input) =>
    softDeleteFeature(
      ctx.db,
      ctx.principal.tenantId as TenantId,
      input.id as FeatureId,
      ctx.principal.id,
      ctx.ipAddress,
      ctx.userAgent,
    ),
  onSuccess: () => revalidatePath("/art/[artId]/features", "page"),
  mapError: (e) => (e.kind === "not_found" ? "Feature not found" : "Failed to delete feature"),
});

/**
 * Assign one or more features to a PI, or move them back to the backlog (piId = null).
 * Serves both the PI-overview picker and the feature-backlog inline dropdown.
 */
export async function setFeaturePiAction(
  featureIds: string[],
  piId: string | null,
  artId: string,
): Promise<{ error?: string }> {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  if (!authorize("feature.update", { tenantId: principal.tenantId, artId }, principal).allow) {
    return { error: "Insufficient permissions" };
  }

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });

  for (const featureId of featureIds) {
    const result = await setFeaturePi(db, {
      tenantId: principal.tenantId as TenantId,
      actorId: principal.id,
      featureId: featureId as FeatureId,
      piId: piId === null ? null : (piId as PiId),
    });
    if (isErr(result)) {
      return {
        error:
          result.error.kind === "conflict"
            ? result.error.reason
            : result.error.kind === "not_found"
              ? "Feature or PI not found"
              : "Failed to assign feature",
      };
    }
  }

  revalidatePath("/art/[artId]/features", "page");
  revalidatePath("/pi/[piId]", "page");
  return {};
}
