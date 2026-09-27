"use server";

import { z } from "zod";
import {
  applyPiFeedback,
  requestPiFeedback,
  submitPiFeedback,
} from "@/modules/drumbeat/server/services/pi-feedback";
import { createServerAction } from "@/server/http/server-action";
import { formatDomainError } from "@/server/http/domain-error-display";

/**
 * **PI-Feedback** — anfragen, antworten, übernehmen.
 *
 * Anfragen und Übernehmen sind ART-scoped wie jede PI-Pflege. Antworten
 * (`pi.feedback.submit`) steht allen Rollen offen; maßgeblich ist, dass der
 * Service die Person in der Runde findet.
 * Die Eingaben kommen als JSON-Feld `payload`, weil Personen- und
 * Wertelisten in FormData unhandlich sind.
 */

const payload = (fd: FormData): unknown => JSON.parse(String(fd.get("payload") ?? "{}"));

const bv = z.number().int().positive();

export const requestPiFeedbackAction = createServerAction({
  schema: z.object({
    piId: z.string().uuid(),
    artId: z.string().uuid(),
    reviewerIds: z.array(z.string().uuid()).min(1),
    dueDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable(),
  }),
  action: "pi.feedback.request",
  resource: (input, p) => ({ tenantId: p.tenantId, artId: input.artId }),
  parseFormData: payload,
  service: (ctx, input) =>
    requestPiFeedback(ctx, {
      piId: input.piId,
      artId: input.artId,
      reviewerIds: input.reviewerIds,
      dueDate: input.dueDate ? new Date(`${input.dueDate}T00:00:00Z`) : null,
    }),
  revalidate: "piFeedback",
  mapError: (e, t) => formatDomainError(e, { fallbackKey: "drumbeat.feedback.errors.anfragen" }, t),
});

export const submitPiFeedbackAction = createServerAction({
  schema: z.object({
    requestId: z.string().uuid(),
    answers: z
      .array(
        z.object({
          featureId: z.string().uuid(),
          businessValue: bv,
          comment: z.string().max(2000).nullable(),
        }),
      )
      .min(1),
  }),
  action: "pi.feedback.submit",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  parseFormData: payload,
  service: (ctx, input) => submitPiFeedback(ctx, input),
  revalidate: "piFeedback",
  mapError: (e, t) =>
    formatDomainError(e, { fallbackKey: "drumbeat.feedback.errors.abschicken" }, t),
});

export const applyPiFeedbackAction = createServerAction({
  schema: z.object({
    requestId: z.string().uuid(),
    artId: z.string().uuid(),
    values: z.array(z.object({ featureId: z.string().uuid(), businessValue: bv })).min(1),
  }),
  action: "pi.feedback.apply",
  resource: (input, p) => ({ tenantId: p.tenantId, artId: input.artId }),
  parseFormData: payload,
  service: (ctx, input) => applyPiFeedback(ctx, input),
  revalidate: "piFeedback",
  mapError: (e, t) =>
    formatDomainError(e, { fallbackKey: "drumbeat.feedback.errors.uebernehmen" }, t),
});
