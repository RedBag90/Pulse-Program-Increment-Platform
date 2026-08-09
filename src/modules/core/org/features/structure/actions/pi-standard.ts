"use server";

import { z } from "zod";
import { createPiStandard, deletePiStandard, applyPiStandard } from "@/server/services/pi-standard";
import { createServerAction } from "@/server/http/server-action";
import { fields } from "@/server/http/form-data";
import type { TimelineId } from "@/modules/core/kernel/domain/types";
import { formatDomainError } from "@/server/http/domain-error-display";

export interface PiStandardActionState {
  error?: string;
  success?: boolean;
}

export const createPiStandardAction = createServerAction({
  schema: z.object({
    name: z.string().min(1).max(100),
    anchorMonth: z.coerce.number().int().min(1).max(12),
    anchorDay: z.coerce.number().int().min(1).max(31),
    cadenceWeeks: z.coerce.number().int().min(1).max(26),
    piCount: z.coerce.number().int().min(1).max(12),
  }),
  action: "pi_standard.manage",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: (ctx, input) => createPiStandard(ctx, input),
  revalidate: "piStandard",
  mapError: (e) => formatDomainError(e, { fallback: "Failed to create PI standard" }),
});

export const deletePiStandardAction = createServerAction({
  schema: z.object({ id: z.string().uuid() }),
  action: "pi_standard.manage",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  parseFormData: (fd) => ({ id: fields(fd).string("id") }),
  service: (ctx, input) => deletePiStandard(ctx, { id: input.id }),
  revalidate: "piStandard",
  mapError: (e) =>
    e.kind === "not_found" ? "PI standard not found" : "Failed to delete PI standard",
});

export const addStandardPisAction = createServerAction({
  schema: z.object({ timelineId: z.string().uuid(), standardId: z.string().uuid() }),
  action: "pi.create",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: (ctx, input) =>
    applyPiStandard(ctx, {
      timelineId: input.timelineId as TimelineId,
      standardId: input.standardId,
      year: new Date().getUTCFullYear(),
    }),
  revalidate: "pi",
  mapError: (e) =>
    e.kind === "conflict"
      ? e.reason
      : e.kind === "not_found"
        ? "Timeline or PI standard not found"
        : "Failed to add standard PIs",
});
