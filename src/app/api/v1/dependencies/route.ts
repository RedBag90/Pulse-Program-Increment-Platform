import { z } from "zod";
import { linkDependency, unlinkDependency, listDependencies } from "@/server/services/dependency";
import { createMutationHandler } from "@/server/http/mutation-handler";
import { createQueryHandler } from "@/server/http/query-handler";
import type { InitiativeId } from "@/domain/types";

const dependencyTypeSchema = z.enum(["blocks", "depends_on", "relates_to"]);

const linkSchema = z.object({
  fromId: z.string().uuid(),
  toId: z.string().uuid(),
  type: dependencyTypeSchema,
});

const unlinkSchema = z.object({
  fromId: z.string().uuid(),
  toId: z.string().uuid(),
  type: dependencyTypeSchema,
});

const listParamsSchema = z.object({ initiativeId: z.string().uuid() });

export const GET = createQueryHandler({
  params: listParamsSchema,
  query: (ctx, { initiativeId }) =>
    listDependencies(ctx.db, ctx.principal.tenantId, initiativeId as InitiativeId),
});

export const POST = createMutationHandler({
  schema: linkSchema,
  action: "dependency.link",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: (ctx, input) =>
    linkDependency(ctx.db, {
      tenantId: ctx.principal.tenantId,
      actorId: ctx.principal.id,
      fromId: input.fromId as InitiativeId,
      toId: input.toId as InitiativeId,
      type: input.type,
      ...(ctx.ipAddress !== undefined && { ipAddress: ctx.ipAddress }),
      ...(ctx.userAgent !== undefined && { userAgent: ctx.userAgent }),
    }),
  successStatus: 201,
});

export const DELETE = createMutationHandler({
  schema: unlinkSchema,
  action: "dependency.unlink",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: (ctx, input) =>
    unlinkDependency(ctx.db, {
      tenantId: ctx.principal.tenantId,
      actorId: ctx.principal.id,
      fromId: input.fromId as InitiativeId,
      toId: input.toId as InitiativeId,
      type: input.type,
      ...(ctx.ipAddress !== undefined && { ipAddress: ctx.ipAddress }),
      ...(ctx.userAgent !== undefined && { userAgent: ctx.userAgent }),
    }),
  successStatus: 204,
  idempotent: false,
});
