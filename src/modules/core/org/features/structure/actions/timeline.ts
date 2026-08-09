"use server";

import { z } from "zod";
import {
  createTimeline,
  createTimelineFromStandard,
  deleteTimeline,
  joinArtToTimeline,
  leaveArtFromTimeline,
  updateTimeline,
} from "@/modules/core/org/server/services/timeline";
import { createServerAction } from "@/server/http/server-action";
import { fields } from "@/server/http/form-data";
import { formatDomainError } from "@/server/http/domain-error-display";
import type { ArtId, TimelineId } from "@/modules/core/kernel/domain/types";

export const createTimelineAction = createServerAction({
  schema: z.object({
    name: z.string().min(1).max(100),
  }),
  action: "timeline.manage",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: (ctx, input) => createTimeline(ctx, input),
  revalidate: "timeline",
  mapError: (e) => formatDomainError(e, { fallback: "Timeline konnte nicht angelegt werden" }),
});

export const updateTimelineAction = createServerAction({
  schema: z.object({
    id: z.string().uuid(),
    name: z.string().min(1).max(100).optional(),
  }),
  action: "timeline.manage",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  parseFormData: (fd) => {
    const f = fields(fd);
    const name = f.nonEmptyString("name");
    return {
      id: f.string("id"),
      ...(name !== undefined ? { name } : {}),
    };
  },
  service: (ctx, input) =>
    updateTimeline(ctx, {
      id: input.id as TimelineId,
      ...(input.name !== undefined ? { name: input.name } : {}),
    }),
  revalidate: "timeline",
  mapError: (e) =>
    e.kind === "conflict"
      ? e.reason
      : e.kind === "not_found"
        ? "Timeline nicht gefunden"
        : "Timeline konnte nicht aktualisiert werden",
});

export const createTimelineFromStandardAction = createServerAction({
  schema: z.object({ standardId: z.string().uuid() }),
  action: "timeline.manage",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  parseFormData: (fd) => ({ standardId: fields(fd).string("standardId") }),
  service: (ctx, input) => createTimelineFromStandard(ctx, { standardId: input.standardId }),
  revalidate: "timeline",
  mapError: (e) =>
    e.kind === "conflict"
      ? e.reason
      : e.kind === "not_found"
        ? "PI-Standard nicht gefunden"
        : "Timeline aus Standard konnte nicht angelegt werden",
});

export const deleteTimelineAction = createServerAction({
  schema: z.object({ id: z.string().uuid() }),
  action: "timeline.manage",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  parseFormData: (fd) => ({ id: fields(fd).string("id") }),
  service: (ctx, input) => deleteTimeline(ctx, { id: input.id as TimelineId }),
  revalidate: "timeline",
  mapError: (e) =>
    e.kind === "conflict"
      ? e.reason
      : e.kind === "not_found"
        ? "Timeline nicht gefunden"
        : "Timeline konnte nicht gelöscht werden",
});

export const joinArtToTimelineAction = createServerAction({
  schema: z.object({ artId: z.string().uuid(), timelineId: z.string().uuid() }),
  action: "timeline.manage",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: (ctx, input) =>
    joinArtToTimeline(ctx, {
      artId: input.artId as ArtId,
      timelineId: input.timelineId as TimelineId,
    }),
  revalidate: "timeline",
  mapError: (e) =>
    e.kind === "conflict"
      ? e.reason
      : e.kind === "not_found"
        ? "ART oder Timeline nicht gefunden"
        : "ART konnte nicht beitreten",
});

export const leaveArtFromTimelineAction = createServerAction({
  schema: z.object({ artId: z.string().uuid() }),
  action: "timeline.manage",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  parseFormData: (fd) => ({ artId: fields(fd).string("artId") }),
  service: (ctx, input) => leaveArtFromTimeline(ctx, { artId: input.artId as ArtId }),
  revalidate: "timeline",
  mapError: (e) =>
    e.kind === "not_found" ? "ART nicht gefunden" : "ART konnte Timeline nicht verlassen",
});
