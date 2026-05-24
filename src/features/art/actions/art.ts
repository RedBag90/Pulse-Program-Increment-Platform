"use server";

import { z } from "zod";
import { createArt, updateArt, softDeleteArt } from "@/server/services/art";
import { createServerAction } from "@/server/http/server-action";
import { fields } from "@/server/http/form-data";
import type { ValueStreamId, ArtId } from "@/domain/types";

export interface ArtActionState {
  error?: string;
  success?: boolean;
}

export const createArtAction = createServerAction({
  describeCreated: (v: { id: string }) => ({ id: v.id, label: "ART", href: `/art/${v.id}` }),
  schema: z.object({
    valueStreamId: z.string().uuid(),
    name: z.string().min(1).max(100),
    piCadenceWeeks: z.coerce.number().int().min(8).max(12).optional(),
  }),
  action: "art.create",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  parseFormData: (fd) => {
    const f = fields(fd);
    return {
      valueStreamId: f.string("valueStreamId"),
      name: f.string("name"),
      piCadenceWeeks: f.nonEmptyString("piCadenceWeeks"),
    };
  },
  service: (ctx, input) =>
    createArt(ctx, {
      valueStreamId: input.valueStreamId as ValueStreamId,
      name: input.name,
      piCadenceWeeks: input.piCadenceWeeks,
    }),
  revalidate: "art",
  mapError: (e) => (e.kind === "conflict" ? e.reason : "Failed to create ART"),
});

export const updateArtAction = createServerAction({
  schema: z.object({
    id: z.string().uuid(),
    name: z.string().min(1).max(100).optional(),
    description: z.string().optional(),
    piCadenceWeeks: z.coerce.number().int().min(8).max(12).optional(),
    rteId: z.string().uuid().nullable().optional(),
  }),
  action: "art.update",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  parseFormData: (fd) => {
    const f = fields(fd);
    return {
      id: f.string("id"),
      name: f.nonEmptyString("name"),
      description: f.nonEmptyString("description"),
      piCadenceWeeks: f.nonEmptyString("piCadenceWeeks"),
      // nullableString: absent (partial cadence-only form) → undefined (don't
      // touch); empty → null (clear); else the value.
      rteId: f.nullableString("rteId"),
    };
  },
  service: (ctx, input) =>
    updateArt(ctx, {
      id: input.id as ArtId,
      name: input.name,
      description: input.description,
      piCadenceWeeks: input.piCadenceWeeks,
      rteId: input.rteId,
    }),
  revalidate: "art",
  mapError: (e) =>
    e.kind === "conflict"
      ? e.reason
      : e.kind === "not_found"
        ? "ART not found"
        : "Failed to update ART",
});

export const deleteArtAction = createServerAction({
  schema: z.object({ id: z.string().uuid() }),
  action: "art.delete",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  parseFormData: (fd) => ({ id: fields(fd).string("id") }),
  service: (ctx, input) => softDeleteArt(ctx, { id: input.id as ArtId }),
  revalidate: "art",
  mapError: (e) =>
    e.kind === "conflict"
      ? e.reason
      : e.kind === "not_found"
        ? "ART not found"
        : "Failed to delete ART",
});
