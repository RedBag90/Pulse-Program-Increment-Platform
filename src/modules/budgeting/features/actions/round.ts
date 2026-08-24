"use server";

import { z } from "zod";
import { createServerAction } from "@/server/http/server-action";
import { fields } from "@/server/http/form-data";
import { formatDomainError } from "@/server/http/domain-error-display";
import {
  createRound,
  updateRoundFrame,
} from "@/modules/budgeting/server/services/round-service";
import { transitionRoundThenProtocol } from "@/modules/budgeting/server/services/budget-plan-revision";
import {
  addGroup,
  updateGroup,
  removeGroup,
  addGroupMember,
  removeGroupMember,
  setMemberRead,
} from "@/modules/budgeting/server/services/round-group-service";
import { setGroupAllocation } from "@/modules/budgeting/server/services/group-allocation-service";
import { recordDecision, setReportOut } from "@/modules/budgeting/server/services/decision-service";
import type { RoundStatus } from "@/modules/budgeting/domain/round-status";

const MANAGE = "budget.round.manage" as const;
const DECIDE = "budget.round.decide" as const;
const tenantResource = (_i: unknown, p: { tenantId: string }) => ({ tenantId: p.tenantId });
const err = (e: Parameters<typeof formatDomainError>[0]) =>
  formatDomainError(e, { notFound: "Nicht gefunden", fallback: "Aktion fehlgeschlagen" });

export const createRoundAction = createServerAction({
  schema: z.object({ cycleKey: z.string().min(1), poolTotal: z.number().nonnegative() }),
  action: MANAGE,
  resource: tenantResource,
  parseFormData: (fd) => {
    const f = fields(fd);
    return { cycleKey: f.string("cycleKey"), poolTotal: Number(f.nonEmptyString("poolTotal") ?? "0") };
  },
  service: (ctx, i) =>
    createRound(ctx, { cycleKey: i.cycleKey, poolTotal: i.poolTotal, decisionAuthorityIds: [] }),
  revalidate: "budgetRound",
  mapError: err,
});

export const updateRoundFrameAction = createServerAction({
  schema: z.object({
    id: z.string().uuid(),
    poolTotal: z.number().nonnegative().optional(),
    plannedAt: z.string().optional(),
    decisionAuthorityIds: z.array(z.string().uuid()).optional(),
  }),
  action: MANAGE,
  resource: tenantResource,
  parseFormData: (fd) => {
    const f = fields(fd);
    const pool = f.nonEmptyString("poolTotal");
    const planned = f.nonEmptyString("plannedAt");
    const authority = f.nonEmptyString("decisionAuthorityIds");
    return {
      id: f.string("id"),
      ...(pool !== undefined ? { poolTotal: Number(pool) } : {}),
      ...(planned !== undefined ? { plannedAt: planned } : {}),
      ...(authority !== undefined
        ? { decisionAuthorityIds: authority.split(",").map((s) => s.trim()).filter(Boolean) }
        : {}),
    };
  },
  service: (ctx, i) =>
    updateRoundFrame(ctx, {
      id: i.id,
      ...(i.poolTotal !== undefined ? { poolTotal: i.poolTotal } : {}),
      ...(i.plannedAt !== undefined ? { plannedAt: new Date(i.plannedAt) } : {}),
      ...(i.decisionAuthorityIds !== undefined
        ? { decisionAuthorityIds: i.decisionAuthorityIds }
        : {}),
    }),
  revalidate: "budgetRound",
  mapError: err,
});

export const transitionRoundAction = createServerAction({
  schema: z.object({ id: z.string().uuid(), to: z.enum(["running", "decided", "closed"]) }),
  action: MANAGE,
  resource: tenantResource,
  parseFormData: (fd) => {
    const f = fields(fd);
    return { id: f.string("id"), to: f.string("to") as RoundStatus };
  },
  service: (ctx, i) => transitionRoundThenProtocol(ctx, { id: i.id, to: i.to }),
  revalidate: "budgetRound",
  mapError: err,
});

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

export const setMemberReadAction = createServerAction({
  schema: z.object({ id: z.string().uuid(), hasRead: z.boolean() }),
  action: MANAGE,
  resource: tenantResource,
  parseFormData: (fd) => {
    const f = fields(fd);
    return { id: f.string("id"), hasRead: fd.get("hasRead") != null };
  },
  service: (ctx, i) => setMemberRead(ctx, { id: i.id, hasRead: i.hasRead }),
  revalidate: "budgetRound",
  mapError: err,
});

export const setGroupAllocationAction = createServerAction({
  schema: z.object({
    roundId: z.string().uuid(),
    groupId: z.string().uuid(),
    epicId: z.string().uuid(),
    funded: z.boolean(),
  }),
  action: MANAGE,
  resource: tenantResource,
  parseFormData: (fd) => {
    const f = fields(fd);
    return {
      roundId: f.string("roundId"),
      groupId: f.string("groupId"),
      epicId: f.string("epicId"),
      funded: f.string("funded") === "true",
    };
  },
  service: (ctx, i) =>
    setGroupAllocation(ctx, { roundId: i.roundId, groupId: i.groupId, epicId: i.epicId, funded: i.funded }),
  revalidate: "budgetRound",
  mapError: err,
});

export const recordDecisionAction = createServerAction({
  schema: z.object({
    roundId: z.string().uuid(),
    epicId: z.string().uuid(),
    outcome: z.enum(["funded", "rejected", "deferred_with_review"]),
    justification: z.string().max(10_000).optional(),
    deferredCheckTask: z.string().max(2000).optional(),
  }),
  action: DECIDE,
  resource: tenantResource,
  parseFormData: (fd) => {
    const f = fields(fd);
    return {
      roundId: f.string("roundId"),
      epicId: f.string("epicId"),
      outcome: f.string("outcome") as "funded" | "rejected" | "deferred_with_review",
      justification: String(fd.get("justification") ?? ""),
      deferredCheckTask: String(fd.get("deferredCheckTask") ?? ""),
    };
  },
  service: (ctx, i) =>
    recordDecision(ctx, {
      roundId: i.roundId,
      epicId: i.epicId,
      outcome: i.outcome,
      justification: i.justification || null,
      deferredCheckTask: i.deferredCheckTask || null,
    }),
  revalidate: "budgetRound",
  mapError: err,
});

export const setReportOutAction = createServerAction({
  schema: z.object({
    groupId: z.string().uuid(),
    costliestYesEpicId: z.string().optional(),
    clearestNoEpicId: z.string().optional(),
    biggestDisputeEpicId: z.string().optional(),
    costliestYesReason: z.string().optional(),
    clearestNoReason: z.string().optional(),
    disputeReason: z.string().optional(),
  }),
  action: MANAGE,
  resource: tenantResource,
  parseFormData: (fd) => {
    const f = fields(fd);
    const opt = (k: string) => f.nonEmptyString(k) ?? "";
    return {
      groupId: f.string("groupId"),
      costliestYesEpicId: opt("costliestYesEpicId"),
      clearestNoEpicId: opt("clearestNoEpicId"),
      biggestDisputeEpicId: opt("biggestDisputeEpicId"),
      costliestYesReason: String(fd.get("costliestYesReason") ?? ""),
      clearestNoReason: String(fd.get("clearestNoReason") ?? ""),
      disputeReason: String(fd.get("disputeReason") ?? ""),
    };
  },
  service: (ctx, i) =>
    setReportOut(ctx, {
      groupId: i.groupId,
      costliestYesEpicId: i.costliestYesEpicId || null,
      clearestNoEpicId: i.clearestNoEpicId || null,
      biggestDisputeEpicId: i.biggestDisputeEpicId || null,
      costliestYesReason: i.costliestYesReason || null,
      clearestNoReason: i.clearestNoReason || null,
      disputeReason: i.disputeReason || null,
    }),
  revalidate: "budgetRound",
  mapError: err,
});
