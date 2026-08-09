"use server";

import { z } from "zod";
import { createFeatureWithDependency, insertFeatureBetween } from "@/server/services/feature";
import { createServerAction } from "@/server/http/server-action";
import { formatDomainError } from "@/server/http/domain-error-display";
import type { ArtId, EpicId, FeatureId } from "@/modules/core/kernel/domain/types";

const EDGE_TYPE = z.enum(["blocks", "depends_on", "relates_to"]);
const FEATURE_TYPE = z.enum(["feature", "enabler", ""]).optional();

/**
 * Netzplan-Quick-Add (Roadmap-N3, „+" am Node): legt einen Folge-Knoten
 * an und verbindet ihn als `depends_on`-Successor an einen bestehenden
 * Predecessor. ART-scoped — der Source-ART bestimmt das Policy-Gate.
 */
export const quickAddFeatureWithDependencyAction = createServerAction({
  describeCreated: (v: { id: string }) => ({
    id: v.id,
    label: "Feature",
    href: `/feature/${v.id}`,
  }),
  schema: z.object({
    artId: z.string().uuid(),
    parentEpicId: z.string().uuid(),
    predecessorId: z.string().uuid(),
    title: z.string().min(1).max(200),
    featureType: FEATURE_TYPE,
    edgeType: EDGE_TYPE.optional(),
  }),
  action: "feature.create",
  resource: (input, p) => ({ tenantId: p.tenantId, artId: input.artId }),
  service: (ctx, input) =>
    createFeatureWithDependency(ctx, {
      parentId: input.parentEpicId as EpicId,
      artId: input.artId as ArtId,
      predecessorId: input.predecessorId as FeatureId,
      title: input.title,
      ...(input.featureType !== undefined && {
        featureType: input.featureType === "" ? null : input.featureType,
      }),
      ...(input.edgeType !== undefined && { edgeType: input.edgeType }),
    }),
  revalidate: "feature",
  mapError: (e) => formatDomainError(e, { fallback: "Feature konnte nicht angelegt werden" }),
});

/**
 * Netzplan-Edge-Insertion (Roadmap-N3, „+" an einer Edge): spaltet die
 * Kante `from → to` durch einen neuen Feature-Knoten in
 * `from → new → to`. Atomar im Service. ART-scoped.
 */
export const insertFeatureBetweenAction = createServerAction({
  describeCreated: (v: { id: string }) => ({
    id: v.id,
    label: "Feature",
    href: `/feature/${v.id}`,
  }),
  schema: z.object({
    artId: z.string().uuid(),
    parentEpicId: z.string().uuid(),
    fromId: z.string().uuid(),
    toId: z.string().uuid(),
    edgeType: EDGE_TYPE,
    title: z.string().min(1).max(200),
    featureType: FEATURE_TYPE,
  }),
  action: "feature.create",
  resource: (input, p) => ({ tenantId: p.tenantId, artId: input.artId }),
  service: (ctx, input) =>
    insertFeatureBetween(ctx, {
      parentId: input.parentEpicId as EpicId,
      artId: input.artId as ArtId,
      fromId: input.fromId as FeatureId,
      toId: input.toId as FeatureId,
      edgeType: input.edgeType,
      title: input.title,
      ...(input.featureType !== undefined && {
        featureType: input.featureType === "" ? null : input.featureType,
      }),
    }),
  revalidate: "feature",
  mapError: (e) => formatDomainError(e, { fallback: "Feature konnte nicht zwischengefügt werden" }),
});
