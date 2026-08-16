"use client";

import type { ActionState } from "@/server/http/server-action";

/**
 * Typed, client-safe wrappers for the dependency server actions. Each wrapper
 * OWNS the FormData field-name encoding for exactly one action, so the field
 * names live in a single typed place: rename a field here (or in the matching
 * server schema) and every call site fails at compile time instead of turning
 * into a silent runtime no-op.
 *
 * These reproduce the exact encoding the server parser (`parseFromSchema`)
 * expects:
 *   - scalar fields via `fd.set(...)`
 *   - array fields (`dependencyIds`) via repeated `fd.append(...)` keys, which
 *     the server reads back with `fields.list` / `FormData.getAll`.
 */

/** Dependency edge types accepted by the link / unlink / change-type actions. */
export type DependencyEdgeType = "blocks" | "depends_on" | "relates_to";

/**
 * A server action or a `useActionState` dispatcher — anything invoked with
 * `(prevState, formData)`. Generic in the return type so a bound action returns
 * its `Promise<ActionState>` while a dispatcher returns `void`.
 */
type ActionLike<R> = (prevState: ActionState, formData: FormData) => R;

const EMPTY: ActionState = {};

export interface LinkDependencyArgs {
  fromId: string;
  toId: string;
  /** Defaults to `"depends_on"` — matches the network views' `callLink` default. */
  type?: DependencyEdgeType;
  artId: string;
}

export function linkDependency<R>(action: ActionLike<R>, args: LinkDependencyArgs): R {
  const fd = new FormData();
  fd.set("fromId", args.fromId);
  fd.set("toId", args.toId);
  fd.set("type", args.type ?? "depends_on");
  fd.set("artId", args.artId);
  return action(EMPTY, fd);
}

export interface UnlinkDependencyArgs {
  fromId: string;
  toId: string;
  type: DependencyEdgeType;
  artId: string;
}

export function unlinkDependency<R>(action: ActionLike<R>, args: UnlinkDependencyArgs): R {
  const fd = new FormData();
  fd.set("fromId", args.fromId);
  fd.set("toId", args.toId);
  fd.set("type", args.type);
  fd.set("artId", args.artId);
  return action(EMPTY, fd);
}

export interface ChangeDependencyTypeArgs {
  fromId: string;
  toId: string;
  fromType: DependencyEdgeType;
  toType: DependencyEdgeType;
  artId: string;
}

export function changeDependencyType<R>(action: ActionLike<R>, args: ChangeDependencyTypeArgs): R {
  const fd = new FormData();
  fd.set("fromId", args.fromId);
  fd.set("toId", args.toId);
  fd.set("fromType", args.fromType);
  fd.set("toType", args.toType);
  fd.set("artId", args.artId);
  return action(EMPTY, fd);
}

export interface UnlinkDependencyBatchArgs {
  dependencyIds: readonly string[];
  artId: string;
}

/**
 * Builds the batch-unlink FormData. Exposed as a builder (not only an invoke
 * wrapper) because one caller dispatches through `useActionState`, where no
 * bound action is available to invoke — it calls `dispatch(...)` with this.
 */
export function unlinkDependencyBatchFormData(args: UnlinkDependencyBatchArgs): FormData {
  const fd = new FormData();
  for (const id of args.dependencyIds) fd.append("dependencyIds", id);
  fd.set("artId", args.artId);
  return fd;
}

export function unlinkDependencyBatch<R>(
  action: ActionLike<R>,
  args: UnlinkDependencyBatchArgs,
): R {
  return action(EMPTY, unlinkDependencyBatchFormData(args));
}
