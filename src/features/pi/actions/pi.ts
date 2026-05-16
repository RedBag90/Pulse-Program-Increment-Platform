"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { createPi } from "@/server/services/pi";
import { headers } from "next/headers";
import { extractRequestMeta } from "@/server/audit/emit";
import { isErr } from "@/domain/errors";
import type { ArtId } from "@/domain/types";

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

  const canEdit =
    principal.roles.includes("tenant_admin") || principal.roles.includes("platform_admin");
  if (!canEdit) return { error: "Insufficient permissions" };

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
