"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServerAction } from "@/server/http/server-action";
import { savePortfolioDashboardSettings } from "@/server/services/portfolio-dashboard";

/** Saves the configurable Portfolio Dashboard settings (cost-neutral target line). */
export const savePortfolioDashboardSettingsAction = createServerAction({
  schema: z.object({
    costNeutralTarget: z.number().nonnegative().nullable(),
  }),
  action: "target.manage",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  parseFormData: (fd) => {
    const target = fd.get("costNeutralTarget");
    const targetStr = target == null ? "" : String(target).trim();
    return {
      costNeutralTarget: targetStr === "" ? null : Number(targetStr),
    };
  },
  service: (ctx, input) => savePortfolioDashboardSettings(ctx, input),
  onSuccess: () => revalidatePath("/portfolio/dashboard", "page"),
  mapError: () => "Einstellungen konnten nicht gespeichert werden",
});
