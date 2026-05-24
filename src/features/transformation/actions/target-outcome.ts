"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createServerAction } from "@/server/http/server-action";
import { fields } from "@/server/http/form-data";
import { saveTargetOutcome, deleteTargetOutcome } from "@/server/services/target-outcome";
import type { ActionState } from "@/server/http/server-action";

export type { ActionState as TargetOutcomeActionState };

function revalidate() {
  revalidatePath("/transformation/ziel", "page");
  revalidatePath("/transformation", "page");
}

const saveSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  title: z.string().min(1).max(200),
  metricUnit: z.string().max(40).nullable().optional(),
  baseline: z.number().nullable().optional(),
  target: z.number(),
  current: z.number().nullable().optional(),
  dueDate: z.string().nullable().optional(),
});

/** Create or update an org-wide target outcome. Posted as one JSON `payload`. */
export const saveTargetOutcomeAction = createServerAction({
  schema: saveSchema,
  action: "target.manage",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  parseFormData: (fd) => JSON.parse(fields(fd).string("payload") ?? "{}"),
  service: (ctx, input) =>
    saveTargetOutcome(ctx, {
      id: input.id ?? null,
      title: input.title,
      metricUnit: input.metricUnit ?? null,
      baseline: input.baseline ?? null,
      target: input.target,
      current: input.current ?? null,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
    }),
  onSuccess: revalidate,
  mapError: (e) => (e.kind === "not_found" ? "Outcome nicht gefunden" : "Speichern fehlgeschlagen"),
});

export const deleteTargetOutcomeAction = createServerAction({
  schema: z.object({ id: z.string().uuid() }),
  action: "target.manage",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  parseFormData: (fd) => ({ id: fields(fd).string("id") }),
  service: (ctx, input) => deleteTargetOutcome(ctx, { id: input.id }),
  onSuccess: revalidate,
  mapError: (e) => (e.kind === "not_found" ? "Outcome nicht gefunden" : "Löschen fehlgeschlagen"),
});
