"use server";

import { z } from "zod";
import { createServerAction } from "@/server/http/server-action";
import { fields } from "@/server/http/form-data";
import { formatDomainError } from "@/server/http/domain-error-display";
import { addParticipant, removeParticipant } from "@/modules/budgeting/server/services/participant-service";
import { addEpicCandidate, removeCandidate } from "@/modules/budgeting/server/services/candidate-service";
import { updateRoundFrame, startPeriod } from "@/modules/budgeting/server/services/round-service";

const MANAGE = "budget.round.manage" as const;
const tenantResource = (_i: unknown, p: { tenantId: string }) => ({ tenantId: p.tenantId });
const err = (e: Parameters<typeof formatDomainError>[0]) =>
  formatDomainError(e, { notFound: "Nicht gefunden", fallback: "Aktion fehlgeschlagen" });

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const updatePeriodFrameAction = createServerAction({
  schema: z.object({
    id: z.string().uuid(),
    poolTotal: z.number().nonnegative(),
    submissionDeadline: isoDate.nullable(),
  }),
  action: MANAGE,
  resource: tenantResource,
  parseFormData: (fd) => {
    const f = fields(fd);
    const deadline = f.nonEmptyString("submissionDeadline");
    return {
      id: f.string("id"),
      poolTotal: Number(f.string("poolTotal")),
      submissionDeadline: deadline ?? null,
    };
  },
  service: (ctx, i) =>
    updateRoundFrame(ctx, {
      id: i.id,
      poolTotal: i.poolTotal,
      submissionDeadline: i.submissionDeadline
        ? new Date(`${i.submissionDeadline}T00:00:00.000Z`)
        : null,
    }),
  revalidate: "budgetPeriod",
  mapError: err,
});

export const addParticipantAction = createServerAction({
  schema: z.object({ roundId: z.string().uuid(), userId: z.string().uuid() }),
  action: MANAGE,
  resource: tenantResource,
  parseFormData: (fd) => {
    const f = fields(fd);
    return { roundId: f.string("roundId"), userId: f.string("userId") };
  },
  service: (ctx, i) => addParticipant(ctx, { roundId: i.roundId, userId: i.userId }),
  revalidate: "budgetPeriod",
  mapError: err,
});

export const removeParticipantAction = createServerAction({
  schema: z.object({ id: z.string().uuid() }),
  action: MANAGE,
  resource: tenantResource,
  parseFormData: (fd) => ({ id: fields(fd).string("id") }),
  service: (ctx, i) => removeParticipant(ctx, { id: i.id }),
  revalidate: "budgetPeriod",
  mapError: err,
});

export const addEpicCandidateAction = createServerAction({
  schema: z.object({ roundId: z.string().uuid(), epicId: z.string().uuid() }),
  action: MANAGE,
  resource: tenantResource,
  parseFormData: (fd) => {
    const f = fields(fd);
    return { roundId: f.string("roundId"), epicId: f.string("epicId") };
  },
  service: (ctx, i) => addEpicCandidate(ctx, { roundId: i.roundId, epicId: i.epicId }),
  revalidate: "budgetPeriod",
  mapError: err,
});

export const removeCandidateAction = createServerAction({
  schema: z.object({ id: z.string().uuid() }),
  action: MANAGE,
  resource: tenantResource,
  parseFormData: (fd) => ({ id: fields(fd).string("id") }),
  service: (ctx, i) => removeCandidate(ctx, { id: i.id }),
  revalidate: "budgetPeriod",
  mapError: err,
});

export const startPeriodAction = createServerAction({
  schema: z.object({ id: z.string().uuid() }),
  action: MANAGE,
  resource: tenantResource,
  parseFormData: (fd) => ({ id: fields(fd).string("id") }),
  service: (ctx, i) => startPeriod(ctx, { id: i.id }),
  revalidate: "budgetPeriod",
  mapError: err,
});
