"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServerAction } from "@/server/http/server-action";
import { savePortfolioDashboardSettings } from "@/server/services/portfolio-dashboard";

/** Saves the two configurable Portfolio Dashboard settings (target line + horizon). */
export const savePortfolioDashboardSettingsAction = createServerAction({
  schema: z.object({
    costNeutralTarget: z.number().nonnegative().nullable(),
    horizonEndIso: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable(),
  }),
  action: "target.manage",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  parseFormData: (fd) => {
    const target = fd.get("costNeutralTarget");
    const horizon = fd.get("horizonEndIso");
    const targetStr = target == null ? "" : String(target).trim();
    const horizonStr = horizon == null ? "" : String(horizon).trim();
    return {
      costNeutralTarget: targetStr === "" ? null : Number(targetStr),
      horizonEndIso: horizonStr === "" ? null : horizonStr,
    };
  },
  service: (ctx, input) => savePortfolioDashboardSettings(ctx, input),
  onSuccess: () => revalidatePath("/portfolio/dashboard", "page"),
  mapError: () => "Einstellungen konnten nicht gespeichert werden",
});
