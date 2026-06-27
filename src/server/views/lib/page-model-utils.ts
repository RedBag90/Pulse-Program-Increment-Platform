/**
 * Page-model utilities — concentrate the repeated reshape patterns that every
 * list/overview page-model used to inline (facet-extraction, funnel-counts,
 * lookup-maps). Pure, no I/O — composable inside a builder.
 */

/**
 * Build a deduplicated `{ id, label }[]` from rows. For each row, `idOf`
 * returns the facet's id (or null/undefined to skip the row); `labelOf` is
 * called the **first time** an id appears and the result is cached. The
 * sort order is the insertion order of unique ids; pass `sort` to override.
 *
 * Replaces the `new Map<string,string>` + for-loop + `[...map].map` that
 * 5+ page-models repeated (impediments-list ownerOptions, portfolio-epics-list
 * ownerOptions, dependencies-list featureOptions, my-tasks-list vsOptions
 * / artOptions / epicOptions / piOptions, …).
 */
export function extractUniqueFacet<TRow, TId>(
  rows: readonly TRow[],
  idOf: (row: TRow) => TId | null | undefined,
  labelOf: (row: TRow, id: TId) => string,
  sort?: (a: { id: TId; label: string }, b: { id: TId; label: string }) => number,
): { id: TId; label: string }[] {
  const seen = new Map<TId, string>();
  for (const row of rows) {
    const id = idOf(row);
    if (id == null || seen.has(id)) continue;
    seen.set(id, labelOf(row, id));
  }
  const out = [...seen].map(([id, label]) => ({ id, label }));
  return sort ? out.sort(sort) : out;
}

/**
 * Build a `Record<K, number>` counting rows per category, with every category
 * in `values` present (zero-valued when no rows match). The `selector`
 * extracts the row's category; rows whose category isn't in `values` are
 * counted under no slot.
 *
 * Replaces the `Object.fromEntries(ENUM.map(x => [x, 0])) as Record<X, number>`
 * + for-loop that lived in 6+ list / overview page-models.
 */
export function buildFunnelCounts<TRow, TKey extends string>(
  rows: readonly TRow[],
  values: readonly TKey[],
  selector: (row: TRow) => TKey | null | undefined,
): Record<TKey, number> {
  const counts = Object.fromEntries(values.map((v) => [v, 0])) as Record<TKey, number>;
  for (const row of rows) {
    const k = selector(row);
    if (k != null && k in counts) counts[k] += 1;
  }
  return counts;
}
