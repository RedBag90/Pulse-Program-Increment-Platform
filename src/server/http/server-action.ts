import type { z } from "zod";
import { authorize, type AuthResource } from "@/server/auth/authorize";
import type { Action } from "@/server/auth/policies";
import type { Principal } from "@/server/auth/principal";
import { isErr } from "@/domain/errors";
import type { DomainError, Result } from "@/domain/errors";
import { revalidateFor, type RevalidationResource } from "@/server/http/revalidation";
import { buildRequestContext, type RequestContext } from "@/server/http/request-context";
import { parseFromSchema } from "@/server/http/form-data-schema";

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
  /** Non-fatal advisories aggregated across a batch (see `batch.foldWarnings`). */
  warnings?: string[];
};

/**
 * Batch-mode service: the action's schema declares one array field (named in
 * `iterateOver`); the factory loops over it, calling `service` per item with
 * the rest of the validated input. Warnings can be folded via `foldWarnings`;
 * by default the loop stops on the first item error (mirrors today's
 * setFeaturePiAction behaviour).
 */
export interface ServerActionBatchConfig<TInput, TOutput> {
  iterateOver: keyof TInput & string;
  service: (ctx: RequestContext, item: string, rest: TInput) => Promise<Result<TOutput>>;
  /** When true, keep iterating past per-item errors and report the first one at the end. Defaults to false. */
  continueOnError?: boolean;
  /** Project per-call warnings; the factory concatenates them onto `state.warnings`. */
  foldWarnings?: (out: TOutput) => readonly string[] | null;
}

interface BaseConfig<TInput, TOutput> {
  schema: z.ZodType<TInput, z.ZodTypeDef, unknown>;
  action: Action;
  resource: (input: TInput, principal: Principal) => AuthResource;
  /**
   * Optional. When omitted, the factory walks the `schema` itself via
   * `parseFromSchema` — that covers ~90% of actions. Provide a callback only
   * when the schema doesn't map 1:1 to FormData (JSON payloads, multi-line
   * textarea splits, custom coercion).
   */
  parseFormData?: (fd: FormData) => unknown;
  /** Domain resource to revalidate via the registry — preferred over hand-rolled `onSuccess`. */
  revalidate?: RevalidationResource;
  /** Extra post-success side effects (rarely needed once `revalidate` covers paths). */
  onSuccess?: (input: TInput) => void;
  mapError?: (e: DomainError) => string;
  /** Builds the `CreatedRef` for the success toast from the service result. */
  describeCreated?: (value: TOutput, input: TInput) => CreatedRef;
}

/**
 * Server-action config. Provide **either** `service` (single mutation) **or**
 * `batch` (loop a schema array field), not both.
 */
export type ServerActionConfig<TInput, TOutput = unknown> = BaseConfig<TInput, TOutput> &
  (
    | {
        service: (ctx: RequestContext, input: TInput) => Promise<Result<TOutput>>;
        batch?: never;
      }
    | {
        service?: never;
        batch: ServerActionBatchConfig<TInput, TOutput>;
      }
  );

export function createServerAction<TInput, TOutput = unknown>(
  config: ServerActionConfig<TInput, TOutput>,
): (_prev: ActionState, formData: FormData) => Promise<ActionState> {
  return async (_prev, formData) => {
    const ctx = await buildRequestContext();
    if (!ctx) return { error: "Not authenticated" };
    const { principal } = ctx;

    const raw = config.parseFormData
      ? config.parseFormData(formData)
      : parseFromSchema(formData, config.schema);
    const parsed = config.schema.safeParse(raw);
    if (!parsed.success) {
      return {
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
        error: parsed.error.issues[0]?.message ?? "Invalid input",
      };
    }

    const decision = authorize(config.action, config.resource(parsed.data, principal), principal);
    if (!decision.allow) return { error: "Insufficient permissions" };

    // Batch mode: loop the iterated field, calling the per-item service.
    if (config.batch) {
      const batchResult = await runBatch(ctx, parsed.data, config.batch, config.mapError);
      if (batchResult.error) return batchResult;
      if (config.revalidate) revalidateFor(config.revalidate);
      config.onSuccess?.(parsed.data);
      return batchResult;
    }

    // Single mode: one service call.
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

/**
 * Per-item loop for `batch` mode. Extracted so the main factory body reads
 * load → parse → authorize → dispatch; the dispatch branch is short.
 */
async function runBatch<TInput, TOutput>(
  ctx: RequestContext,
  input: TInput,
  batch: ServerActionBatchConfig<TInput, TOutput>,
  mapError: ((e: DomainError) => string) | undefined,
): Promise<ActionState> {
  const items = (input as Record<string, unknown>)[batch.iterateOver];
  if (!Array.isArray(items)) {
    return { error: `Batch field "${batch.iterateOver}" is not an array` };
  }

  const warnings: string[] = [];
  let firstError: string | null = null;

  for (const item of items as string[]) {
    const result = await batch.service(ctx, item, input);
    if (isErr(result)) {
      const msg = mapError ? mapError(result.error) : "Operation failed";
      if (!batch.continueOnError) return { error: msg };
      if (firstError === null) firstError = msg;
      continue;
    }
    const w = batch.foldWarnings?.(result.value);
    if (w && w.length > 0) warnings.push(...w);
  }

  if (firstError) {
    return { error: firstError, ...(warnings.length > 0 && { warnings }) };
  }
  return {
    success: true,
    ...(warnings.length > 0 && { warnings }),
  };
}
