"use server";

import { z } from "zod";
import { createServerAction } from "@/server/http/server-action";
import { fields } from "@/server/http/form-data";
import { toggleSetupCheck } from "@/server/services/setup-progress";

export const toggleSetupCheckAction = createServerAction({
  schema: z.object({ checkId: z.string().min(1).max(64) }),
  action: "tenant.users.manage",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  parseFormData: (fd) => ({ checkId: fields(fd).string("checkId") }),
  service: (ctx, input) => toggleSetupCheck(ctx, input),
  revalidate: "setup",
  mapError: (e) =>
    e.kind === "forbidden" ? e.reason : "Setup-Fortschritt konnte nicht gespeichert werden",
});
