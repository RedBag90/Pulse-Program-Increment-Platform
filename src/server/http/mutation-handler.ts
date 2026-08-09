import type { ZodSchema } from "zod";
import { authorize, type AuthResource } from "@/server/auth/authorize";
import { moduleForAction } from "@/modules/core/kernel/domain/modules";
import type { Action } from "@/server/auth/policies";
import type { Principal } from "@/server/auth/principal";
import { isErr, type DomainError, type Result } from "@/domain/errors";
import { withIdempotency } from "@/server/http/idempotency";
import { forbidden, problemJson, unauthorized, unprocessable } from "@/server/http/problem";
import { buildRequestContext, type RequestContext } from "@/server/http/request-context";

// Re-export so existing imports `from "@/server/http/mutation-handler"` keep
// working; the canonical home is `request-context.ts`.
export type { RequestContext };

// ---------------------------------------------------------------------------
// Error → HTTP response mapping
// ---------------------------------------------------------------------------

const DEFAULT_ERROR_MAP: Partial<Record<DomainError["kind"], number>> = {
  not_found: 404,
  conflict: 409,
  hierarchy_violation: 422,
  validation: 422,
  forbidden: 403,
};

function errorToResponse(
  error: DomainError,
  statusMap: Partial<Record<DomainError["kind"], number>>,
): Response {
  const status = statusMap[error.kind] ?? 500;
  switch (error.kind) {
    case "not_found":
      return problemJson(status, "not-found", { detail: `${error.resourceType} not found` });
    case "conflict":
      return problemJson(status, "conflict", { detail: error.reason });
    case "hierarchy_violation":
      return problemJson(status, "hierarchy-violation", {
        detail: error.detail,
        violatedConstraint: error.violatedConstraint,
      });
    case "validation":
      return problemJson(status, "validation-failed", { errors: error.issues });
    case "forbidden":
      return forbidden(error.reason);
    case "tenant_mismatch":
      return problemJson(403, "forbidden", { detail: error.detail });
    default:
      return problemJson(500, "internal-error");
  }
}

// ---------------------------------------------------------------------------
// Pipeline factory
// ---------------------------------------------------------------------------

export interface MutationHandlerConfig<TInput> {
  /** Zod schema for the JSON request body. */
  schema: ZodSchema<TInput>;
  /** Authorization action — must appear in the policy registry. */
  action: Action;
  /** Derive the AuthResource from the validated input and the resolved principal. */
  resource: (input: TInput, principal: Principal) => AuthResource;
  /** Business logic. Receives a fully initialised RequestContext + validated input. */
  service: (ctx: RequestContext, input: TInput) => Promise<Result<unknown>>;
  /** HTTP status on success. Defaults to 201 (POST). Use 204 for mutations with no body. */
  successStatus?: 200 | 201 | 204;
  /** Override the default error-kind → status mapping. Merged over the defaults. */
  errorMap?: Partial<Record<DomainError["kind"], number>>;
  /**
   * Wrap the mutation in idempotency-key handling. Default true.
   * Pass false for PATCH/DELETE routes where idempotency is not needed.
   */
  idempotent?: boolean;
}

/**
 * Returns a Next.js Route Handler function that runs the full mutation pipeline:
 * auth → (idempotency) → parse → authorize → Prisma client → service → error map.
 *
 * Usage:
 *   export const POST = createMutationHandler({ schema, action, resource, service });
 */
export function createMutationHandler<TInput>(
  config: MutationHandlerConfig<TInput>,
): (request: Request) => Promise<Response> {
  const { schema, action, resource, service, successStatus = 201, idempotent = true } = config;

  const resolvedErrorMap = { ...DEFAULT_ERROR_MAP, ...config.errorMap };

  return async function mutationHandler(request: Request): Promise<Response> {
    const built = await buildRequestContext();
    if (!built) return unauthorized();
    const ctx: RequestContext = built;
    const { principal } = ctx;

    async function execute(req: Request): Promise<Response> {
      let body: unknown = {};
      try {
        const text = await req.text();
        if (text.trim().length > 0) body = JSON.parse(text);
      } catch {
        return unprocessable("Invalid JSON body");
      }

      const parsed = schema.safeParse(body);
      if (!parsed.success) return unprocessable(parsed.error.message);

      const decision = authorize(action, resource(parsed.data, principal), principal);
      if (!decision.allow) return forbidden(decision.reason);

      // Modul-Gate (Entitlement, fail-closed) — gleiche Regel wie im
      // Server-Action-Factory; Actions ohne Modul-Zuordnung bleiben ungegated.
      const requiredModule = moduleForAction(action);
      if (requiredModule && !principal.enabledModules.includes(requiredModule)) {
        return forbidden("Dieses Modul ist in diesem Bereich nicht verfügbar");
      }

      const result = await service(ctx, parsed.data);

      if (isErr(result)) {
        return errorToResponse(result.error, resolvedErrorMap);
      }

      if (successStatus === 204) {
        return new Response(null, { status: 204 });
      }
      return Response.json(result.value, { status: successStatus });
    }

    if (idempotent) {
      return withIdempotency(request, principal, execute);
    }
    return execute(request);
  };
}
