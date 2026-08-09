"use server";

import { z } from "zod";
import { createServerAction } from "@/server/http/server-action";
import { formatDomainError } from "@/server/http/domain-error-display";
import {
  suggestRisk,
  documentRisk,
  reviewRisk,
  updateRisk,
  assignRiskOwner,
  addRiskMitigation,
  removeRiskMitigation,
  reassessRisk,
  setRiskRoam,
  deleteRisk,
} from "@/modules/risks/server/services/risk";
import { linkRiskToEpic, unlinkRiskFromEpic } from "@/modules/risks/server/services/risk-epic-link";
import { setRiskPrefix } from "@/modules/risks/server/services/risk-settings";
import { RISK_LEVELS } from "@/modules/risks/domain/risk-matrix";
import { RISK_CATEGORIES } from "@/modules/risks/domain/risk-category";
import { ROAM_STATUSES } from "@/modules/core/kernel/domain/roam";

const level = z.enum(RISK_LEVELS as unknown as [string, ...string[]]);
const category = z.enum(RISK_CATEGORIES as unknown as [string, ...string[]]);
const roam = z.enum(ROAM_STATUSES as unknown as [string, ...string[]]);

const emptyToUndef = (s: string | undefined) => (s == null || s === "" ? undefined : s);

const createShape = {
  title: z.string().min(1, "Titel erforderlich").max(300),
  description: z.string().max(5000).optional(),
  probability: level.optional(),
  impact: level.optional(),
  category: category.optional(),
  targetResolutionDate: z.string().optional(),
  ownerId: z.string().uuid().optional(),
  epicId: z.string().uuid().optional(),
};

function createService(
  fn: typeof suggestRisk,
): (
  ctx: Parameters<typeof suggestRisk>[0],
  input: z.infer<z.ZodObject<typeof createShape>>,
) => ReturnType<typeof suggestRisk> {
  return (ctx, input) =>
    fn(ctx, {
      title: input.title,
      description: emptyToUndef(input.description),
      probability: emptyToUndef(input.probability),
      impact: emptyToUndef(input.impact),
      category: emptyToUndef(input.category),
      targetResolutionDate: emptyToUndef(input.targetResolutionDate) ?? null,
      ownerId: emptyToUndef(input.ownerId) ?? null,
      epicIds: input.epicId ? [input.epicId] : [],
    });
}

export const suggestRiskAction = createServerAction({
  describeCreated: (v: { id: string }) => ({ id: v.id, label: "Risiko" }),
  schema: z.object(createShape),
  action: "risk.suggest",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: createService(suggestRisk),
  revalidate: "risk",
  mapError: (e) => formatDomainError(e, { fallback: "Vorschlag fehlgeschlagen" }),
});

export const documentRiskAction = createServerAction({
  describeCreated: (v: { id: string }) => ({ id: v.id, label: "Risiko" }),
  schema: z.object(createShape),
  action: "risk.document",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: createService(documentRisk),
  revalidate: "risk",
  mapError: (e) => formatDomainError(e, { fallback: "Dokumentation fehlgeschlagen" }),
});

export const reviewRiskAction = createServerAction({
  schema: z.object({ id: z.string().uuid(), decision: z.enum(["accept", "reject"]) }),
  action: "risk.review",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: (ctx, input) => reviewRisk(ctx, { id: input.id, decision: input.decision }),
  revalidate: "risk",
  mapError: (e) => formatDomainError(e, { fallback: "Review fehlgeschlagen" }),
});

export const updateRiskAction = createServerAction({
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
    updateRisk(ctx, {
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

export const assignRiskOwnerAction = createServerAction({
  schema: z.object({ id: z.string().uuid(), ownerId: z.string().optional() }),
  action: "risk.update",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: (ctx, input) =>
    assignRiskOwner(ctx, { id: input.id, ownerId: emptyToUndef(input.ownerId) ?? null }),
  revalidate: "risk",
  mapError: (e) => formatDomainError(e, { fallback: "Owner-Zuweisung fehlgeschlagen" }),
});

export const setRiskRoamAction = createServerAction({
  schema: z.object({
    id: z.string().uuid(),
    roamStatus: roam,
    roamRationale: z.string().max(5000).optional(),
  }),
  action: "risk.roam",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: (ctx, input) =>
    setRiskRoam(ctx, {
      id: input.id,
      roamStatus: input.roamStatus,
      roamRationale: input.roamRationale,
    }),
  revalidate: "risk",
  mapError: (e) => formatDomainError(e, { fallback: "ROAM fehlgeschlagen" }),
});

export const addRiskMitigationAction = createServerAction({
  describeCreated: (v: { id: string }) => ({ id: v.id, label: "Maßnahme" }),
  schema: z.object({ riskId: z.string().uuid(), description: z.string().min(1).max(5000) }),
  action: "risk.update",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: (ctx, input) =>
    addRiskMitigation(ctx, { riskId: input.riskId, description: input.description }),
  revalidate: "risk",
  mapError: (e) => formatDomainError(e, { fallback: "Maßnahme fehlgeschlagen" }),
});

export const removeRiskMitigationAction = createServerAction({
  schema: z.object({ id: z.string().uuid() }),
  action: "risk.update",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: (ctx, input) => removeRiskMitigation(ctx, { id: input.id }),
  revalidate: "risk",
  mapError: (e) => formatDomainError(e, { fallback: "Entfernen fehlgeschlagen" }),
});

export const reassessRiskAction = createServerAction({
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
    reassessRisk(ctx, {
      id: input.id,
      probability: input.probability,
      impact: input.impact,
      note: emptyToUndef(input.note),
    }),
  revalidate: "risk",
  mapError: (e) => formatDomainError(e, { fallback: "Neubewertung fehlgeschlagen" }),
});

export const deleteRiskAction = createServerAction({
  schema: z.object({ id: z.string().uuid() }),
  action: "risk.delete",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: (ctx, input) => deleteRisk(ctx, { id: input.id }),
  revalidate: "risk",
  mapError: (e) => formatDomainError(e, { fallback: "Löschen fehlgeschlagen" }),
});

export const linkRiskToEpicAction = createServerAction({
  describeCreated: (v: { id: string }) => ({ id: v.id, label: "Verknüpfung" }),
  schema: z.object({ riskId: z.string().uuid(), epicId: z.string().uuid() }),
  action: "risk.link",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: (ctx, input) => linkRiskToEpic(ctx, { riskId: input.riskId, epicId: input.epicId }),
  revalidate: "risk",
  mapError: (e) => formatDomainError(e, { fallback: "Verknüpfung fehlgeschlagen" }),
});

export const unlinkRiskFromEpicAction = createServerAction({
  schema: z.object({ riskId: z.string().uuid(), epicId: z.string().uuid() }),
  action: "risk.link",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: (ctx, input) => unlinkRiskFromEpic(ctx, { riskId: input.riskId, epicId: input.epicId }),
  revalidate: "risk",
  mapError: (e) => formatDomainError(e, { fallback: "Trennen fehlgeschlagen" }),
});

export const setRiskPrefixAction = createServerAction({
  schema: z.object({ prefix: z.string().min(1).max(8) }),
  action: "risk.settings.manage",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: (ctx, input) => setRiskPrefix(ctx, { prefix: input.prefix }),
  revalidate: "risk",
  mapError: (e) => formatDomainError(e, { fallback: "Präfix-Änderung fehlgeschlagen" }),
});
