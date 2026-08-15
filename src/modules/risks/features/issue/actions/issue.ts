"use server";

import { z } from "zod";
import { createServerAction } from "@/server/http/server-action";
import { formatDomainError } from "@/server/http/domain-error-display";
import {
  suggestIssue,
  documentIssue,
  reviewIssue,
  updateIssue,
  assignIssueOwner,
  setIssueRoam,
  addIssueMitigation,
  removeIssueMitigation,
  reassessIssue,
  reparentIssue,
  linkIssueToInitiative,
  deleteIssue,
} from "@/modules/risks/server/services/issue";
import { setIssuePrefix } from "@/modules/risks/server/services/issue-settings";
import { RISK_LEVELS } from "@/modules/risks/domain/risk-matrix";
import { RISK_CATEGORIES } from "@/modules/risks/domain/risk-category";
import { ROAM_STATUSES } from "@/modules/core/kernel/domain/roam";

/**
 * Unified Issue server actions (single issue type, risk model). Reuse the
 * `risk.*` RBAC + `risk` revalidation route-set.
 */

const level = z.enum(RISK_LEVELS as unknown as [string, ...string[]]);
const category = z.enum(RISK_CATEGORIES as unknown as [string, ...string[]]);
const roam = z.enum(ROAM_STATUSES as unknown as [string, ...string[]]);

const emptyToUndef = (s: string | undefined) => (s == null || s === "" ? undefined : s);

// ── create: risk (suggest / document) ─────────────────────────────────────────
const createRiskShape = {
  title: z.string().min(1, "Titel erforderlich").max(300),
  description: z.string().max(5000).optional(),
  probability: level.optional(),
  impact: level.optional(),
  category: category.optional(),
  targetResolutionDate: z.string().optional(),
  ownerId: z.string().uuid().optional(),
  initiativeId: z.string().uuid().optional(),
};

function createRiskService(
  fn: typeof suggestIssue,
): (
  ctx: Parameters<typeof suggestIssue>[0],
  input: z.infer<z.ZodObject<typeof createRiskShape>>,
) => ReturnType<typeof suggestIssue> {
  return (ctx, input) =>
    fn(ctx, {
      title: input.title,
      description: emptyToUndef(input.description),
      probability: emptyToUndef(input.probability),
      impact: emptyToUndef(input.impact),
      category: emptyToUndef(input.category),
      targetResolutionDate: emptyToUndef(input.targetResolutionDate) ?? null,
      ownerId: emptyToUndef(input.ownerId) ?? null,
      initiativeId: emptyToUndef(input.initiativeId) ?? null,
    });
}

export const suggestIssueAction = createServerAction({
  describeCreated: (v: { id: string }) => ({ id: v.id, label: "Risiko" }),
  schema: z.object(createRiskShape),
  action: "risk.suggest",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: createRiskService(suggestIssue),
  revalidate: "risk",
  mapError: (e) => formatDomainError(e, { fallback: "Vorschlag fehlgeschlagen" }),
});

export const documentIssueAction = createServerAction({
  describeCreated: (v: { id: string }) => ({ id: v.id, label: "Risiko" }),
  schema: z.object(createRiskShape),
  action: "risk.document",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: createRiskService(documentIssue),
  revalidate: "risk",
  mapError: (e) => formatDomainError(e, { fallback: "Dokumentation fehlgeschlagen" }),
});

// ── reparent (bundle under a head-issue) ───────────────────────────────────────
export const reparentIssueAction = createServerAction({
  schema: z.object({ id: z.string().uuid(), newParentId: z.string().uuid().nullable().optional() }),
  action: "risk.update",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: (ctx, input) => reparentIssue(ctx, { id: input.id, newParentId: input.newParentId ?? null }),
  revalidate: "risk",
  mapError: (e) => formatDomainError(e, { fallback: "Umhängen fehlgeschlagen" }),
});

// ── review (risk suggestions) ──────────────────────────────────────────────────
export const reviewIssueAction = createServerAction({
  schema: z.object({ id: z.string().uuid(), decision: z.enum(["accept", "reject"]) }),
  action: "risk.review",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: (ctx, input) => reviewIssue(ctx, { id: input.id, decision: input.decision }),
  revalidate: "risk",
  mapError: (e) => formatDomainError(e, { fallback: "Review fehlgeschlagen" }),
});

// ── edit / owner / roam / mitigation / reassess ────────────────────────────────
export const updateIssueAction = createServerAction({
  schema: z.object({
    id: z.string().uuid(),
    title: z.string().min(1).max(300).optional(),
    description: z.string().max(5000).optional(),
    probability: level.optional(),
    impact: level.optional(),
    category: category.optional(),
    targetResolutionDate: z.string().optional(),
  }),
  action: "risk.update",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: (ctx, input) =>
    updateIssue(ctx, {
      id: input.id,
      title: emptyToUndef(input.title),
      description: input.description,
      probability: emptyToUndef(input.probability),
      impact: emptyToUndef(input.impact),
      category: emptyToUndef(input.category),
      targetResolutionDate: input.targetResolutionDate,
    }),
  revalidate: "risk",
  mapError: (e) => formatDomainError(e, { fallback: "Aktualisierung fehlgeschlagen" }),
});

export const assignIssueOwnerAction = createServerAction({
  schema: z.object({ id: z.string().uuid(), ownerId: z.string().optional() }),
  action: "risk.update",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: (ctx, input) =>
    assignIssueOwner(ctx, { id: input.id, ownerId: emptyToUndef(input.ownerId) ?? null }),
  revalidate: "risk",
  mapError: (e) => formatDomainError(e, { fallback: "Owner-Zuweisung fehlgeschlagen" }),
});

export const setIssueRoamAction = createServerAction({
  schema: z.object({
    id: z.string().uuid(),
    roamStatus: roam,
    roamRationale: z.string().max(5000).optional(),
  }),
  action: "risk.roam",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: (ctx, input) =>
    setIssueRoam(ctx, {
      id: input.id,
      roamStatus: input.roamStatus,
      roamRationale: input.roamRationale,
    }),
  revalidate: "risk",
  mapError: (e) => formatDomainError(e, { fallback: "ROAM fehlgeschlagen" }),
});

/** Bulk ROAM — drives the unified register's bulk action bar (cap 50). */
export const setIssueRoamBatchAction = createServerAction({
  schema: z.object({
    issueIds: z.array(z.string().uuid()).min(1).max(50),
    roamStatus: roam,
  }),
  action: "risk.roam",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  batch: {
    iterateOver: "issueIds",
    service: (ctx, id, rest) => setIssueRoam(ctx, { id, roamStatus: rest.roamStatus }),
  },
  revalidate: "risk",
  mapError: (e) => formatDomainError(e, { fallback: "ROAM-Bulk fehlgeschlagen" }),
});

export const addIssueMitigationAction = createServerAction({
  describeCreated: (v: { id: string }) => ({ id: v.id, label: "Maßnahme" }),
  schema: z.object({ issueId: z.string().uuid(), description: z.string().min(1).max(5000) }),
  action: "risk.update",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: (ctx, input) =>
    addIssueMitigation(ctx, { issueId: input.issueId, description: input.description }),
  revalidate: "risk",
  mapError: (e) => formatDomainError(e, { fallback: "Maßnahme fehlgeschlagen" }),
});

export const removeIssueMitigationAction = createServerAction({
  schema: z.object({ id: z.string().uuid() }),
  action: "risk.update",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: (ctx, input) => removeIssueMitigation(ctx, { id: input.id }),
  revalidate: "risk",
  mapError: (e) => formatDomainError(e, { fallback: "Entfernen fehlgeschlagen" }),
});

export const reassessIssueAction = createServerAction({
  describeCreated: (v: { id: string }) => ({ id: v.id, label: "Neubewertung" }),
  schema: z.object({
    id: z.string().uuid(),
    probability: level,
    impact: level,
    note: z.string().max(5000).optional(),
  }),
  action: "risk.update",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: (ctx, input) =>
    reassessIssue(ctx, {
      id: input.id,
      probability: input.probability,
      impact: input.impact,
      note: emptyToUndef(input.note),
    }),
  revalidate: "risk",
  mapError: (e) => formatDomainError(e, { fallback: "Neubewertung fehlgeschlagen" }),
});

// ── delivery lifecycle (impediment kind) ───────────────────────────────────────
// ── link to work item / delete / settings ──────────────────────────────────────
export const linkIssueToInitiativeAction = createServerAction({
  schema: z.object({ id: z.string().uuid(), initiativeId: z.string().uuid().nullable() }),
  action: "risk.link",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: (ctx, input) =>
    linkIssueToInitiative(ctx, { id: input.id, initiativeId: input.initiativeId }),
  revalidate: "risk",
  mapError: (e) => formatDomainError(e, { fallback: "Verknüpfung fehlgeschlagen" }),
});

export const deleteIssueAction = createServerAction({
  schema: z.object({ id: z.string().uuid() }),
  action: "risk.delete",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: (ctx, input) => deleteIssue(ctx, { id: input.id }),
  revalidate: "risk",
  mapError: (e) => formatDomainError(e, { fallback: "Löschen fehlgeschlagen" }),
});

export const setIssuePrefixAction = createServerAction({
  schema: z.object({ prefix: z.string().min(1).max(8) }),
  action: "risk.settings.manage",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: (ctx, input) => setIssuePrefix(ctx, { prefix: input.prefix }),
  revalidate: "risk",
  mapError: (e) => formatDomainError(e, { fallback: "Präfix-Änderung fehlgeschlagen" }),
});
