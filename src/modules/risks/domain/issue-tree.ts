/**
 * Pure helpers for the issue head-hierarchy (self-referential `parentId`).
 * DB-free / unit-testable. Used by the reparent cycle guard (service) and the
 * tree rendering (table).
 */

export interface TreeNode<T> {
  row: T;
  depth: number;
  children: TreeNode<T>[];
}

/**
 * Build a forest from flat rows keyed by `parentId`. Roots are rows with a null
 * parent OR whose parent is not in the set (orphans → root, e.g. after filtering).
 * Input order is preserved among siblings. Cycle-safe.
 */
export function buildIssueTree<T extends { id: string; parentId: string | null }>(
  rows: readonly T[],
): TreeNode<T>[] {
  const byId = new Set(rows.map((r) => r.id));
  const childrenOf = new Map<string, T[]>();
  const roots: T[] = [];
  for (const r of rows) {
    if (r.parentId && byId.has(r.parentId)) {
      const arr = childrenOf.get(r.parentId) ?? [];
      arr.push(r);
      childrenOf.set(r.parentId, arr);
    } else {
      roots.push(r);
    }
  }
  const build = (r: T, depth: number, seen: Set<string>): TreeNode<T> => {
    seen.add(r.id);
    const kids = (childrenOf.get(r.id) ?? [])
      .filter((c) => !seen.has(c.id))
      .map((c) => build(c, depth + 1, seen));
    return { row: r, depth, children: kids };
  };
  const seen = new Set<string>();
  const out = roots.filter((r) => !seen.has(r.id)).map((r) => build(r, 0, seen));
  // Defensive: any row unreached (a pure parent-cycle) surfaces as a root so
  // nothing silently vanishes. Real data can't cycle (server guard), this is safety.
  for (const r of rows) if (!seen.has(r.id)) out.push(build(r, 0, seen));
  return out;
}

/**
 * True if setting `nodeId`'s parent to `newParentId` would form a cycle — i.e.
 * `newParentId` is `nodeId` itself or a descendant of `nodeId`. Walks up the
 * ancestor chain of the proposed parent; cycle-safe.
 */
export function wouldCreateCycle(
  nodeId: string,
  newParentId: string | null,
  parentOf: ReadonlyMap<string, string | null>,
): boolean {
  if (!newParentId) return false;
  let cur: string | null = newParentId;
  const seen = new Set<string>();
  while (cur) {
    if (cur === nodeId) return true;
    if (seen.has(cur)) break;
    seen.add(cur);
    cur = parentOf.get(cur) ?? null;
  }
  return false;
}
