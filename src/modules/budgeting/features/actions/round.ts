"use server";

import { z } from "zod";
import { createServerAction } from "@/server/http/server-action";
import { fields } from "@/server/http/form-data";
import { formatDomainError } from "@/server/http/domain-error-display";
import {
  addGroup,
  updateGroup,
  removeGroup,
  addGroupMember,
  removeGroupMember,
} from "@/modules/budgeting/server/services/round-group-service";

const MANAGE = "budget.round.manage" as const;
const tenantResource = (_i: unknown, p: { tenantId: string }) => ({ tenantId: p.tenantId });
const err = (e: Parameters<typeof formatDomainError>[0]) =>
  formatDomainError(e, { notFound: "Nicht gefunden", fallback: "Aktion fehlgeschlagen" });

export const addGroupAction = createServerAction({
  schema: z.object({ roundId: z.string().uuid(), name: z.string().min(1).max(100) }),
  action: MANAGE,
  resource: tenantResource,
  service: (ctx, i) => addGroup(ctx, { roundId: i.roundId, name: i.name }),
  revalidate: "budgetRound",
  mapError: err,
});

export const updateGroupAction = createServerAction({
  schema: z.object({
    id: z.string().uuid(),
    name: z.string().min(1).max(100).optional(),
    spokespersonId: z.string().uuid().nullable().optional(),
  }),
  action: MANAGE,
  resource: tenantResource,
  parseFormData: (fd) => {
    const f = fields(fd);
    const name = f.nonEmptyString("name");
    const sp = f.nonEmptyString("spokespersonId");
    return {
      id: f.string("id"),
      ...(name !== undefined ? { name } : {}),
      ...(sp !== undefined ? { spokespersonId: sp } : { spokespersonId: null }),
    };
  },
  service: (ctx, i) =>
    updateGroup(ctx, {
      id: i.id,
      ...(i.name !== undefined ? { name: i.name } : {}),
      ...(i.spokespersonId !== undefined ? { spokespersonId: i.spokespersonId } : {}),
    }),
  revalidate: "budgetRound",
  mapError: err,
});

export const removeGroupAction = createServerAction({
  schema: z.object({ id: z.string().uuid() }),
  action: MANAGE,
  resource: tenantResource,
  service: (ctx, i) => removeGroup(ctx, { id: i.id }),
  revalidate: "budgetRound",
  mapError: err,
});

export const addGroupMemberAction = createServerAction({
  schema: z.object({
    groupId: z.string().uuid(),
    userId: z.string().uuid(),
    team: z.string().optional(),
    isSubmitter: z.boolean().optional(),
  }),
  action: MANAGE,
  resource: tenantResource,
  parseFormData: (fd) => {
    const f = fields(fd);
    return {
      groupId: f.string("groupId"),
      userId: f.string("userId"),
      team: f.nonEmptyString("team") ?? "",
      isSubmitter: fd.get("isSubmitter") != null,
    };
  },
  service: (ctx, i) =>
    addGroupMember(ctx, {
      groupId: i.groupId,
      userId: i.userId,
      team: i.team || null,
      isSubmitter: i.isSubmitter ?? false,
    }),
  revalidate: "budgetRound",
  mapError: err,
});

export const removeGroupMemberAction = createServerAction({
  schema: z.object({ id: z.string().uuid() }),
  action: MANAGE,
  resource: tenantResource,
  service: (ctx, i) => removeGroupMember(ctx, { id: i.id }),
  revalidate: "budgetRound",
  mapError: err,
});
