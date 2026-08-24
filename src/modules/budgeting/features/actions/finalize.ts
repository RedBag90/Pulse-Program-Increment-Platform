"use server";

import { z } from "zod";
import { createServerAction } from "@/server/http/server-action";
import { fields } from "@/server/http/form-data";
import { formatDomainError } from "@/server/http/domain-error-display";
import {
  closeDistribution,
  finalizePeriod,
  startNextPeriod,
} from "@/modules/budgeting/server/services/finalize-service";

const MANAGE = "budget.manage" as const;
const tenantResource = (_i: unknown, p: { tenantId: string }) => ({ tenantId: p.tenantId });
const err = (e: Parameters<typeof formatDomainError>[0]) =>
  formatDomainError(e, { notFound: "Nicht gefunden", fallback: "Aktion fehlgeschlagen" });

export const closeDistributionAction = createServerAction({
  schema: z.object({ id: z.string().uuid() }),
  action: MANAGE,
  resource: tenantResource,
  parseFormData: (fd) => ({ id: fields(fd).string("id") }),
  service: (ctx, i) => closeDistribution(ctx, { id: i.id }),
  revalidate: "budgetPeriod",
  mapError: err,
});

const finalSchema = z.object({
  id: z.string().uuid(),
  finals: z.array(z.object({ candidateId: z.string().uuid(), amount: z.number().nonnegative() })),
});

export const finalizePeriodAction = createServerAction({
  schema: finalSchema,
  action: MANAGE,
  resource: tenantResource,
  parseFormData: (fd) => {
    const f = fields(fd);
    const raw = String(fd.get("finals") ?? "[]");
    let finals: { candidateId: string; amount: number }[] = [];
    try {
      finals = JSON.parse(raw);
    } catch {
      finals = [];
    }
    return { id: f.string("id"), finals };
  },
  service: (ctx, i) => finalizePeriod(ctx, { id: i.id, finals: i.finals }),
  revalidate: "budgetPeriod",
  mapError: err,
});

export const startNextPeriodAction = createServerAction({
  schema: z.object({ fromRoundId: z.string().uuid() }),
  action: MANAGE,
  resource: tenantResource,
  parseFormData: (fd) => ({ fromRoundId: fields(fd).string("fromRoundId") }),
  service: (ctx, i) => startNextPeriod(ctx, { fromRoundId: i.fromRoundId }),
  revalidate: "budgetPeriod",
  mapError: err,
});
