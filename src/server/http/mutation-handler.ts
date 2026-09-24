import type { ZodSchema } from "zod";
import { authorize, type AuthResource } from "@/server/auth/authorize";
import { moduleForAction } from "@/modules/core/kernel/domain/modules";
import type { Action } from "@/server/auth/policies";
import type { Principal } from "@/server/auth/principal";
import { isErr, type DomainError, type Result } from "@/modules/core/kernel/domain/errors";
import { withIdempotency } from "@/server/http/idempotency";
import { forbidden, problemJson, unauthorized, unprocessable } from "@/server/http/problem";
import { buildRequestContext, type RequestContext } from "@/server/http/request-context";
import { apiTranslate } from "@/server/http/api-locale";
import { resourceKey } from "@/server/http/domain-error-display";
import type { Translate } from "@/i18n/translate";

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

/**
 * **`detail` ist für Menschen.** RFC 7807 nennt das Feld ausdrücklich eine
 * lesbare Erklärung — und seit die Services in `reason`/`detail` Schlüssel
 * ablegen (ADR-0024), muss diese Naht sie auflösen, sonst stünde dort
 * `work.errors.epicNotInFunnel`. Die Sprache kommt aus `Accept-Language`.
 */
function errorToResponse(
  error: DomainError,
  statusMap: Partial<Record<DomainError["kind"], number>>,
  t: Translate,
): Response {
  const status = statusMap[error.kind] ?? 500;
  switch (error.kind) {
    case "not_found":
      return problemJson(status, "not-found", {
        detail: t("errors.notFound", { resource: t(resourceKey(error.resourceType)) }),
      });
    case "conflict":
      return problemJson(status, "conflict", { detail: t(error.reason, error.values) });
    case "hierarchy_violation":
      return problemJson(status, "hierarchy-violation", {
        detail: t(error.detail, error.values),
        violatedConstraint: error.violatedConstraint,
      });
    case "validation":
      return problemJson(status, "validation-failed", { errors: error.issues });
    case "forbidden":
      return forbidden(t(error.reason, error.values));
    case "tenant_mismatch":
      return problemJson(403, "forbidden", { detail: t(error.detail, error.values) });
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
  /**
   * **Plattform-Sache statt Mandanten-Sache.** Verlangt das globale
   * `isPlatformAdmin`-Kennzeichen, bevor `authorize()` überhaupt befragt wird —
   * dieselbe Schranke, die `requirePlatformAdmin` vor die `/platform`-Flächen
   * stellt (`server/auth/platform.ts`).
   *
   * Notwendig, weil `authorize()` eine **Mandanten**-Entscheidung trifft: es
   * kennt nur die Rollen des aktiven Mandanten. Eine Route, die einen fremden
   * Mandanten schreibt, lässt sich damit nicht absichern — und `tenant.create`
   * hat ohnehin eine leere Grant-Liste, wird also allein vom
   * `tenant_admin`-Fast-Path getragen. Da **jeder** Nutzer `tenant_admin`
   * seines privaten Bereichs ist, hiess das: jeder kam durch.
   */
  platformOnly?: boolean;
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
  const {
    schema,
    action,
    resource,
    service,
    successStatus = 201,
    idempotent = true,
    platformOnly = false,
  } = config;

  const resolvedErrorMap = { ...DEFAULT_ERROR_MAP, ...config.errorMap };

  return async function mutationHandler(request: Request): Promise<Response> {
    const built = await buildRequestContext();
    if (!built) return unauthorized();
    const ctx: RequestContext = built;
    const { principal } = ctx;
    const t = await apiTranslate(request);

    async function execute(req: Request): Promise<Response> {
      let body: unknown = {};
      try {
        const text = await req.text();
        if (text.trim().length > 0) body = JSON.parse(text);
      } catch {
        return unprocessable(t("errors.invalidJsonBody"));
      }

      const parsed = schema.safeParse(body);
      if (!parsed.success) return unprocessable(parsed.error.message);

      if (platformOnly && !principal.isPlatformAdmin) {
        return forbidden(t("errors.platformAdminRequired"));
      }

      const decision = authorize(action, resource(parsed.data, principal), principal);
      if (!decision.allow) return forbidden(t(decision.reason ?? "errors.forbidden"));

      // Modul-Gate (Entitlement, fail-closed) — gleiche Regel wie im
      // Server-Action-Factory; Actions ohne Modul-Zuordnung bleiben ungegated.
      const requiredModule = moduleForAction(action);
      if (requiredModule && !principal.enabledModules.includes(requiredModule)) {
        return forbidden(t("errors.moduleUnavailable"));
      }

      const result = await service(ctx, parsed.data);

      if (isErr(result)) {
        return errorToResponse(result.error, resolvedErrorMap, t);
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
