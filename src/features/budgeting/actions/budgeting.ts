"use server";

import { z } from "zod";
import { createServerAction } from "@/server/http/server-action";
import { saveBudgetAllocation, saveBudgetPool } from "@/server/services/budgeting";
import type { EpicId } from "@/domain/types";

const periodMap = z.record(z.string(), z.number().nonnegative());

/** Reads a JSON `payload` form field. */
function payload(fd: FormData): unknown {
  const raw = fd.get("payload");
  return typeof raw === "string" ? JSON.parse(raw) : {};
}

/** Saves an Epic's budgeting allocation (priority, hypothesis budget, per-period grants). */
export const saveBudgetAllocationAction = createServerAction({
  schema: z.object({
    epicId: z.string().uuid(),
    priority: z.number().int(),
    hypothesisBudget: z.number().nonnegative().nullable(),
    allocations: periodMap,
  }),
  action: "budget.manage",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  parseFormData: payload,
  service: (ctx, input) =>
    saveBudgetAllocation(ctx, {
      epicId: input.epicId as EpicId,
      priority: input.priority,
      hypothesisBudget: input.hypothesisBudget,
      allocations: input.allocations,
    }),
  revalidate: "epic",
  mapError: () => "Zuteilung konnte nicht gespeichert werden",
});

/** Saves the total budget pool per half-year. */
export const saveBudgetPoolAction = createServerAction({
  schema: z.object({ byPeriod: periodMap }),
  action: "budget.manage",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  parseFormData: payload,
  service: (ctx, input) => saveBudgetPool(ctx, { byPeriod: input.byPeriod }),
  revalidate: "epic",
  mapError: () => "Budget-Topf konnte nicht gespeichert werden",
});
