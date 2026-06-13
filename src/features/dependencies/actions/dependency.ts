"use server";

import { z } from "zod";
import {
  linkDependency,
  unlinkDependency,
  unlinkDependencyById,
  changeDependencyType,
} from "@/server/services/dependency";
import { createServerAction } from "@/server/http/server-action";
import { formatDomainError } from "@/server/http/domain-error-display";
import type { InitiativeId } from "@/domain/types";

const TYPE = z.enum(["blocks", "depends_on", "relates_to"]);

/**
 * FormData-based dependency creation for the global "+" menu — picks both
 * initiatives explicitly. Distinct from `linkDependencyAction` below: this
 * one is tenant-scoped (no `artId` known yet) and surfaces the created id
 * for the success toast.
 */
export const createDependencyAction = createServerAction({
  describeCreated: (v: { id: string }) => ({ id: v.id, label: "Dependency" }),
  schema: z.object({
    fromId: z.string().uuid(),
    toId: z.string().uuid(),
    type: TYPE,
  }),
  action: "dependency.link",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: (ctx, input) =>
    linkDependency(ctx, {
      fromId: input.fromId as InitiativeId,
      toId: input.toId as InitiativeId,
      type: input.type,
    }),
  revalidate: "dependency",
  mapError: (e) => formatDomainError(e, { fallback: "Failed to link dependency" }),
});

/**
 * Feature-page inline `Link` action — called from `LinkDependencyDialog`
 * with the `from` initiative already known. ART-scoped so the policy check
 * honours the team's reach.
 */
export const linkDependencyAction = createServerAction({
  schema: z.object({
    fromId: z.string().uuid(),
    toId: z.string().uuid(),
    type: TYPE,
    artId: z.string().uuid(),
  }),
  action: "dependency.link",
  resource: (input, p) => ({ tenantId: p.tenantId, artId: input.artId }),
  service: (ctx, input) =>
    linkDependency(ctx, {
      fromId: input.fromId as InitiativeId,
      toId: input.toId as InitiativeId,
      type: input.type,
    }),
  revalidate: "dependency",
  mapError: (e) => formatDomainError(e, { fallback: "Failed to link dependency" }),
});

/**
 * Feature-page inline `Unlink` action — called from `UnlinkDependencyButton`.
 */
export const unlinkDependencyAction = createServerAction({
  schema: z.object({
    fromId: z.string().uuid(),
    toId: z.string().uuid(),
    type: TYPE,
    artId: z.string().uuid(),
  }),
  action: "dependency.unlink",
  resource: (input, p) => ({ tenantId: p.tenantId, artId: input.artId }),
  service: (ctx, input) =>
    unlinkDependency(ctx, {
      fromId: input.fromId as InitiativeId,
      toId: input.toId as InitiativeId,
      type: input.type,
    }),
  revalidate: "dependency",
  mapError: (e) => formatDomainError(e, { fallback: "Failed to unlink dependency" }),
});

/**
 * Edge-Type-Wechsel im Netzplan (Roadmap-P2). ART-scoped — Source-ART
 * treibt das `dependency.link`-Policy-Gate (gleicher Scope wie
 * `linkDependencyAction`).
 */
export const changeDependencyTypeAction = createServerAction({
  schema: z.object({
    fromId: z.string().uuid(),
    toId: z.string().uuid(),
    fromType: TYPE,
    toType: TYPE,
    artId: z.string().uuid(),
  }),
  action: "dependency.link",
  resource: (input, p) => ({ tenantId: p.tenantId, artId: input.artId }),
  service: (ctx, input) =>
    changeDependencyType(ctx, {
      fromId: input.fromId as InitiativeId,
      toId: input.toId as InitiativeId,
      fromType: input.fromType,
      toType: input.toType,
    }),
  revalidate: "dependency",
  mapError: (e) =>
    formatDomainError(e, { fallback: "Abhängigkeits-Typ konnte nicht geändert werden" }),
});

/**
 * Bulk unlink — drives the dependencies list bulk-action bar. Round 3
 * batch mode over the per-id `unlinkDependencyById` service so the user
 * can clean up dozens of stale `relates_to` links in one go. ART-scoped
 * so the policy check honours the team's reach (matches the single-item
 * `unlinkDependencyAction`).
 */
export const unlinkDependencyBatchAction = createServerAction({
  schema: z.object({
    dependencyIds: z.array(z.string().uuid()).min(1).max(50),
    artId: z.string().uuid(),
  }),
  action: "dependency.unlink",
  resource: (input, p) => ({ tenantId: p.tenantId, artId: input.artId }),
  batch: {
    iterateOver: "dependencyIds",
    service: (ctx, id) => unlinkDependencyById(ctx, { id }),
  },
  revalidate: "dependency",
  mapError: (e) => formatDomainError(e, { fallback: "Abhängigkeit konnte nicht gelöst werden" }),
});
