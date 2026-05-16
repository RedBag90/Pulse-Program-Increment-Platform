"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { saveLeanBusinessCase } from "@/server/services/initiative";
import { createServerAction } from "@/server/http/server-action";
import type { EpicId } from "@/domain/types";
import type { ActionState } from "@/server/http/server-action";

export type { ActionState as LbcActionState };

export const saveLbcAction = createServerAction({
  schema: z.object({
    epicId: z.string().uuid(),
    problemStatement: z.string().optional(),
    customerValue: z.string().optional(),
    costEstimate: z.string().optional(),
    roiEstimate: z.string().optional(),
    successCriteria: z.string().optional(),
    risks: z.string().optional(),
  }),
  action: "epic.update",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  parseFormData: (fd) => ({
    epicId: fd.get("epicId"),
    problemStatement: fd.get("problemStatement") || undefined,
    customerValue: fd.get("customerValue") || undefined,
    costEstimate: fd.get("costEstimate") || undefined,
    roiEstimate: fd.get("roiEstimate") || undefined,
    successCriteria: fd.get("successCriteria") || undefined,
    risks: fd.get("risks") || undefined,
  }),
  service: (ctx, input) => {
    const { epicId, ...lbcFields } = input;
    return saveLeanBusinessCase(ctx.db, {
      tenantId: ctx.principal.tenantId,
      actorId: ctx.principal.id,
      epicId: epicId as EpicId,
      fields: lbcFields,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
  },
  onSuccess: (input) => revalidatePath(`/portfolio/epics/${input.epicId}`),
  mapError: (e) => (e.kind === "not_found" ? "Epic not found" : "Failed to save LBC"),
});
