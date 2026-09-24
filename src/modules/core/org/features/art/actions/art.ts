"use server";

import { z } from "zod";
import { updateArt, softDeleteArt } from "@/modules/core/org/server/services/art";
import { createArtOnTimeline } from "@/modules/core/org/server/services/art-setup";
import { createServerAction } from "@/server/http/server-action";
import { fields } from "@/server/http/form-data";
import type { ValueStreamId, ArtId } from "@/modules/core/kernel/domain/types";
import { formatDomainError } from "@/server/http/domain-error-display";

export interface ArtActionState {
  error?: string;
  success?: boolean;
}

export const createArtAction = createServerAction({
  describeCreated: (v: { id: string }) => ({
    id: v.id,
    label: "ART",
    href: `/structure/art/${v.id}`,
  }),
  schema: z.object({
    valueStreamId: z.string().uuid(),
    name: z.string().min(1).max(100),
  }),
  action: "art.create",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: (ctx, input) =>
    createArtOnTimeline(ctx, {
      valueStreamId: input.valueStreamId as ValueStreamId,
      name: input.name,
    }),
  revalidate: "artCreated",
  mapError: (e, t) => formatDomainError(e, { fallbackKey: "errors.action.createArt" }, t),
});

export const updateArtAction = createServerAction({
  schema: z.object({
    id: z.string().uuid(),
    name: z.string().min(1).max(100).optional(),
    description: z.string().optional(),
    rteId: z.string().uuid().nullable().optional(),
    technicalLeadId: z.string().uuid().nullable().optional(),
  }),
  action: "art.update",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  parseFormData: (fd) => {
    const f = fields(fd);
    return {
      id: f.string("id"),
      name: f.nonEmptyString("name"),
      description: f.nonEmptyString("description"),
      // nullableString: absent (partial cadence-only form) → undefined (don't
      // touch); empty → null (clear); else the value.
      rteId: f.nullableString("rteId"),
      technicalLeadId: f.nullableString("technicalLeadId"),
    };
  },
  service: (ctx, input) =>
    updateArt(ctx, {
      id: input.id as ArtId,
      name: input.name,
      description: input.description,
      rteId: input.rteId,
      technicalLeadId: input.technicalLeadId,
    }),
  revalidate: "art",
  mapError: (e, t) => formatDomainError(e, { fallbackKey: "errors.action.updateArt" }, t),
});

export const deleteArtAction = createServerAction({
  schema: z.object({ id: z.string().uuid() }),
  action: "art.delete",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  parseFormData: (fd) => ({ id: fields(fd).string("id") }),
  service: (ctx, input) => softDeleteArt(ctx, { id: input.id as ArtId }),
  revalidate: "art",
  mapError: (e, t) => formatDomainError(e, { fallbackKey: "errors.action.deleteArt" }, t),
});
