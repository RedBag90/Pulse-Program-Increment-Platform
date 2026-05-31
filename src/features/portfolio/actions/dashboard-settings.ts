"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServerAction } from "@/server/http/server-action";
import { savePortfolioDashboardSettings } from "@/server/services/portfolio-dashboard";

/**
 * Saves the configurable Portfolio Dashboard settings — two tenant-wide
 * economic constants:
 *  • `costNeutralTarget` — self-funding threshold per month (€).
 *  • `costPerJobSizePoint` — €/WSJF-Job-Size point, drives the PI-Planning
 *    capacity overlay's €-axis. Leaving it empty hides that axis.
 */
export const savePortfolioDashboardSettingsAction = createServerAction({
  schema: z.object({
    costNeutralTarget: z.number().nonnegative().nullable(),
    costPerJobSizePoint: z.number().nonnegative().nullable(),
  }),
  action: "target.manage",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  parseFormData: (fd) => {
    const targetStr = String(fd.get("costNeutralTarget") ?? "").trim();
    const cpjStr = String(fd.get("costPerJobSizePoint") ?? "").trim();
    return {
      costNeutralTarget: targetStr === "" ? null : Number(targetStr),
      costPerJobSizePoint: cpjStr === "" ? null : Number(cpjStr),
    };
  },
  service: (ctx, input) => savePortfolioDashboardSettings(ctx, input),
  onSuccess: () => {
    revalidatePath("/portfolio/dashboard", "page");
    revalidatePath("/pi-planning", "page");
  },
  mapError: () => "Einstellungen konnten nicht gespeichert werden",
});
