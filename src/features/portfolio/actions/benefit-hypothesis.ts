"use server";

import { z } from "zod";
import { saveBenefitHypothesis } from "@/server/services/epic";
import { createServerAction } from "@/server/http/server-action";
import { fields } from "@/server/http/form-data";
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
  parseFormData: (fd) => {
    const f = fields(fd);
    return {
      epicId: f.string("epicId"),
      measuresHypothesis: f.nonEmptyString("measuresHypothesis"),
      changeFromBaseline: f.nonEmptyString("changeFromBaseline"),
      businessOutcomes: toLines(f.raw("businessOutcomes")),
      leadingIndicators: toLines(f.raw("leadingIndicators")),
      risks: toLines(f.raw("risks")),
    };
  },
  service: (ctx, input) => {
    const { epicId, ...fields } = input;
    return saveBenefitHypothesis(ctx, { epicId: epicId as EpicId, fields });
  },
  revalidate: "epic",
  mapError: (e) =>
    e.kind === "not_found" ? "Epic not found" : "Failed to save benefit hypothesis",
});
