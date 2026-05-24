"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createServerAction } from "@/server/http/server-action";
import { fields } from "@/server/http/form-data";
import { saveTargetModel } from "@/server/services/target-model";
import { OPERATING_MODEL_TEMPLATES } from "@/domain/operating-model";
import type { ActionState } from "@/server/http/server-action";

export type { ActionState as TargetModelActionState };

const practicesSchema = z.object({
  portfolioLevel: z.boolean(),
  programLevel: z.boolean(),
  stageGates: z.boolean(),
  wsjf: z.boolean(),
  multiPartyApproval: z.boolean(),
  featureQs: z.boolean(),
  dependencies: z.boolean(),
  piObjectives: z.boolean(),
});

const nullableCount = z.number().int().min(0).max(1000).nullable();

const schema = z.object({
  template: z.enum(OPERATING_MODEL_TEMPLATES),
  targetDate: z.string().nullable().optional(),
  structure: z.object({
    targetValueStreams: nullableCount,
    targetArtsTotal: nullableCount,
    targetTeamsTotal: nullableCount,
    targetPiCadenceWeeks: z.number().int().min(1).max(52).nullable(),
  }),
  practices: practicesSchema,
  activate: z.boolean(),
});

/** Save or activate the tenant's target operating model. The configurator
 *  posts the whole model as one JSON `payload` (nested + booleans). */
export const saveTargetModelAction = createServerAction({
  schema,
  action: "target.manage",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  parseFormData: (fd) => JSON.parse(fields(fd).string("payload") ?? "{}"),
  service: (ctx, input) =>
    saveTargetModel(ctx, {
      template: input.template,
      targetDate: input.targetDate ? new Date(input.targetDate) : null,
      structure: input.structure,
      practices: input.practices,
      activate: input.activate,
    }),
  onSuccess: () => {
    revalidatePath("/transformation/ziel", "page");
    revalidatePath("/transformation", "page");
    revalidatePath("/structure", "page");
  },
  mapError: () => "Zielzustand konnte nicht gespeichert werden",
});
