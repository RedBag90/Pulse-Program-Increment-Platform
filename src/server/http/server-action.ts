import { headers } from "next/headers";
import type { z } from "zod";
import { authorize, type AuthResource } from "@/server/auth/authorize";
import type { Action } from "@/server/auth/policies";
import { requirePrincipal, type Principal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { isErr } from "@/domain/errors";
import type { DomainError, Result } from "@/domain/errors";
import { extractRequestMeta } from "@/server/audit/emit";
import { revalidateFor, type RevalidationResource } from "@/server/http/revalidation";
import type { RequestContext } from "./mutation-handler";

/** Identifies the entity a create action just produced — drives the success toast. */
export interface CreatedRef {
  id: string;
  /** Human label, e.g. "Epic". */
  label: string;
  /** Detail-page URL; when set, the toast offers an "Open" link. */
  href?: string;
}

export type ActionState = {
  error?: string;
  success?: boolean;
  /** Per-field validation errors for forms with field-level feedback. */
  fieldErrors?: Record<string, string[]>;
  /** Set on a successful create — see `describeCreated`. */
  created?: CreatedRef;
};

export interface ServerActionConfig<TInput, TOutput = unknown> {
  schema: z.ZodType<TInput, z.ZodTypeDef, unknown>;
  action: Action;
  resource: (input: TInput, principal: Principal) => AuthResource;
  parseFormData: (fd: FormData) => unknown;
  service: (ctx: RequestContext, input: TInput) => Promise<Result<TOutput>>;
  /** Domain resource to revalidate via the registry — preferred over hand-rolled `onSuccess`. */
  revalidate?: RevalidationResource;
  /** Extra post-success side effects (rarely needed once `revalidate` covers paths). */
  onSuccess?: (input: TInput) => void;
  mapError?: (e: DomainError) => string;
  /** Builds the `CreatedRef` for the success toast from the service result. */
  describeCreated?: (value: TOutput, input: TInput) => CreatedRef;
}

export function createServerAction<TInput, TOutput = unknown>(
  config: ServerActionConfig<TInput, TOutput>,
): (_prev: ActionState, formData: FormData) => Promise<ActionState> {
  return async (_prev, formData) => {
    const principal = await requirePrincipal().catch(() => null);
    if (!principal) return { error: "Not authenticated" };

    const raw = config.parseFormData(formData);
    const parsed = config.schema.safeParse(raw);
    if (!parsed.success) {
      return {
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
        error: parsed.error.issues[0]?.message ?? "Invalid input",
      };
    }

    const decision = authorize(config.action, config.resource(parsed.data, principal), principal);
    if (!decision.allow) return { error: "Insufficient permissions" };

    const { ipAddress, userAgent } = extractRequestMeta(await headers());
    const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
    const ctx: RequestContext = {
      principal,
      db,
      ...(ipAddress !== undefined && { ipAddress }),
      ...(userAgent !== undefined && { userAgent }),
    };

    const result = await config.service(ctx, parsed.data);

    if (isErr(result)) {
      const msg = config.mapError ? config.mapError(result.error) : "Operation failed";
      return { error: msg };
    }

    if (config.revalidate) revalidateFor(config.revalidate);
    config.onSuccess?.(parsed.data);
    return {
      success: true,
      ...(config.describeCreated && {
        created: config.describeCreated(result.value, parsed.data),
      }),
    };
  };
}
