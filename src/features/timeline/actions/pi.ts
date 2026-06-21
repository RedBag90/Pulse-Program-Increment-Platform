"use server";

import { z } from "zod";
import { createPi, updatePi, deletePi } from "@/server/services/pi";
import { createServerAction } from "@/server/http/server-action";
import { fields } from "@/server/http/form-data";
import type { PiId, TimelineId } from "@/domain/types";

/**
 * PI-Mutationen aus der Timeline-Page heraus. Audience: LPM/Admin via
 * `timeline.manage` (statt der RTE-scoped `pi.create/update/delete`-
 * Capabilities, die im Cockpit-Kontext greifen). Damit liegt die Timeline-
 * Surface in einer Hand.
 */

const isoDateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Datum muss im Format YYYY-MM-DD sein");

export const createPiOnTimelineAction = createServerAction({
  describeCreated: (v: { id: string }) => ({ id: v.id, label: "PI" }),
  schema: z.object({
    timelineId: z.string().uuid(),
    name: z.string().min(1).max(100),
    startDate: isoDateString,
    endDate: isoDateString,
  }),
  action: "timeline.manage",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  parseFormData: (fd) => {
    const f = fields(fd);
    return {
      timelineId: f.string("timelineId"),
      name: f.string("name"),
      startDate: f.string("startDate"),
      endDate: f.string("endDate"),
    };
  },
  service: (ctx, input) =>
    createPi(ctx, {
      timelineId: input.timelineId as TimelineId,
      name: input.name,
      startDate: new Date(input.startDate),
      endDate: new Date(input.endDate),
    }),
  revalidate: "pi",
  mapError: (e) =>
    e.kind === "conflict"
      ? e.reason
      : e.kind === "not_found"
        ? "Timeline nicht gefunden"
        : "PI konnte nicht angelegt werden",
});

export const updatePiOnTimelineAction = createServerAction({
  schema: z.object({
    id: z.string().uuid(),
    name: z.string().min(1).max(100).optional(),
    startDate: isoDateString.optional(),
    endDate: isoDateString.optional(),
  }),
  action: "timeline.manage",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  parseFormData: (fd) => {
    const f = fields(fd);
    const name = f.nonEmptyString("name");
    const start = f.nonEmptyString("startDate");
    const end = f.nonEmptyString("endDate");
    return {
      id: f.string("id"),
      ...(name !== undefined ? { name } : {}),
      ...(start !== undefined ? { startDate: start } : {}),
      ...(end !== undefined ? { endDate: end } : {}),
    };
  },
  service: (ctx, input) =>
    updatePi(ctx, {
      id: input.id as PiId,
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.startDate !== undefined ? { startDate: new Date(input.startDate) } : {}),
      ...(input.endDate !== undefined ? { endDate: new Date(input.endDate) } : {}),
    }),
  revalidate: "pi",
  mapError: (e) =>
    e.kind === "conflict"
      ? e.reason
      : e.kind === "not_found"
        ? "PI nicht gefunden"
        : "PI konnte nicht aktualisiert werden",
});

export const deletePiOnTimelineAction = createServerAction({
  schema: z.object({ id: z.string().uuid() }),
  action: "timeline.manage",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: (ctx, input) => deletePi(ctx, { id: input.id as PiId }),
  revalidate: "pi",
  mapError: (e) =>
    e.kind === "conflict"
      ? e.reason
      : e.kind === "not_found"
        ? "PI nicht gefunden"
        : "PI konnte nicht geloescht werden",
});
