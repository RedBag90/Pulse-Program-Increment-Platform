/**
 * Composable row-filter primitives shared by the Work list shells
 * (Portfolio-Epics and Meine-Tasks). Deliberately small: the facet SETS the two
 * shells filter on genuinely diverge, so this module holds only the duplicated
 * case-insensitive text-query match — each shell passes its own field list.
 */

/**
 * Case-insensitive substring match across several haystacks. Lowercases `q`
 * once; returns true when any non-null/undefined haystack contains it, and true
 * when `q` is empty — mirroring the "no text filter" case in every shell.
 */
export function matchesQuery(haystacks: (string | null | undefined)[], q: string): boolean {
  if (q === "") return true;
  const needle = q.toLowerCase();
  for (const h of haystacks) {
    if (h != null && h.toLowerCase().includes(needle)) return true;
  }
  return false;
}
