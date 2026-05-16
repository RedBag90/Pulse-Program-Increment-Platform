import { headers } from "next/headers";
import type { z } from "zod";
import { authorize, type AuthResource } from "@/server/auth/authorize";
import type { Action } from "@/server/auth/policies";
import { requirePrincipal, type Principal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { isErr } from "@/domain/errors";
import type { DomainError, Result } from "@/domain/errors";
import { extractRequestMeta } from "@/server/audit/emit";
import type { RequestContext } from "./mutation-handler";

export type ActionState = {
  error?: string;
  success?: boolean;
  /** Per-field validation errors for forms with field-level feedback. */
  fieldErrors?: Record<string, string[]>;
};

export interface ServerActionConfig<TInput> {
  schema: z.ZodType<TInput, z.ZodTypeDef, unknown>;
  action: Action;
  resource: (input: TInput, principal: Principal) => AuthResource;
  parseFormData: (fd: FormData) => unknown;
  service: (ctx: RequestContext, input: TInput) => Promise<Result<unknown>>;
  onSuccess: (input: TInput) => void;
  mapError?: (e: DomainError) => string;
}

export function createServerAction<TInput>(
  config: ServerActionConfig<TInput>,
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

    config.onSuccess(parsed.data);
    return { success: true };
  };
}
