"use server";

import { z } from "zod";
import {
  createFeature,
  updateFeature,
  scoreFeature,
  setFeaturePi,
  softDeleteFeature,
  setFeatureDeliveryStatus,
  startFeature,
  type FeatureDeliveryStatus,
} from "@/server/services/feature";
import { submitForReview, decideReview } from "@/server/services/initiative-review";
import { createServerAction } from "@/server/http/server-action";
import { fields } from "@/server/http/form-data";
import { formatDomainError } from "@/server/http/domain-error-display";
import { fibonacci } from "@/domain/schemas/initiative";
import type { EpicId, ArtId, FeatureId, PiId } from "@/domain/types";

export interface FeatureActionState {
  error?: string;
  success?: boolean;
}

/**
 * Refine-Predikat für `decideFeatureReviewBatchAction`: bei Approval ohne
 * Klärungs-Intent ist ein Kommentar optional; sonst (reject ODER
 * clarification) ist er erforderlich. Lebt am Modul-Scope, weil das
 * Next.js 15.3 "use server"-Linting top-level Arrow-Functions als
 * Server-Action interpretiert und dann `async` erzwingt.
 */
function batchDecisionHasComment(d: {
  decision: "approve" | "reject";
  intent?: "decision" | "clarification" | undefined;
  comment?: string | undefined;
}): boolean {
  if (d.decision === "approve" && d.intent !== "clarification") return true;
  return (d.comment?.trim().length ?? 0) > 0;
}

export const createFeatureAction = createServerAction({
  describeCreated: (v: { id: string }) => ({
    id: v.id,
    label: "Feature",
    href: `/feature/${v.id}`,
  }),
  schema: z.object({
    artId: z.string().uuid(),
    parentId: z.string().uuid(),
    title: z.string().min(1).max(200),
    description: z.string().max(10_000).optional(),
    wsjfBusinessValue: z.coerce.number().pipe(fibonacci),
    wsjfTimeCriticality: z.coerce.number().pipe(fibonacci),
    wsjfRiskReduction: z.coerce.number().pipe(fibonacci),
    wsjfJobSize: z.coerce.number().pipe(fibonacci),
    acceptanceCriteria: z.string().optional(),
    // SAFe Guardrails. Leerer String = explizit „ungesetzt".
    featureType: z.enum(["feature", "enabler", ""]).optional(),
  }),
  action: "feature.create",
  resource: (input, p) => ({ tenantId: p.tenantId, artId: input.artId }),
  service: (ctx, input) => {
    const acceptanceCriteria = input.acceptanceCriteria
      ? input.acceptanceCriteria
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
    return createFeature(ctx, {
      parentId: input.parentId as EpicId,
      artId: input.artId as ArtId,
      title: input.title,
      description: input.description,
      wsjfBusinessValue: input.wsjfBusinessValue,
      wsjfTimeCriticality: input.wsjfTimeCriticality,
      wsjfRiskReduction: input.wsjfRiskReduction,
      wsjfJobSize: input.wsjfJobSize,
      acceptanceCriteria,
      ...(input.featureType !== undefined && {
        featureType: input.featureType === "" ? null : input.featureType,
      }),
    });
  },
  revalidate: "feature",
  mapError: (e) =>
    e.kind === "not_found" ? `${e.resourceType} not found` : "Failed to create feature",
});

export const updateFeatureAction = createServerAction({
  schema: z.object({
    id: z.string().uuid(),
    artId: z.string().uuid(),
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(10_000).optional(),
    acceptanceCriteria: z.string().optional(),
    wsjfBusinessValue: z.coerce.number().pipe(fibonacci).optional(),
    wsjfTimeCriticality: z.coerce.number().pipe(fibonacci).optional(),
    wsjfRiskReduction: z.coerce.number().pipe(fibonacci).optional(),
    wsjfJobSize: z.coerce.number().pipe(fibonacci).optional(),
    // SAFe Guardrails (Roadmap-G2). Leerer String = clearen.
    featureType: z.enum(["feature", "enabler", ""]).optional(),
  }),
  action: "feature.update",
  resource: (input, p) => ({ tenantId: p.tenantId, artId: input.artId }),
  service: (ctx, input) => {
    const acceptanceCriteria =
      input.acceptanceCriteria !== undefined
        ? input.acceptanceCriteria
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined;
    return updateFeature(ctx, {
      id: input.id as FeatureId,
      title: input.title,
      description: input.description,
      acceptanceCriteria,
      wsjfBusinessValue: input.wsjfBusinessValue,
      wsjfTimeCriticality: input.wsjfTimeCriticality,
      wsjfRiskReduction: input.wsjfRiskReduction,
      wsjfJobSize: input.wsjfJobSize,
      ...(input.featureType !== undefined && {
        featureType: input.featureType === "" ? null : input.featureType,
      }),
    });
  },
  revalidate: "feature",
  mapError: (e) =>
    formatDomainError(e, { notFound: "Feature not found", fallback: "Failed to update feature" }),
});

export const scoreFeatureAction = createServerAction({
  schema: z.object({
    featureId: z.string().uuid(),
    artId: z.string().uuid(),
    wsjfBusinessValue: z.coerce.number().pipe(fibonacci),
    wsjfTimeCriticality: z.coerce.number().pipe(fibonacci),
    wsjfRiskReduction: z.coerce.number().pipe(fibonacci),
    wsjfJobSize: z.coerce.number().pipe(fibonacci),
  }),
  action: "feature.wsjf.set",
  resource: (input, p) => ({ tenantId: p.tenantId, artId: input.artId }),
  service: (ctx, input) =>
    scoreFeature(ctx, {
      id: input.featureId as FeatureId,
      wsjfBusinessValue: input.wsjfBusinessValue,
      wsjfTimeCriticality: input.wsjfTimeCriticality,
      wsjfRiskReduction: input.wsjfRiskReduction,
      wsjfJobSize: input.wsjfJobSize,
    }),
  revalidate: "feature",
  mapError: (e) => formatDomainError(e, { fallback: "Failed to update WSJF score" }),
});

export const deleteFeatureAction = createServerAction({
  schema: z.object({ id: z.string().uuid(), artId: z.string().uuid() }),
  action: "feature.delete",
  resource: (input, p) => ({ tenantId: p.tenantId, artId: input.artId }),
  service: (ctx, input) => softDeleteFeature(ctx, { id: input.id as FeatureId }),
  revalidate: "feature",
  mapError: (e) =>
    formatDomainError(e, { notFound: "Feature not found", fallback: "Failed to delete feature" }),
});

export const submitFeatureReviewAction = createServerAction({
  schema: z.object({ id: z.string().uuid() }),
  action: "feature.review.submit",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  parseFormData: (fd) => ({ id: fields(fd).string("id") }),
  service: (ctx, input) => submitForReview(ctx, { kind: "feature", id: input.id as FeatureId }),
  revalidate: "feature",
  mapError: (e) =>
    e.kind === "conflict"
      ? e.reason
      : e.kind === "not_found"
        ? "Feature not found"
        : "Failed to submit feature for review",
});

export const decideFeatureReviewAction = createServerAction({
  schema: z.object({
    id: z.string().uuid(),
    decision: z.enum(["approve", "reject"]),
    comment: z.string().max(2000).optional(),
    intent: z.enum(["decision", "clarification"]).optional(),
  }),
  action: "feature.review.decide",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: (ctx, input) =>
    decideReview(ctx, {
      kind: "feature",
      id: input.id as FeatureId,
      decision: input.decision,
      comment: input.comment,
      intent: input.intent,
    }),
  revalidate: "feature",
  mapError: (e) =>
    e.kind === "conflict"
      ? e.reason
      : e.kind === "not_found"
        ? "Feature not found"
        : "Failed to record review decision",
});

/**
 * Bulk QS-Entscheidung — drives the `/my-approvals` Feature-QS bulk bar.
 * Round 3 batch mode (cap 50) over the same per-item `decideReview` service
 * used by the single-item action. Tenant-scoped because `feature.review.decide`
 * is RTE/Admin-only and not ART-narrowed. A `reject` (or `clarification`
 * intent) requires a shared `comment`; `approve` may go without.
 */
export const decideFeatureReviewBatchAction = createServerAction({
  schema: z
    .object({
      featureIds: z.array(z.string().uuid()).min(1).max(50),
      decision: z.enum(["approve", "reject"]),
      comment: z.string().max(2000).optional(),
      intent: z.enum(["decision", "clarification"]).optional(),
    })
    .refine(batchDecisionHasComment, { message: "Begründung erforderlich", path: ["comment"] }),
  action: "feature.review.decide",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  batch: {
    iterateOver: "featureIds",
    service: (ctx, id, rest) =>
      decideReview(ctx, {
        kind: "feature",
        id: id as FeatureId,
        decision: rest.decision,
        comment: rest.comment,
        intent: rest.intent,
      }),
  },
  revalidate: "feature",
  mapError: (e) =>
    e.kind === "conflict"
      ? e.reason
      : e.kind === "not_found"
        ? "Feature not found"
        : "QS-Entscheidung fehlgeschlagen",
});

const DELIVERY_STATUS = z.enum(["approved", "in_progress", "blocked", "completed", "cancelled"]);

/**
 * Starts an approved Feature — the most common delivery transition. Picks up
 * `approved → in_progress` only; the service enforces "Feature in PI" and
 * "Epic in L4/L5" so the start has operational meaning.
 */
export const startFeatureAction = createServerAction({
  schema: z.object({ id: z.string().uuid() }),
  action: "feature.delivery.set",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  parseFormData: (fd) => ({ id: fields(fd).string("id") }),
  service: (ctx, input) => startFeature(ctx, { id: input.id as FeatureId }),
  revalidate: "feature",
  mapError: (e) =>
    e.kind === "conflict"
      ? e.reason
      : e.kind === "not_found"
        ? "Feature nicht gefunden"
        : "Feature konnte nicht gestartet werden",
});

/**
 * Generic delivery transition (pause, resume, complete, cancel). `reason` is
 * required for pause/cancel by the client UI; the server treats it as optional
 * (anyone calling directly may omit it).
 */
export const setFeatureDeliveryStatusAction = createServerAction({
  schema: z.object({
    id: z.string().uuid(),
    to: DELIVERY_STATUS,
    reason: z.string().max(2000).optional(),
  }),
  action: "feature.delivery.set",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: (ctx, input) =>
    setFeatureDeliveryStatus(ctx, {
      id: input.id as FeatureId,
      to: input.to as FeatureDeliveryStatus,
      reason: input.reason,
    }),
  revalidate: "feature",
  mapError: (e) =>
    e.kind === "conflict"
      ? e.reason
      : e.kind === "not_found"
        ? "Feature nicht gefunden"
        : "Status konnte nicht geändert werden",
});

/**
 * Assign one or more features to a PI, or move them back to the backlog
 * (piId = ""). Serves the PI-overview picker, the planning board (single-id
 * batches), and the feature-backlog inline dropdown. Uses the factory's
 * batch mode — early-fail on the first conflict, fold per-item `warnings`.
 */
export const setFeaturePiAction = createServerAction({
  schema: z.object({
    featureIds: z.array(z.string().uuid()).min(1),
    /** Empty string → backlog (null). FormData can't carry literal null. */
    piId: z.string(),
    artId: z.string().uuid(),
  }),
  action: "feature.update",
  resource: (input, p) => ({ tenantId: p.tenantId, artId: input.artId }),
  batch: {
    iterateOver: "featureIds",
    service: (ctx, featureId, rest) =>
      setFeaturePi(ctx, {
        featureId: featureId as FeatureId,
        piId: rest.piId === "" ? null : (rest.piId as PiId),
      }),
    foldWarnings: (out) => out.warnings,
  },
  revalidate: "feature",
  mapError: (e) =>
    formatDomainError(e, {
      notFound: "Feature or PI not found",
      fallback: "Failed to assign feature",
    }),
});
