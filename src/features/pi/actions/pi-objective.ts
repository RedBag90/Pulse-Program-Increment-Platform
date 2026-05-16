"use server";

import { requirePrincipal } from "@/server/auth/principal";
import { authorize } from "@/server/auth/authorize";
import { createPrismaClient } from "@/server/db/prisma";
import { createPiObjective } from "@/server/services/pi-objective";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isErr } from "@/domain/errors";
import type { TenantId, PiId, TeamId } from "@/domain/types";

const schema = z.object({
  piId: z.string().uuid(),
  artId: z.string().uuid(),
  teamId: z.string().uuid(),
  title: z.string().min(1, "Title required").max(200),
  description: z.string().max(2000).optional(),
  businessValue: z.coerce.number().int().min(1).max(10).optional(),
  committed: z.coerce.boolean().optional(),
});

export type CreatePiObjectiveState = {
  errors?: Record<string, string[]>;
  message?: string;
};

export async function createPiObjectiveAction(
  _prev: CreatePiObjectiveState,
  formData: FormData,
): Promise<CreatePiObjectiveState> {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const raw = {
    piId: formData.get("piId"),
    artId: formData.get("artId"),
    teamId: formData.get("teamId"),
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    businessValue: formData.get("businessValue") || undefined,
    committed: formData.get("committed") === "true" ? "true" : "false",
  };

  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  if (
    !authorize(
      "pi_objective.create",
      { tenantId: principal.tenantId, artId: parsed.data.artId, teamId: parsed.data.teamId },
      principal,
    ).allow
  ) {
    return { message: "Insufficient permissions" };
  }

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const result = await createPiObjective(db, {
    tenantId: principal.tenantId as TenantId,
    actorId: principal.id,
    piId: parsed.data.piId as PiId,
    teamId: parsed.data.teamId as TeamId,
    title: parsed.data.title,
    description: parsed.data.description,
    businessValue: parsed.data.businessValue,
    committed: parsed.data.committed ?? true,
  });

  if (isErr(result)) {
    return {
      message:
        result.error.kind === "conflict" ? result.error.reason : "Failed to create objective",
    };
  }

  revalidatePath("/art/[artId]/pi/[piId]/objectives", "page");
  return {};
}
