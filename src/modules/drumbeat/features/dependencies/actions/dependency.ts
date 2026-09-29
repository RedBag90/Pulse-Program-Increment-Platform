"use server";

import { z } from "zod";
import { DEPENDENCY_TYPES } from "@/modules/core/kernel/domain/types";
import {
  linkDependency,
  unlinkDependency,
  changeDependencyType,
  relinkDependency,
} from "@/modules/drumbeat/server/services/dependency";
import { createServerAction } from "@/server/http/server-action";
import { formatDomainError } from "@/server/http/domain-error-display";
import type { InitiativeId } from "@/modules/core/kernel/domain/types";

const TYPE = z.enum(DEPENDENCY_TYPES);

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
  mapError: (e, t) => formatDomainError(e, { fallbackKey: "errors.action.linkDependency" }, t),
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
  mapError: (e, t) => formatDomainError(e, { fallbackKey: "errors.action.linkDependency" }, t),
});

/**
 * Unlink action — called from the network and roadmap edge menus and the
 * feature detail tab (`DependencyRowControls`).
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
  mapError: (e, t) => formatDomainError(e, { fallbackKey: "errors.action.unlinkDependency" }, t),
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
  mapError: (e, t) =>
    formatDomainError(e, { fallbackKey: "errors.action.changeDependencyType" }, t),
});

/**
 * **Umhängen: ein Ende aufnehmen und woanders ablegen.**
 *
 * Recht: `dependency.link`, wie beim Typwechsel nebenan — dort war dieselbe
 * Frage zu beantworten, und dieselbe Antwort gilt. (Der Gegeneinwand ist
 * notiert: `dependency.unlink` ist ein eigenes Recht, weil Lösen fremde
 * Planungsannahmen kippt. Umhängen **löst** eine Beziehung auf. Die
 * Entscheidung fiel bewusst für den einfacheren Weg.)
 */
export const relinkDependencyAction = createServerAction({
  schema: z.object({
    fromId: z.string().uuid(),
    toId: z.string().uuid(),
    type: TYPE,
    newFromId: z.string().uuid(),
    newToId: z.string().uuid(),
    artId: z.string().uuid(),
  }),
  action: "dependency.link",
  resource: (input, p) => ({ tenantId: p.tenantId, artId: input.artId }),
  service: (ctx, input) =>
    relinkDependency(ctx, {
      fromId: input.fromId as InitiativeId,
      toId: input.toId as InitiativeId,
      type: input.type,
      newFromId: input.newFromId as InitiativeId,
      newToId: input.newToId as InitiativeId,
    }),
  revalidate: "dependency",
  mapError: (e, t) => formatDomainError(e, { fallbackKey: "errors.action.relinkDependency" }, t),
});
