"use server";

import { z } from "zod";
import { saveBreakdownLayout } from "@/server/services/breakdown-layout";
import { createServerAction } from "@/server/http/server-action";
import { formatDomainError } from "@/server/http/domain-error-display";
import type { EpicId, InitiativeId } from "@/domain/types";

/**
 * Persistiert eine Liste von Netzplan-Node-Positionen fuer ein Epic
 * (Roadmap-P5). Wird vom `BreakdownNetworkView`-Client per
 * debounced-onNodeDragStop gerufen. Capability `epic.update` —
 * Speichern eines Layouts wird wie ein Stammdaten-Edit behandelt.
 */
export const saveBreakdownLayoutAction = createServerAction({
  schema: z.object({
    epicId: z.string().uuid(),
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
  // `positions` ist ein Array von Objekten — FormData traegt das nicht
  // nativ. Wir packen es als JSON-String in das Feld `positions` und
  // entpacken hier.
  parseFormData: (fd) => {
    const raw = String(fd.get("positions") ?? "[]");
    let positions: unknown = [];
    try {
      positions = JSON.parse(raw);
    } catch {
      positions = [];
    }
    return {
      epicId: String(fd.get("epicId") ?? ""),
      positions,
    };
  },
  action: "epic.update",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: (ctx, input) =>
    saveBreakdownLayout(ctx, {
      epicId: input.epicId as EpicId,
      positions: input.positions.map((p) => ({
        initiativeId: p.initiativeId as InitiativeId,
        x: p.x,
        y: p.y,
      })),
    }),
  revalidate: "epic",
  mapError: (e) => formatDomainError(e, { fallback: "Layout konnte nicht gespeichert werden" }),
});
