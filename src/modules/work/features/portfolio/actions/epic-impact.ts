"use server";

import { z } from "zod";
import { createServerAction } from "@/server/http/server-action";
import { formatDomainError } from "@/server/http/domain-error-display";
import { confirmEpicImpact } from "@/modules/work/server/services/epic";
import type { EpicId } from "@/modules/core/kernel/domain/types";

/**
 * Confirm-Epic-Impact: Controlling-Hand. Schiebt das Epic von L4 auf L5
 * („Impact realisiert"). Vorbedingungen werden im Service erzwungen
 * (Epic auf L4, alle Features completed, kein Doppel-Stempel).
 */
export const confirmEpicImpactAction = createServerAction({
  schema: z.object({
    epicId: z.string().uuid(),
    comment: z.string().max(2000).optional(),
  }),
  action: "epic.impact.confirm",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: (ctx, input) =>
    confirmEpicImpact(ctx, {
      epicId: input.epicId as EpicId,
      comment: input.comment,
    }),
  revalidate: "epic",
  mapError: (e) =>
    formatDomainError(e, {
      notFound: "Epic nicht gefunden",
      fallback: "Impact-Bestätigung fehlgeschlagen",
    }),
});
