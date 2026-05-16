"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { createFeature, scoreFeature } from "@/server/services/feature";
import { authorize } from "@/server/auth/authorize";
import { headers } from "next/headers";
import { extractRequestMeta } from "@/server/audit/emit";
import { isErr } from "@/domain/errors";
import { fibonacci } from "@/domain/schemas/initiative";
import type { EpicId, ArtId, FeatureId } from "@/domain/types";

const createSchema = z.object({
  artId: z.string().uuid(),
  parentId: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().max(10_000).optional(),
  wsjfBusinessValue: z.coerce.number().pipe(fibonacci),
  wsjfTimeCriticality: z.coerce.number().pipe(fibonacci),
  wsjfRiskReduction: z.coerce.number().pipe(fibonacci),
  wsjfJobSize: z.coerce.number().pipe(fibonacci),
  acceptanceCriteria: z.string().optional(),
});

export interface FeatureActionState {
  error?: string;
  success?: boolean;
}

export async function createFeatureAction(
  _prev: FeatureActionState,
  formData: FormData,
): Promise<FeatureActionState> {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) return { error: "Not authenticated" };

  const raw = {
    artId: formData.get("artId"),
    parentId: formData.get("parentId"),
    title: formData.get("title"),
    description: (formData.get("description") as string | null) ?? undefined,
    wsjfBusinessValue: formData.get("wsjfBusinessValue"),
    wsjfTimeCriticality: formData.get("wsjfTimeCriticality"),
    wsjfRiskReduction: formData.get("wsjfRiskReduction"),
    wsjfJobSize: formData.get("wsjfJobSize"),
    acceptanceCriteria: (formData.get("acceptanceCriteria") as string | null) ?? undefined,
  };

  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  if (
    !authorize(
      "feature.create",
      { tenantId: principal.tenantId, artId: parsed.data.artId },
      principal,
    ).allow
  ) {
    return { error: "Insufficient permissions" };
  }

  const acceptanceCriteria = parsed.data.acceptanceCriteria
    ? parsed.data.acceptanceCriteria
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  const { ipAddress, userAgent } = extractRequestMeta(await headers());
  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });

  const result = await createFeature(db, {
    tenantId: principal.tenantId,
    actorId: principal.id,
    parentId: parsed.data.parentId as EpicId,
    artId: parsed.data.artId as ArtId,
    title: parsed.data.title,
    description: parsed.data.description,
    wsjfBusinessValue: parsed.data.wsjfBusinessValue,
    wsjfTimeCriticality: parsed.data.wsjfTimeCriticality,
    wsjfRiskReduction: parsed.data.wsjfRiskReduction,
    wsjfJobSize: parsed.data.wsjfJobSize,
    acceptanceCriteria,
    ipAddress,
    userAgent,
  });

  if (isErr(result)) {
    return {
      error:
        result.error.kind === "not_found"
          ? `${result.error.resourceType} not found`
          : "Failed to create feature",
    };
  }

  revalidatePath("/art/[artId]/features", "page");
  return { success: true };
}

const scoreSchema = z.object({
  featureId: z.string().uuid(),
  artId: z.string().uuid(),
  wsjfBusinessValue: z.coerce.number().pipe(fibonacci),
  wsjfTimeCriticality: z.coerce.number().pipe(fibonacci),
  wsjfRiskReduction: z.coerce.number().pipe(fibonacci),
  wsjfJobSize: z.coerce.number().pipe(fibonacci),
});

export async function scoreFeatureAction(
  _prev: FeatureActionState,
  formData: FormData,
): Promise<FeatureActionState> {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) return { error: "Not authenticated" };

  const parsed = scoreSchema.safeParse({
    featureId: formData.get("featureId"),
    artId: formData.get("artId"),
    wsjfBusinessValue: formData.get("wsjfBusinessValue"),
    wsjfTimeCriticality: formData.get("wsjfTimeCriticality"),
    wsjfRiskReduction: formData.get("wsjfRiskReduction"),
    wsjfJobSize: formData.get("wsjfJobSize"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  if (
    !authorize(
      "feature.wsjf.set",
      { tenantId: principal.tenantId, artId: parsed.data.artId },
      principal,
    ).allow
  ) {
    return { error: "Insufficient permissions" };
  }

  const { ipAddress, userAgent } = extractRequestMeta(await headers());
  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });

  const result = await scoreFeature(db, {
    tenantId: principal.tenantId,
    actorId: principal.id,
    id: parsed.data.featureId as FeatureId,
    wsjfBusinessValue: parsed.data.wsjfBusinessValue,
    wsjfTimeCriticality: parsed.data.wsjfTimeCriticality,
    wsjfRiskReduction: parsed.data.wsjfRiskReduction,
    wsjfJobSize: parsed.data.wsjfJobSize,
    ipAddress,
    userAgent,
  });

  if (isErr(result)) return { error: "Failed to update WSJF score" };

  revalidatePath("/art/[artId]/features", "page");
  return { success: true };
}
