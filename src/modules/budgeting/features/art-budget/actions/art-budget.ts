"use server";

import { z } from "zod";
import { createServerAction } from "@/server/http/server-action";
import { saveArtBudget } from "@/server/services/art-budget";

const periodMap = z.record(z.string(), z.number().nonnegative());

/** Reads a JSON `payload` form field. */
function payload(fd: FormData): unknown {
  const raw = fd.get("payload");
  return typeof raw === "string" ? JSON.parse(raw) : {};
}

/** Finance distributes a Value Stream's budget to one ART, per half-year. */
export const saveArtBudgetAction = createServerAction({
  schema: z.object({ artId: z.string().uuid(), byPeriod: periodMap }),
  action: "art_budget.manage",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  parseFormData: payload,
  service: (ctx, input) => saveArtBudget(ctx, { artId: input.artId, byPeriod: input.byPeriod }),
  revalidate: "valueStream",
  mapError: (e) =>
    e.kind === "forbidden" ? e.reason : "ART-Budget konnte nicht gespeichert werden",
});
