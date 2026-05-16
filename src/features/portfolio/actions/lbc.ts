"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { updateEpic } from "@/server/services/initiative";
import { authorize } from "@/server/auth/authorize";
import { headers } from "next/headers";
import { extractRequestMeta } from "@/server/audit/emit";
import { isErr } from "@/domain/errors";
import type { EpicId } from "@/domain/types";

const lbcSchema = z.object({
  epicId: z.string().uuid(),
  problemStatement: z.string().optional(),
  customerValue: z.string().optional(),
  costEstimate: z.string().optional(),
  roiEstimate: z.string().optional(),
  successCriteria: z.string().optional(),
  risks: z.string().optional(),
});

export interface LbcActionState {
  error?: string;
  success?: boolean;
}

export async function saveLbcAction(
  _prev: LbcActionState,
  formData: FormData,
): Promise<LbcActionState> {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) return { error: "Not authenticated" };

  if (!authorize("epic.update", { tenantId: principal.tenantId }, principal).allow) {
    return { error: "Insufficient permissions" };
  }

  const parsed = lbcSchema.safeParse({
    epicId: formData.get("epicId"),
    problemStatement: formData.get("problemStatement") ?? undefined,
    customerValue: formData.get("customerValue") ?? undefined,
    costEstimate: formData.get("costEstimate") ?? undefined,
    roiEstimate: formData.get("roiEstimate") ?? undefined,
    successCriteria: formData.get("successCriteria") ?? undefined,
    risks: formData.get("risks") ?? undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { epicId, ...lbcFields } = parsed.data;
  const { ipAddress, userAgent } = extractRequestMeta(await headers());
  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });

  const result = await updateEpic(db, {
    tenantId: principal.tenantId,
    actorId: principal.id,
    id: epicId as EpicId,
    leanBusinessCase: lbcFields,
    ipAddress,
    userAgent,
  });

  if (isErr(result)) {
    return { error: result.error.kind === "not_found" ? "Epic not found" : "Failed to save LBC" };
  }

  revalidatePath(`/portfolio/epics/${epicId}`);
  return { success: true };
}
