"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { createTeam } from "@/server/services/team";
import { authorize } from "@/server/auth/authorize";
import { headers } from "next/headers";
import { extractRequestMeta } from "@/server/audit/emit";
import { isErr } from "@/domain/errors";
import type { ArtId } from "@/domain/types";

const createSchema = z.object({
  artId: z.string().uuid(),
  name: z.string().min(1).max(100),
});

export interface TeamActionState {
  error?: string;
  success?: boolean;
}

export async function createTeamAction(
  _prev: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) return { error: "Not authenticated" };

  if (!authorize("team.create", { tenantId: principal.tenantId }, principal).allow) {
    return { error: "Insufficient permissions" };
  }

  const parsed = createSchema.safeParse({
    artId: formData.get("artId"),
    name: formData.get("name"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { ipAddress, userAgent } = extractRequestMeta(await headers());
  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });

  const result = await createTeam(db, {
    tenantId: principal.tenantId,
    actorId: principal.id,
    artId: parsed.data.artId as ArtId,
    name: parsed.data.name,
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
            : "Failed to create team",
    };
  }

  revalidatePath("/art/[artId]/teams", "page");
  return { success: true };
}
