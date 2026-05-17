"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createPiObjective,
  updatePiObjective,
  type PiObjectiveId,
} from "@/server/services/pi-objective";
import { createServerAction } from "@/server/http/server-action";
import type { RequestContext } from "@/server/http/mutation-handler";
import { requirePrincipal } from "@/server/auth/principal";
import { authorize } from "@/server/auth/authorize";
import { createPrismaClient } from "@/server/db/prisma";
import { extractRequestMeta } from "@/server/audit/emit";
import { isErr } from "@/domain/errors";
import type { PiId, TeamId } from "@/domain/types";

export const createPiObjectiveAction = createServerAction({
  schema: z.object({
    piId: z.string().uuid(),
    artId: z.string().uuid(),
    teamId: z.string().uuid(),
    title: z.string().min(1, "Title required").max(200),
    description: z.string().max(2000).optional(),
    businessValue: z.coerce.number().int().min(1).max(10).optional(),
    committed: z.coerce.boolean().optional(),
  }),
  action: "pi_objective.create",
  resource: (input, p) => ({ tenantId: p.tenantId, artId: input.artId, teamId: input.teamId }),
  parseFormData: (fd) => ({
    piId: fd.get("piId"),
    artId: fd.get("artId"),
    teamId: fd.get("teamId"),
    title: fd.get("title"),
    description: fd.get("description") || undefined,
    businessValue: fd.get("businessValue") || undefined,
    committed: fd.get("committed") === "true" ? "true" : "false",
  }),
  service: (ctx, input) =>
    createPiObjective(ctx, {
      piId: input.piId as PiId,
      teamId: input.teamId as TeamId,
      title: input.title,
      description: input.description,
      businessValue: input.businessValue,
      committed: input.committed ?? true,
    }),
  onSuccess: () => revalidatePath("/pi/[piId]/objectives", "page"),
  mapError: (e) => (e.kind === "conflict" ? e.reason : "Failed to create objective"),
});

/** Records a team's SAFe fist-of-five confidence vote (1-5) on a PI objective. */
export async function setObjectiveConfidenceAction(
  objectiveId: string,
  confidence: number,
  artId: string,
): Promise<{ error?: string }> {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  if (!authorize("pi_objective.update", { tenantId: principal.tenantId, artId }, principal).allow) {
    return { error: "Insufficient permissions" };
  }
  if (!Number.isInteger(confidence) || confidence < 1 || confidence > 5) {
    return { error: "Confidence must be between 1 and 5." };
  }

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const { ipAddress, userAgent } = extractRequestMeta(await headers());
  const ctx: RequestContext = {
    principal,
    db,
    ...(ipAddress !== undefined && { ipAddress }),
    ...(userAgent !== undefined && { userAgent }),
  };
  const result = await updatePiObjective(ctx, {
    id: objectiveId as PiObjectiveId,
    confidence,
  });

  if (isErr(result)) {
    return {
      error: result.error.kind === "not_found" ? "Objective not found" : "Failed to save vote",
    };
  }

  revalidatePath("/pi/[piId]/objectives", "page");
  return {};
}
