"use server";

import { z } from "zod";
import { createServerAction, type ActionState } from "@/server/http/server-action";
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
  service: (ctx, input) =>
    advanceStageGate(ctx, {
      epicId: input.epicId as EpicId,
      toGate: input.toGate,
      comment: input.comment,
    }),
  revalidate: "epic",
  mapError: (e) =>
    e.kind === "not_found"
      ? "Epic nicht gefunden"
      : e.kind === "hierarchy_violation"
        ? e.detail
        : e.kind === "forbidden"
          ? e.reason
          : e.kind === "conflict"
            ? e.reason
            : "Stage-Gate-Übergang fehlgeschlagen",
});

/**
 * Bulk stage-gate transition — drives the "Stage ↑ / Stage ↓" buttons in the
 * portfolio epics list's sticky action bar. Uses the Round 3 batch mode of
 * `createServerAction`: one `advanceStageGate` call per id, early-fail on the
 * first conflict so a mid-batch hierarchy violation surfaces as a clear single
 * error rather than a half-applied set of advances. The cap at 50 matches the
 * URL-state selection cap on the client.
 */
export const advanceStageGateBatchAction = createServerAction({
  schema: z.object({
    epicIds: z.array(z.string().uuid()).min(1).max(50),
    toGate: z.enum(STAGE_GATES),
    comment: z.string().max(1000).optional(),
  }),
  action: "epic.approve",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  batch: {
    iterateOver: "epicIds",
    service: (ctx, epicId, rest) =>
      advanceStageGate(ctx, {
        epicId: epicId as EpicId,
        toGate: rest.toGate,
        comment: rest.comment,
      }),
  },
  revalidate: "epic",
  mapError: (e) =>
    e.kind === "not_found"
      ? "Epic nicht gefunden"
      : e.kind === "hierarchy_violation"
        ? e.detail
        : e.kind === "conflict"
          ? e.reason
          : "Stage-Gate-Übergang fehlgeschlagen",
});
