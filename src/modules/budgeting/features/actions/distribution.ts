"use server";

import { z } from "zod";
import { createServerAction } from "@/server/http/server-action";
import { fields } from "@/server/http/form-data";
import { formatDomainError } from "@/server/http/domain-error-display";
import {
  setGroupAmount,
  submitGroupDistribution,
} from "@/modules/budgeting/server/services/group-distribution-service";

const CONTRIBUTE = "budget.group.contribute" as const;
const tenantResource = (_i: unknown, p: { tenantId: string }) => ({ tenantId: p.tenantId });
const err = (e: Parameters<typeof formatDomainError>[0]) =>
  formatDomainError(e, { notFound: "Nicht gefunden", fallback: "Verteilung fehlgeschlagen" });

export const setGroupAmountAction = createServerAction({
  schema: z.object({
    groupId: z.string().uuid(),
    candidateId: z.string().uuid(),
    amount: z.number().nonnegative(),
  }),
  action: CONTRIBUTE,
  resource: tenantResource,
  parseFormData: (fd) => {
    const f = fields(fd);
    return {
      groupId: f.string("groupId"),
      candidateId: f.string("candidateId"),
      amount: Number(f.string("amount")),
    };
  },
  service: (ctx, i) =>
    setGroupAmount(ctx, { groupId: i.groupId, candidateId: i.candidateId, amount: i.amount }),
  revalidate: "budgetPeriod",
  mapError: err,
});

export const submitGroupDistributionAction = createServerAction({
  schema: z.object({ groupId: z.string().uuid() }),
  action: CONTRIBUTE,
  resource: tenantResource,
  parseFormData: (fd) => ({ groupId: fields(fd).string("groupId") }),
  service: (ctx, i) => submitGroupDistribution(ctx, { groupId: i.groupId }),
  revalidate: "budgetPeriod",
  mapError: err,
});
