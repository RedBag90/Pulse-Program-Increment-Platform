"use client";

import type { ActionState } from "@/server/http/server-action";

/**
 * Typed, client-safe wrappers for the feature-move / delivery server actions.
 * Each wrapper OWNS the FormData field-name encoding for exactly one action, so
 * the field names live in a single typed place: rename a field here (or in the
 * matching server schema) and every call site fails at compile time instead of
 * silently becoming a runtime no-op.
 *
 * Encoding reproduced to match the server parser (`parseFromSchema`):
 *   - scalar fields via `fd.set(...)`
 *   - the multi-value `featureIds` field via repeated `fd.append("featureIds", …)`
 *     keys, which the server reads back with `fields.list` / `FormData.getAll`.
 */

/**
 * A server action or a `useActionState` dispatcher — anything invoked with
 * `(prevState, formData)`. Generic in the return type so a bound action returns
 * its `Promise<ActionState>` while a dispatcher returns `void`.
 */
type ActionLike<R> = (prevState: ActionState, formData: FormData) => R;

const EMPTY: ActionState = {};

/** Delivery-status transitions accepted by the (bulk) delivery actions. */
export type FeatureDeliveryStatus =
  | "approved"
  | "in_progress"
  | "blocked"
  | "completed"
  | "cancelled";

export interface SetFeaturePiArgs {
  featureIds: readonly string[];
  /** Empty string moves the feature(s) back to the backlog (server maps `"" → null`). */
  piId: string;
  artId: string;
}

/** Builds the `setFeaturePiAction` FormData — for `useActionState` dispatchers,
 *  which are invoked with only the FormData (no prevState). */
export function setFeaturePiFormData(args: SetFeaturePiArgs): FormData {
  const fd = new FormData();
  for (const id of args.featureIds) fd.append("featureIds", id);
  fd.set("piId", args.piId);
  fd.set("artId", args.artId);
  return fd;
}

export function setFeaturePi<R>(action: ActionLike<R>, args: SetFeaturePiArgs): R {
  return action(EMPTY, setFeaturePiFormData(args));
}

export interface SetFeatureDeliveryStatusArgs {
  id: string;
  to: FeatureDeliveryStatus;
  reason?: string;
}

export function setFeatureDeliveryStatus<R>(
  action: ActionLike<R>,
  args: SetFeatureDeliveryStatusArgs,
): R {
  const fd = new FormData();
  fd.set("id", args.id);
  fd.set("to", args.to);
  if (args.reason !== undefined) fd.set("reason", args.reason);
  return action(EMPTY, fd);
}

export interface BulkSetFeatureDeliveryStatusArgs {
  featureIds: readonly string[];
  to: FeatureDeliveryStatus;
  reason?: string;
}

export function bulkSetFeatureDeliveryStatus<R>(
  action: ActionLike<R>,
  args: BulkSetFeatureDeliveryStatusArgs,
): R {
  const fd = new FormData();
  for (const id of args.featureIds) fd.append("featureIds", id);
  fd.set("to", args.to);
  if (args.reason !== undefined) fd.set("reason", args.reason);
  return action(EMPTY, fd);
}
