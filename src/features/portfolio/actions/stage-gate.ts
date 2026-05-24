"use server";

import { z } from "zod";
import { createServerAction, type ActionState } from "@/server/http/server-action";
import { fields } from "@/server/http/form-data";
import { advanceStageGate } from "@/server/services/epic";
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
  parseFormData: (fd) => {
    const f = fields(fd);
    return {
      epicId: f.string("epicId"),
      toGate: f.string("toGate"),
      comment: f.optionalString("comment"),
    };
  },
  service: (ctx, input) =>
    advanceStageGate(ctx, {
      epicId: input.epicId as EpicId,
      toGate: input.toGate,
      comment: input.comment,
    }),
  revalidate: "epic",
  mapError: (e) =>
    e.kind === "not_found"
      ? "Epic not found"
      : e.kind === "hierarchy_violation"
        ? e.detail
        : "Failed to advance stage gate",
});
