import { buildChangelog, type ChangeMap } from "@/modules/core/kernel/domain/change-log";

/**
 * Concentrate the "snapshot before + filter undefined updates + build changelog
 * + return write-ready data" sequence that ~8 services repeated. Pass the
 * loaded row, the partial updates, and the field list once; get back both the
 * audit `changes` map and the `data` subset ready to feed
 * `tx.foo.update({ data: { ...data, … } })`.
 *
 * Before: each service inlined three identical-shaped expressions over the
 * same field list (a before-snapshot object, an after-spread with `undefined`
 * guards, the changelog key array, and the update `data` spread). When a new
 * auditable column was added, it had to be threaded through all four — easy
 * to miss one, and silent if you did.
 *
 * The `fields` list is `keyof T`-typed so a typo or a deleted column is a
 * compile error, not a runtime audit gap.
 */
export interface RecordedUpdate<T, K extends keyof T> {
  /** Diff in the `buildChangelog` shape — pass straight to `audit.changes`. */
  changes: ChangeMap;
  /** Data subset to write — only the fields the caller explicitly set
   *  (entries with an `undefined` update are excluded). */
  data: { [P in K]?: T[P] };
}

export function recordedUpdate<T extends object, K extends keyof T>(args: {
  existing: T;
  updates: { readonly [P in K]?: T[P] | undefined };
  fields: readonly K[];
}): RecordedUpdate<T, K> {
  const before = {} as { [P in K]: T[P] };
  const after = {} as { [P in K]?: T[P] };
  for (const k of args.fields) {
    before[k] = args.existing[k];
    const v = args.updates[k];
    if (v !== undefined) {
      after[k] = v as T[K];
    }
  }
  return {
    changes: buildChangelog<{ [P in K]: T[P] }>(before, after, args.fields),
    data: after,
  };
}
