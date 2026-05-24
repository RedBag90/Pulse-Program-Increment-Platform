"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  createFeature,
  updateFeature,
  scoreFeature,
  setFeaturePi,
  softDeleteFeature,
} from "@/server/services/feature";
import { submitForReview, decideReview } from "@/server/services/initiative-review";
import { createServerAction } from "@/server/http/server-action";
import { fields } from "@/server/http/form-data";
import { revalidateFor } from "@/server/http/revalidation";
import type { RequestContext } from "@/server/http/mutation-handler";
import { requirePrincipal } from "@/server/auth/principal";
import { authorize } from "@/server/auth/authorize";
import { createPrismaClient } from "@/server/db/prisma";
import { extractRequestMeta } from "@/server/audit/emit";
import { isErr } from "@/domain/errors";
import { fibonacci } from "@/domain/schemas/initiative";
import type { EpicId, ArtId, FeatureId, PiId } from "@/domain/types";

export interface FeatureActionState {
  error?: string;
  success?: boolean;
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
  }),
  action: "feature.create",
  resource: (input, p) => ({ tenantId: p.tenantId, artId: input.artId }),
  parseFormData: (fd) => {
    const f = fields(fd);
    return {
      artId: f.string("artId"),
      parentId: f.string("parentId"),
      title: f.string("title"),
      description: f.optionalString("description"),
      wsjfBusinessValue: f.string("wsjfBusinessValue"),
      wsjfTimeCriticality: f.string("wsjfTimeCriticality"),
      wsjfRiskReduction: f.string("wsjfRiskReduction"),
      wsjfJobSize: f.string("wsjfJobSize"),
      acceptanceCriteria: f.optionalString("acceptanceCriteria"),
    };
  },
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
  }),
  action: "feature.update",
  resource: (input, p) => ({ tenantId: p.tenantId, artId: input.artId }),
  parseFormData: (fd) => {
    const f = fields(fd);
    return {
      id: f.string("id"),
      artId: f.string("artId"),
      title: f.nonEmptyString("title"),
      description: f.optionalString("description"),
      acceptanceCriteria: f.optionalString("acceptanceCriteria"),
      wsjfBusinessValue: f.nonEmptyString("wsjfBusinessValue"),
      wsjfTimeCriticality: f.nonEmptyString("wsjfTimeCriticality"),
      wsjfRiskReduction: f.nonEmptyString("wsjfRiskReduction"),
      wsjfJobSize: f.nonEmptyString("wsjfJobSize"),
    };
  },
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
    });
  },
  revalidate: "feature",
  mapError: (e) => (e.kind === "not_found" ? "Feature not found" : "Failed to update feature"),
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
  parseFormData: (fd) => {
    const f = fields(fd);
    return {
      featureId: f.string("featureId"),
      artId: f.string("artId"),
      wsjfBusinessValue: f.string("wsjfBusinessValue"),
      wsjfTimeCriticality: f.string("wsjfTimeCriticality"),
      wsjfRiskReduction: f.string("wsjfRiskReduction"),
      wsjfJobSize: f.string("wsjfJobSize"),
    };
  },
  service: (ctx, input) =>
    scoreFeature(ctx, {
      id: input.featureId as FeatureId,
      wsjfBusinessValue: input.wsjfBusinessValue,
      wsjfTimeCriticality: input.wsjfTimeCriticality,
      wsjfRiskReduction: input.wsjfRiskReduction,
      wsjfJobSize: input.wsjfJobSize,
    }),
  revalidate: "feature",
  mapError: () => "Failed to update WSJF score",
});

export const deleteFeatureAction = createServerAction({
  schema: z.object({ id: z.string().uuid(), artId: z.string().uuid() }),
  action: "feature.delete",
  resource: (input, p) => ({ tenantId: p.tenantId, artId: input.artId }),
  parseFormData: (fd) => {
    const f = fields(fd);
    return { id: f.string("id"), artId: f.string("artId") };
  },
  service: (ctx, input) => softDeleteFeature(ctx, { id: input.id as FeatureId }),
  revalidate: "feature",
  mapError: (e) => (e.kind === "not_found" ? "Feature not found" : "Failed to delete feature"),
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
  schema: z.object({ id: z.string().uuid(), decision: z.enum(["approve", "reject"]) }),
  action: "feature.review.decide",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  parseFormData: (fd) => {
    const f = fields(fd);
    return { id: f.string("id"), decision: f.string("decision") };
  },
  service: (ctx, input) =>
    decideReview(ctx, { kind: "feature", id: input.id as FeatureId, decision: input.decision }),
  revalidate: "feature",
  mapError: (e) =>
    e.kind === "conflict"
      ? e.reason
      : e.kind === "not_found"
        ? "Feature not found"
        : "Failed to record review decision",
});

/**
 * Assign one or more features to a PI, or move them back to the backlog (piId = null).
 * Serves both the PI-overview picker and the feature-backlog inline dropdown.
 */
export async function setFeaturePiAction(
  featureIds: string[],
  piId: string | null,
  artId: string,
): Promise<{ error?: string }> {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  if (!authorize("feature.update", { tenantId: principal.tenantId, artId }, principal).allow) {
    return { error: "Insufficient permissions" };
  }

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const { ipAddress, userAgent } = extractRequestMeta(await headers());
  const ctx: RequestContext = {
    principal,
    db,
    ...(ipAddress !== undefined && { ipAddress }),
    ...(userAgent !== undefined && { userAgent }),
  };

  for (const featureId of featureIds) {
    const result = await setFeaturePi(ctx, {
      featureId: featureId as FeatureId,
      piId: piId === null ? null : (piId as PiId),
    });
    if (isErr(result)) {
      return {
        error:
          result.error.kind === "conflict"
            ? result.error.reason
            : result.error.kind === "not_found"
              ? "Feature or PI not found"
              : "Failed to assign feature",
      };
    }
  }

  revalidateFor("feature");
  return {};
}
