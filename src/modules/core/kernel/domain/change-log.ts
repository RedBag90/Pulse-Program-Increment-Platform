export type ChangeMap = Record<string, { before: unknown; after: unknown }>;

/**
 * Builds an audit changelog by comparing before and after values for the given
 * keys. Only fields present in `after` (not undefined) that differ from `before`
 * are included. Undefined after-values are treated as "not in this update".
 */
export function buildChangelog<T extends object>(
  before: T,
  after: Partial<T>,
  keys: ReadonlyArray<keyof T>,
): ChangeMap {
  const changes: ChangeMap = {};
  for (const key of keys) {
    const afterVal = after[key];
    if (afterVal !== undefined && afterVal !== before[key]) {
      changes[String(key)] = { before: before[key], after: afterVal };
    }
  }
  return changes;
}
