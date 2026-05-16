"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { createEpic, updateEpic } from "@/server/services/initiative";
import { authorize } from "@/server/auth/authorize";
import { headers } from "next/headers";
import { extractRequestMeta } from "@/server/audit/emit";
import { isErr } from "@/domain/errors";
import type { ValueStreamId, EpicId } from "@/domain/types";

const createEpicSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  valueStreamId: z.string().uuid(),
});

const updateEpicSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
});

export interface EpicActionState {
  error?: string;
  success?: boolean;
}

export async function createEpicAction(
  _prev: EpicActionState,
  formData: FormData,
): Promise<EpicActionState> {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) return { error: "Not authenticated" };

  if (!authorize("epic.create", { tenantId: principal.tenantId }, principal).allow) {
    return { error: "Insufficient permissions" };
  }

  const parsed = createEpicSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") ?? undefined,
    valueStreamId: formData.get("valueStreamId"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { ipAddress, userAgent } = extractRequestMeta(await headers());
  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });

  const result = await createEpic(db, {
    tenantId: principal.tenantId,
    actorId: principal.id,
    title: parsed.data.title,
    description: parsed.data.description,
    valueStreamId: parsed.data.valueStreamId as ValueStreamId,
    ipAddress,
    userAgent,
  });

  if (isErr(result)) {
    return {
      error: result.error.kind === "not_found" ? "Value stream not found" : "Failed to create epic",
    };
  }

  revalidatePath("/portfolio/epics");
  return { success: true };
}

export async function updateEpicAction(
  _prev: EpicActionState,
  formData: FormData,
): Promise<EpicActionState> {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) return { error: "Not authenticated" };

  if (!authorize("epic.update", { tenantId: principal.tenantId }, principal).allow) {
    return { error: "Insufficient permissions" };
  }

  const parsed = updateEpicSchema.safeParse({
    id: formData.get("id"),
    title: formData.get("title") ?? undefined,
    description: formData.get("description") ?? undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { ipAddress, userAgent } = extractRequestMeta(await headers());
  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });

  const result = await updateEpic(db, {
    tenantId: principal.tenantId,
    actorId: principal.id,
    id: parsed.data.id as EpicId,
    title: parsed.data.title,
    description: parsed.data.description,
    ipAddress,
    userAgent,
  });

  if (isErr(result)) {
    return {
      error: result.error.kind === "not_found" ? "Epic not found" : "Failed to update epic",
    };
  }

  revalidatePath(`/portfolio/epics/${parsed.data.id}`);
  return { success: true };
}
