"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createServerAction, type ActionState } from "@/server/http/server-action";
import { advanceStageGate } from "@/server/services/initiative";
import { STAGE_GATES } from "@/domain/stage-gate";
import type { EpicId } from "@/domain/types";

export type { ActionState as StageGateActionState };

export const advanceStageGateAction = createServerAction({
  schema: z.object({
    epicId: z.string().uuid(),
    toGate: z.enum(STAGE_GATES),
    comment: z.string().optional(),
  }),
  action: "epic.approve",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  parseFormData: (fd) => ({
    epicId: fd.get("epicId"),
    toGate: fd.get("toGate"),
    comment: fd.get("comment") ?? undefined,
  }),
  service: (ctx, input) =>
    advanceStageGate(ctx, {
      epicId: input.epicId as EpicId,
      toGate: input.toGate,
      comment: input.comment,
    }),
  onSuccess: () => revalidatePath("/portfolio"),
  mapError: (e) =>
    e.kind === "not_found"
      ? "Epic not found"
      : e.kind === "hierarchy_violation"
        ? e.detail
        : "Failed to advance stage gate",
});
