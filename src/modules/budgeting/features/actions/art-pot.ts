"use server";

import { z } from "zod";
import { createServerAction } from "@/server/http/server-action";
import { setArtEpicAllocation } from "@/modules/budgeting/server/services/art-pot";
import { formatDomainError } from "@/server/http/domain-error-display";
import { revalidateFor } from "@/server/http/revalidation";

/**
 * Verteilt den Veränderungsrahmen eines ARTs auf eines seiner ART-Epics.
 *
 * Autorisiert wird im Service gegen den **Wertstrom** des ARTs (`rtb_item.manage`
 * samt Finance-Bypass) — verteilt wird der Rahmen *für* den ART, nicht von ihm.
 * Die Action prüft deshalb nur die grobe Modulzugehörigkeit vor.
 */
export const setArtEpicAllocationAction = createServerAction({
  schema: z.object({
    artId: z.string().uuid(),
    epicId: z.string().uuid(),
    cycleKey: z.string().regex(/^\d{4}-H[12]$/),
    amount: z.number().min(0),
    ask: z.number().min(0),
  }),
  action: "rtb_item.manage",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  parseFormData: (fd) => ({
    artId: String(fd.get("artId") ?? ""),
    epicId: String(fd.get("epicId") ?? ""),
    cycleKey: String(fd.get("cycleKey") ?? ""),
    amount: Number(String(fd.get("amount") ?? "0").trim() || "0"),
    ask: Number(String(fd.get("ask") ?? "0").trim() || "0"),
  }),
  service: (ctx, input) => setArtEpicAllocation(ctx, input),
  onSuccess: () => {
    // Die Zuteilung schreibt die Zyklus-Karte fort — dieselbe Ressource, die
    // auch die Finalisierung anfasst.
    revalidateFor("budgetAllocation");
    revalidateFor("art");
  },
  mapError: (e) => formatDomainError(e, { fallback: "Zuteilung konnte nicht gespeichert werden" }),
});
