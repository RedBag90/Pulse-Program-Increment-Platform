"use server";

import { z } from "zod";
import {
  clearArtGraphLayout,
  saveArtGraphLayout,
} from "@/modules/drumbeat/server/services/art-graph-layout";
import { createServerAction } from "@/server/http/server-action";
import { formatDomainError } from "@/server/http/domain-error-display";
import type { ArtId, InitiativeId } from "@/modules/core/kernel/domain/types";

/**
 * Schreibt gezogene Netzplan-Positionen einer ART fort.
 *
 * Recht: **`feature.update`**, ART-bezogen — dasselbe Recht, das auch den
 * PI-Wechsel trägt. Ein Layout ist eine Aussage über die Features dieser ART;
 * wer sie umplanen darf, darf sie auch anordnen. (Das Schwestermodul im
 * Breakdown nimmt `epic.update`, aus demselben Grund eine Ebene höher.)
 */
export const saveArtGraphLayoutAction = createServerAction({
  schema: z.object({
    artId: z.string().uuid(),
    positions: z
      .array(
        z.object({
          initiativeId: z.string().uuid(),
          x: z.number().finite(),
          y: z.number().finite(),
        }),
      )
      .min(1)
      .max(500),
  }),
  // `positions` ist ein Array von Objekten — FormData trägt das nicht nativ.
  parseFormData: (fd) => {
    const raw = String(fd.get("positions") ?? "[]");
    let positions: unknown = [];
    try {
      positions = JSON.parse(raw);
    } catch {
      positions = [];
    }
    return { artId: String(fd.get("artId") ?? ""), positions };
  },
  action: "feature.update",
  resource: (input, p) => ({ tenantId: p.tenantId, artId: input.artId }),
  service: (ctx, input) =>
    saveArtGraphLayout(ctx, {
      artId: input.artId as ArtId,
      positions: input.positions.map((pos) => ({
        initiativeId: pos.initiativeId as InitiativeId,
        x: pos.x,
        y: pos.y,
      })),
    }),
  revalidate: "feature",
  mapError: (e, t) => formatDomainError(e, { fallbackKey: "errors.action.saveLayout" }, t),
});

/** „Neu anordnen" — verwirft die Handarbeit, damit die Rechnung wieder greift. */
export const clearArtGraphLayoutAction = createServerAction({
  schema: z.object({ artId: z.string().uuid() }),
  parseFormData: (fd) => ({ artId: String(fd.get("artId") ?? "") }),
  action: "feature.update",
  resource: (input, p) => ({ tenantId: p.tenantId, artId: input.artId }),
  service: (ctx, input) => clearArtGraphLayout(ctx, { artId: input.artId as ArtId }),
  revalidate: "feature",
  mapError: (e, t) => formatDomainError(e, { fallbackKey: "errors.action.saveLayout" }, t),
});
