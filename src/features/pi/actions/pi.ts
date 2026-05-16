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
import type { ArtId, PiId } from "@/domain/types";

const createSchema = z.object({
  artId: z.string().uuid(),
  name: z.string().min(1).max(100),
  startDate: z.string().date(),
  endDate: z.string().date(),
});

export interface PiActionState {
  error?: string;
  success?: boolean;
}

export async function createPiAction(
  _prev: PiActionState,
  formData: FormData,
): Promise<PiActionState> {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) return { error: "Not authenticated" };

  if (!authorize("pi.create", { tenantId: principal.tenantId }, principal).allow) {
    return { error: "Insufficient permissions" };
  }

  const parsed = createSchema.safeParse({
    artId: formData.get("artId"),
    name: formData.get("name"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { ipAddress, userAgent } = extractRequestMeta(await headers());
  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });

  const result = await createPi(db, {
    tenantId: principal.tenantId,
    actorId: principal.id,
    artId: parsed.data.artId as ArtId,
    name: parsed.data.name,
    startDate: new Date(parsed.data.startDate),
    endDate: new Date(parsed.data.endDate),
    ipAddress,
    userAgent,
  });

  if (isErr(result)) {
    return {
      error:
        result.error.kind === "conflict"
          ? result.error.reason
          : result.error.kind === "not_found"
            ? "ART not found"
            : "Failed to create PI",
    };
  }

  revalidatePath("/art/[artId]/pi", "page");
  return { success: true };
}

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
