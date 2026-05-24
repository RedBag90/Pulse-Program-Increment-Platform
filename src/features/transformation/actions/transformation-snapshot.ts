"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createServerAction } from "@/server/http/server-action";
import { captureTransformationSnapshot } from "@/server/services/transformation-snapshot";
import { toMutationContext } from "@/server/services/mutation";
import type { ActionState } from "@/server/http/server-action";

export type { ActionState as SnapshotActionState };

/**
 * Captures a transformation snapshot on demand — so the "Reise über Zeit" trend
 * works even without the daily cron. Idempotent per day; gated via `target.manage`.
 */
export const captureSnapshotAction = createServerAction({
  schema: z.object({}),
  action: "target.manage",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  parseFormData: () => ({}),
  service: (ctx) => captureTransformationSnapshot(toMutationContext(ctx)),
  onSuccess: () => revalidatePath("/transformation", "page"),
  mapError: () => "Snapshot konnte nicht erfasst werden",
});
