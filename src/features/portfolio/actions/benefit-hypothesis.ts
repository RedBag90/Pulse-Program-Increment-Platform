"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { saveBenefitHypothesis } from "@/server/services/initiative";
import { createServerAction } from "@/server/http/server-action";
import type { EpicId } from "@/domain/types";
import type { ActionState } from "@/server/http/server-action";

export type { ActionState as BenefitHypothesisActionState };

/** Splits a textarea value into trimmed, non-empty list items (one per line). */
function toLines(value: FormDataEntryValue | null): string[] {
  if (typeof value !== "string") return [];
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");
}

export const saveBenefitHypothesisAction = createServerAction({
  schema: z.object({
    epicId: z.string().uuid(),
    measuresHypothesis: z.string().optional(),
    changeFromBaseline: z.string().optional(),
    businessOutcomes: z.array(z.string()).optional(),
    leadingIndicators: z.array(z.string()).optional(),
    risks: z.array(z.string()).optional(),
  }),
  action: "epic.update",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  parseFormData: (fd) => ({
    epicId: fd.get("epicId"),
    measuresHypothesis: fd.get("measuresHypothesis") || undefined,
    changeFromBaseline: fd.get("changeFromBaseline") || undefined,
    businessOutcomes: toLines(fd.get("businessOutcomes")),
    leadingIndicators: toLines(fd.get("leadingIndicators")),
    risks: toLines(fd.get("risks")),
  }),
  service: (ctx, input) => {
    const { epicId, ...fields } = input;
    return saveBenefitHypothesis(ctx, { epicId: epicId as EpicId, fields });
  },
  onSuccess: (input) => revalidatePath(`/portfolio/epics/${input.epicId}`),
  mapError: (e) =>
    e.kind === "not_found" ? "Epic not found" : "Failed to save benefit hypothesis",
});
