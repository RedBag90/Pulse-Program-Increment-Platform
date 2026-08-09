/**
 * `makeTypeGuard(values)` — turn a `readonly T[]` enum-style array into a
 * `v is T` user-defined type guard. The same string-and-includes predicate
 * was inlined in `isEpicType` / `isFeatureType` / `isHorizon` /
 * `isTeamType`. A future tweak (e.g. case-insensitive matching, treating
 * legacy aliases) flips once here.
 */

export function makeTypeGuard<T extends string>(values: readonly T[]): (v: unknown) => v is T {
  return (v: unknown): v is T => typeof v === "string" && (values as readonly string[]).includes(v);
}
