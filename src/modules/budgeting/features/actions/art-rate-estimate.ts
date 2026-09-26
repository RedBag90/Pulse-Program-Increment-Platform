"use server";

import { z } from "zod";
import { createServerAction } from "@/server/http/server-action";
import { setArtJobSizeRateEstimate } from "@/modules/budgeting/server/services/art-rate-estimate";
import { formatDomainError } from "@/server/http/domain-error-display";
import { revalidateFor } from "@/server/http/revalidation";

/**
 * Setzt oder entfernt die Schätzung des €-Satzes je Job Size eines ARTs.
 * Leeres Feld = entfernen. Autorisiert im Dienst gegen ART **und** Wertstrom
 * (`art_budget.distribute`), wie die übrigen ART-Budget-Aktionen.
 */
export const setArtJobSizeRateEstimateAction = createServerAction({
  schema: z.object({
    artId: z.string().uuid(),
    estimate: z.number().min(0).nullable(),
  }),
  action: "art_budget.distribute",
  authorizedInService: true,
  resource: (_i, p: { tenantId: string }) => ({ tenantId: p.tenantId }),
  parseFormData: (fd) => {
    const roh = String(fd.get("estimate") ?? "")
      .trim()
      .replace(",", ".");
    return {
      artId: String(fd.get("artId") ?? ""),
      estimate: roh === "" ? null : Number(roh),
    };
  },
  service: (ctx, input) => setArtJobSizeRateEstimate(ctx, input),
  onSuccess: () => {
    revalidateFor("art");
  },
  mapError: (e, t) => formatDomainError(e, { fallbackKey: "errors.action.save" }, t),
});
