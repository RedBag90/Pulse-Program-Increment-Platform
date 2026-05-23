"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import {
  submitHypothesis,
  decideHypothesis,
  configureApprovers,
  submitBusinessCase,
  reviseBusinessCase,
  decideApproval,
  signoffSection,
  startRevision,
} from "@/server/services/epic-approval";
import { createServerAction } from "@/server/http/server-action";
import { APPROVAL_PARTIES } from "@/domain/business-case";
import { APPROVAL_SECTIONS } from "@/domain/epic-approval";
import type { EpicId } from "@/domain/types";

const DECISION = z.enum(["approve", "reject"]);

/** Revalidates the Epic detail route after a workflow mutation. */
function revalidateEpic() {
  revalidatePath("/portfolio/epics/[id]", "page");
}

const mapWorkflowError = (e: { kind: string; reason?: string }) =>
  e.kind === "conflict"
    ? (e.reason ?? "Konflikt")
    : e.kind === "not_found"
      ? "Epic nicht gefunden"
      : "Aktion fehlgeschlagen";

export const submitEpicHypothesisAction = createServerAction({
  schema: z.object({ epicId: z.string().uuid() }),
  action: "epic.hypothesis.submit",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  parseFormData: (fd) => ({ epicId: fd.get("epicId") }),
  service: (ctx, input) => submitHypothesis(ctx, { epicId: input.epicId as EpicId }),
  onSuccess: revalidateEpic,
  mapError: mapWorkflowError,
});

export const decideEpicHypothesisAction = createServerAction({
  schema: z.object({ epicId: z.string().uuid(), decision: DECISION }),
  action: "epic.hypothesis.decide",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  parseFormData: (fd) => ({ epicId: fd.get("epicId"), decision: fd.get("decision") }),
  service: (ctx, input) =>
    decideHypothesis(ctx, { epicId: input.epicId as EpicId, decision: input.decision }),
  onSuccess: revalidateEpic,
  mapError: mapWorkflowError,
});

export const configureApproversAction = createServerAction({
  schema: z.object({
    epicId: z.string().uuid(),
    assignments: z.array(
      z.object({ party: z.enum(APPROVAL_PARTIES), userIds: z.array(z.string().uuid()) }),
    ),
    sections: z.array(z.object({ section: z.enum(APPROVAL_SECTIONS), userId: z.string().uuid() })),
  }),
  action: "epic.approval.configure",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  parseFormData: (fd) => ({
    epicId: fd.get("epicId"),
    assignments: JSON.parse((fd.get("assignments") as string | null) ?? "[]"),
    sections: JSON.parse((fd.get("sections") as string | null) ?? "[]"),
  }),
  service: (ctx, input) =>
    configureApprovers(ctx, {
      epicId: input.epicId as EpicId,
      assignments: input.assignments,
      sections: input.sections,
    }),
  onSuccess: revalidateEpic,
  mapError: mapWorkflowError,
});

export const submitEpicBusinessCaseAction = createServerAction({
  schema: z.object({ epicId: z.string().uuid() }),
  action: "epic.businesscase.submit",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  parseFormData: (fd) => ({ epicId: fd.get("epicId") }),
  service: (ctx, input) => submitBusinessCase(ctx, { epicId: input.epicId as EpicId }),
  onSuccess: revalidateEpic,
  mapError: mapWorkflowError,
});

export const reviseEpicBusinessCaseAction = createServerAction({
  schema: z.object({ epicId: z.string().uuid() }),
  action: "epic.businesscase.submit",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  parseFormData: (fd) => ({ epicId: fd.get("epicId") }),
  service: (ctx, input) => reviseBusinessCase(ctx, { epicId: input.epicId as EpicId }),
  onSuccess: revalidateEpic,
  mapError: mapWorkflowError,
});

export const decideEpicApprovalAction = createServerAction({
  schema: z.object({
    approvalId: z.string().uuid(),
    decision: DECISION,
    comment: z.string().max(2000).optional(),
  }),
  action: "epic.approval.decide",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  parseFormData: (fd) => ({
    approvalId: fd.get("approvalId"),
    decision: fd.get("decision"),
    comment: (fd.get("comment") as string | null) || undefined,
  }),
  service: (ctx, input) =>
    decideApproval(ctx, {
      approvalId: input.approvalId,
      decision: input.decision,
      comment: input.comment,
    }),
  onSuccess: revalidateEpic,
  mapError: mapWorkflowError,
});

export const signoffEpicSectionAction = createServerAction({
  schema: z.object({
    epicId: z.string().uuid(),
    section: z.enum(APPROVAL_SECTIONS),
    decision: DECISION,
    comment: z.string().max(2000).optional(),
  }),
  action: "epic.section.signoff",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  parseFormData: (fd) => ({
    epicId: fd.get("epicId"),
    section: fd.get("section"),
    decision: fd.get("decision"),
    comment: (fd.get("comment") as string | null) || undefined,
  }),
  service: (ctx, input) =>
    signoffSection(ctx, {
      epicId: input.epicId as EpicId,
      section: input.section,
      decision: input.decision,
      comment: input.comment,
    }),
  onSuccess: revalidateEpic,
  mapError: mapWorkflowError,
});

export const startEpicRevisionAction = createServerAction({
  schema: z.object({ epicId: z.string().uuid(), mode: z.enum(["full", "business_case"]) }),
  action: "epic.revision.start",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  parseFormData: (fd) => ({ epicId: fd.get("epicId"), mode: fd.get("mode") }),
  service: (ctx, input) => startRevision(ctx, { epicId: input.epicId as EpicId, mode: input.mode }),
  onSuccess: revalidateEpic,
  mapError: mapWorkflowError,
});
