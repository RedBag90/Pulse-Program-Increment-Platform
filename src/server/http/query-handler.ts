import type { z } from "zod";
import { authorize, type AuthResource } from "@/server/auth/authorize";
import { moduleForAction } from "@/modules/core/kernel/domain/modules";
import type { Action } from "@/server/auth/policies";
import type { Principal } from "@/server/auth/principal";
import { forbidden, notFound, unauthorized, unprocessable } from "@/server/http/problem";
import { buildRequestContext } from "@/server/http/request-context";
import type { PrismaClient } from "@/generated/prisma";

// ---------------------------------------------------------------------------
// Query context passed to every read handler via the pipeline
// ---------------------------------------------------------------------------

/**
 * Reads don't audit, so the QueryContext is a strict subset of `RequestContext`
 * (no `ipAddress`/`userAgent`). Built via `buildRequestContext({
 * includeRequestMeta: false })`.
 */
export interface QueryContext {
  principal: Principal;
  db: PrismaClient;
}

// ---------------------------------------------------------------------------
// Pipeline factory
// ---------------------------------------------------------------------------

export interface QueryHandlerConfig<TParams, TResult> {
  /**
   * Zod schema for merged route params + searchParams.
   * When absent, params are passed as `{}` to the query function.
   */
  params?: z.ZodType<TParams, z.ZodTypeDef, unknown>;
  /**
   * When provided, the pipeline calls authorize() before invoking query.
   * Must be accompanied by `resource`.
   */
  readAction?: Action;
  /** Derives the AuthResource from validated params and the resolved principal. */
  resource?: (params: TParams, principal: Principal) => AuthResource;
  /**
   * The read logic. Return null to produce a 404 response (useful for
   * single-resource lookups). Throw to propagate to Next.js error boundary.
   */
  query: (ctx: QueryContext, params: TParams) => Promise<TResult | null>;
}

type RouteHandlerCtx = { params: Promise<Record<string, string>> };

/**
 * Returns a Next.js Route Handler function that runs the full read pipeline:
 * auth → (authorize) → parse params → Prisma client → query → 200 / 404.
 *
 * Usage (no route params):
 *   export const GET = createQueryHandler({ query: (ctx) => listThings(ctx.db, ...) });
 *
 * Usage (with route params):
 *   export const GET = createQueryHandler({
 *     params: z.object({ id: z.string().uuid() }),
 *     query: (ctx, { id }) => getThing(ctx.db, ctx.principal.tenantId, id as ThingId),
 *   });
 */
export function createQueryHandler<TParams = Record<string, never>, TResult = unknown>(
  config: QueryHandlerConfig<TParams, TResult>,
): (request: Request, ctx: RouteHandlerCtx) => Promise<Response> {
  const { readAction, resource, query } = config;

  return async function queryHandler(request: Request, ctx: RouteHandlerCtx): Promise<Response> {
    const built = await buildRequestContext({ includeRequestMeta: false });
    if (!built) return unauthorized();
    const { principal, db } = built;

    // Merge route params + searchParams into one plain object for validation.
    const routeParams = await ctx.params;
    const { searchParams } = new URL(request.url);
    const searchParamsObj = Object.fromEntries(searchParams.entries());
    const merged: unknown = { ...routeParams, ...searchParamsObj };

    let validatedParams: TParams;
    if (config.params) {
      const parsed = config.params.safeParse(merged);
      if (!parsed.success) return unprocessable(parsed.error.message);
      validatedParams = parsed.data;
    } else {
      validatedParams = merged as TParams;
    }

    // Optional application-level read authorization (in addition to RLS).
    if (readAction !== undefined && resource !== undefined) {
      const decision = authorize(readAction, resource(validatedParams, principal), principal);
      if (!decision.allow) return forbidden(decision.reason);
      // Modul-Gate (Entitlement): Reads mit deklarierter Action folgen derselben
      // Modul-Zuordnung wie Mutationen; Reads ohne readAction bleiben RLS-only.
      const requiredModule = moduleForAction(readAction);
      if (requiredModule && !principal.enabledModules.includes(requiredModule)) {
        return forbidden("Dieses Modul ist in diesem Bereich nicht verfügbar");
      }
    }

    const queryCtx: QueryContext = { principal, db };

    const result = await query(queryCtx, validatedParams);
    if (result === null) return notFound();

    return Response.json(result);
  };
}
