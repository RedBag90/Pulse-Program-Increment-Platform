import type { z } from "zod";
import { authorize, type AuthResource } from "@/server/auth/authorize";
import type { Action } from "@/server/auth/policies";
import type { Principal } from "@/server/auth/principal";
import { isErr } from "@/modules/core/kernel/domain/errors";
import { moduleForAction } from "@/modules/core/kernel/domain/modules";
import type { DomainError, Result } from "@/modules/core/kernel/domain/errors";
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
   * **Der Service autorisiert selbst.** Setzt die RBAC-Vorprüfung dieser Action
   * aus; das Modul-Gate, das Schema-Parsing, der Audit-Sink und die
   * Revalidierung bleiben unverändert.
   *
   * Gedacht für **zeilenabhängige** Rechte, die sich nicht als Capability
   * ausdrücken lassen: die Finance-Partei eines Wertstroms
   * (`ValueStream.financeApproverId`) und der Produkt-Manager einer Solution
   * (`Solution.productManagerId`) sind keine Rollen — sie tragen die am
   * Action-Objekt deklarierte Capability nicht und wurden deshalb hier
   * abgewiesen, **bevor** der Service seinen eigenen, feineren Check
   * überhaupt laufen lassen konnte. Die Fläche zeigte ihnen den Knopf, die
   * Action antwortete „Insufficient permissions".
   *
   * `action` bleibt trotzdem gesetzt: daraus leitet sich das Modul-Gate ab, und
   * sie bleibt die Beschriftung im Timing-Log.
   *
   * **Bedingung:** nur zulässig, wenn der Service den Aufruf selbst autorisiert
   * — sonst öffnet die Angabe eine Mutation für jeden angemeldeten Nutzer.
   */
  authorizedInService?: boolean;
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
  /**
   * Single-mode: project non-fatal advisories from the service result onto
   * `state.warnings` (the single-call analogue of `batch.foldWarnings`). Lets an
   * action surface warnings through the factory instead of a hand-rolled action.
   */
  foldWarnings?: (value: TOutput) => readonly string[] | null;
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

/**
 * Loggt Server-Action-Latenz im Dev (opt-in via SERVER_ACTION_TIMING=1).
 * Farb-Schwellen: < 200ms gruen, < 600ms gelb, > rot — matched die
 * Performance-Targets aus dem Perf-Plan.
 */
function logActionTiming(label: string, ms: number, status: "ok" | "err"): void {
  if (process.env.NODE_ENV === "production") return;
  if (process.env.SERVER_ACTION_TIMING !== "1") return;
  const color = ms > 600 ? "\x1b[31m" : ms > 200 ? "\x1b[33m" : "\x1b[32m";
  const reset = "\x1b[0m";
  // eslint-disable-next-line no-console
  console.log(`${color}[action] ${label} ${Math.round(ms)}ms ${status}${reset}`);
}

export function createServerAction<TInput, TOutput = unknown>(
  config: ServerActionConfig<TInput, TOutput>,
): (_prev: ActionState, formData: FormData) => Promise<ActionState> {
  return async (_prev, formData) => {
    const startedAt = performance.now();
    const ctx = await buildRequestContext();
    if (!ctx) {
      logActionTiming(config.action, performance.now() - startedAt, "err");
      return { error: "Not authenticated" };
    }
    const { principal } = ctx;

    const raw = config.parseFormData
      ? config.parseFormData(formData)
      : parseFromSchema(formData, config.schema);
    const parsed = config.schema.safeParse(raw);
    if (!parsed.success) {
      logActionTiming(config.action, performance.now() - startedAt, "err");
      return {
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
        error: parsed.error.issues[0]?.message ?? "Invalid input",
      };
    }

    // Vorprüfung — außer die Action erklärt den Service zur Autorität. Siehe
    // `authorizedInService`.
    if (!config.authorizedInService) {
      const decision = authorize(config.action, config.resource(parsed.data, principal), principal);
      if (!decision.allow) {
        logActionTiming(config.action, performance.now() - startedAt, "err");
        return { error: "Insufficient permissions" };
      }
    }

    // Modul-Gate (Entitlement-Achse, fail-closed): Mutationen eines Moduls,
    // das der aktive Tenant nicht freigeschaltet hat, sind gesperrt — auch
    // wenn RBAC (oben) erlauben würde. Actions ohne Modul-Zuordnung
    // (nur tenant.create) bleiben ungegated.
    const requiredModule = moduleForAction(config.action);
    if (requiredModule && !principal.enabledModules.includes(requiredModule)) {
      logActionTiming(config.action, performance.now() - startedAt, "err");
      return { error: "Dieses Modul ist in diesem Bereich nicht verfügbar" };
    }

    // Batch mode: loop the iterated field, calling the per-item service.
    if (config.batch) {
      const batchResult = await runBatch(ctx, parsed.data, config.batch, config.mapError);
      if (batchResult.error) {
        logActionTiming(config.action, performance.now() - startedAt, "err");
        return batchResult;
      }
      if (config.revalidate) revalidateFor(config.revalidate);
      config.onSuccess?.(parsed.data);
      logActionTiming(config.action, performance.now() - startedAt, "ok");
      return batchResult;
    }

    // Single mode: one service call.
    const result = await config.service(ctx, parsed.data);
    if (isErr(result)) {
      const msg = config.mapError ? config.mapError(result.error) : "Operation failed";
      logActionTiming(config.action, performance.now() - startedAt, "err");
      return { error: msg };
    }

    if (config.revalidate) revalidateFor(config.revalidate);
    config.onSuccess?.(parsed.data);
    logActionTiming(config.action, performance.now() - startedAt, "ok");
    const warnings = config.foldWarnings?.(result.value);
    return {
      success: true,
      ...(config.describeCreated && {
        created: config.describeCreated(result.value, parsed.data),
      }),
      ...(warnings && warnings.length > 0 ? { warnings: [...warnings] } : {}),
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
