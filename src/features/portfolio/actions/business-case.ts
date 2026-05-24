"use server";

import { z } from "zod";
import { saveBusinessCase } from "@/server/services/epic";
import { createServerAction } from "@/server/http/server-action";
import { businessCaseSchema } from "@/domain/schemas/initiative";
import type { EpicId } from "@/domain/types";
import type { ActionState } from "@/server/http/server-action";

export type { ActionState as BusinessCaseActionState };

/** Reads a numeric FormData field, returning undefined for blank/invalid input. */
function num(fd: FormData, name: string): number | undefined {
  const v = fd.get(name);
  if (typeof v !== "string" || v.trim() === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function text(fd: FormData, name: string): string | undefined {
  const v = fd.get(name);
  return typeof v === "string" && v.trim() !== "" ? v : undefined;
}

export const saveBusinessCaseAction = createServerAction({
  schema: businessCaseSchema.extend({ epicId: z.string().uuid() }),
  action: "epic.update",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  parseFormData: (fd) => ({
    epicId: fd.get("epicId"),
    funnelEntryDate: text(fd, "funnelEntryDate"),
    keyStakeholders: text(fd, "keyStakeholders"),
    initiativeDescription: text(fd, "initiativeDescription"),
    businessOutcomeHypothesis: text(fd, "businessOutcomeHypothesis"),
    leadingIndicators: text(fd, "leadingIndicators"),
    inScope: text(fd, "inScope"),
    outOfScope: text(fd, "outOfScope"),
    whatYouNeedToBelieve: text(fd, "whatYouNeedToBelieve"),
    customersAffected: text(fd, "customersAffected"),
    impactOnSolutions: text(fd, "impactOnSolutions"),
    analysisSummary: text(fd, "analysisSummary"),
    costSlices: Array.from(
      { length: Math.max(0, num(fd, "costSliceCount") ?? 0) },
      (_unused, i) => ({ amount: num(fd, `costSlice_${i}`) }),
    ),
    oneTimeBenefit: num(fd, "oneTimeBenefit"),
    recurringBenefit: num(fd, "recurringBenefit"),
  }),
  service: (ctx, input) => {
    const { epicId, ...fields } = input;
    return saveBusinessCase(ctx, { epicId: epicId as EpicId, fields });
  },
  revalidate: "epic",
  mapError: (e) => (e.kind === "not_found" ? "Epic not found" : "Failed to save business case"),
});
