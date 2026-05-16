"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { createArt } from "@/server/services/art";
import { headers } from "next/headers";
import { extractRequestMeta } from "@/server/audit/emit";
import { isErr } from "@/domain/errors";
import type { ValueStreamId } from "@/domain/types";

const createSchema = z.object({
  valueStreamId: z.string().uuid(),
  name: z.string().min(1).max(100),
  piCadenceWeeks: z.coerce.number().int().min(8).max(12).optional(),
});

export interface ArtActionState {
  error?: string;
  success?: boolean;
}

export async function createArtAction(
  _prev: ArtActionState,
  formData: FormData,
): Promise<ArtActionState> {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) return { error: "Not authenticated" };

  const canEdit =
    principal.roles.includes("tenant_admin") || principal.roles.includes("platform_admin");
  if (!canEdit) return { error: "Insufficient permissions" };

  const parsed = createSchema.safeParse({
    valueStreamId: formData.get("valueStreamId"),
    name: formData.get("name"),
    piCadenceWeeks: formData.get("piCadenceWeeks") ?? undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { ipAddress, userAgent } = extractRequestMeta(await headers());
  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });

  const result = await createArt(db, {
    tenantId: principal.tenantId,
    actorId: principal.id,
    valueStreamId: parsed.data.valueStreamId as ValueStreamId,
    name: parsed.data.name,
    piCadenceWeeks: parsed.data.piCadenceWeeks,
    ipAddress,
    userAgent,
  });

  if (isErr(result)) {
    return {
      error: result.error.kind === "conflict" ? result.error.reason : "Failed to create ART",
    };
  }

  revalidatePath("/art");
  return { success: true };
}
