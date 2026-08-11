"use server";

import { z } from "zod";
import { createServerAction } from "@/server/http/server-action";
import { dismissZieleSetup } from "@/modules/core/goals/server/services/ziele-setup";

/**
 * Dismiss the Ziele first-run setup guide (tenant-wide). Gated on `target.manage`
 * — the same capability that reveals the guide. Revalidates `/ziele`.
 */
export const dismissZieleSetupAction = createServerAction({
  schema: z.object({}),
  action: "target.manage",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  parseFormData: () => ({}),
  service: (ctx) => dismissZieleSetup(ctx),
  revalidate: "ziele",
  mapError: () => "Anleitung konnte nicht ausgeblendet werden",
});
