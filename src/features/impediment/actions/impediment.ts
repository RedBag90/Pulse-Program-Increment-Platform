"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import {
  createImpediment,
  escalateImpediment,
  resolveImpediment,
  type ImpedimentId,
} from "@/server/services/impediment";
import { isErr } from "@/domain/errors";
import { redirect } from "next/navigation";
import type { TenantId, ArtId } from "@/domain/types";

const createSchema = z.object({
  artId: z.string().uuid(),
  title: z.string().min(1, "Title required").max(300),
  description: z.string().max(5000).optional(),
  severity: z.enum(["low", "medium", "high", "critical"]).default("medium"),
});

export type ImpedimentActionState = { error?: string; success?: boolean };

export async function createImpedimentAction(
  _prev: ImpedimentActionState,
  formData: FormData,
): Promise<ImpedimentActionState> {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const parsed = createSchema.safeParse({
    artId: formData.get("artId"),
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    severity: formData.get("severity") || "medium",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const result = await createImpediment(db, {
    tenantId: principal.tenantId as TenantId,
    actorId: principal.id,
    artId: parsed.data.artId as ArtId,
    title: parsed.data.title,
    description: parsed.data.description,
    severity: parsed.data.severity,
  });

  if (isErr(result)) return { error: "Failed to log impediment" };

  revalidatePath("/art/[artId]/impediments", "page");
  return { success: true };
}

export async function escalateImpedimentAction(
  id: string,
  artId: string,
): Promise<ImpedimentActionState> {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

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
