import { ROAM_STATUSES, type RoamStatus } from "@/modules/core/kernel/domain/roam";

/**
 * Pure per-head rollup over the issue `parentId` tree. For each node it folds in
 * its own + all descendant issues: the ROAM distribution, the set of Epics the
 * subtree spans, and the descendant count. DB-free / unit-testable. Cycle-safe.
 */

export interface RollupNode {
  id: string;
  parentId: string | null;
  roamStatus: string;
  /** Owning Epic of the issue (Feature→Epic resolved by the caller); null if none. */
  epicId: string | null;
}

export interface IssueRollup {
  roamCounts: Record<RoamStatus, number>;
  spannedEpicIds: string[];
  /** Number of descendants (excludes the node itself). */
  descendantCount: number;
}

function emptyRoam(): Record<RoamStatus, number> {
  return ROAM_STATUSES.reduce(
    (acc, s) => {
      acc[s] = 0;
      return acc;
    },
    {} as Record<RoamStatus, number>,
  );
}

export function rollupIssueSubtrees(nodes: readonly RollupNode[]): Map<string, IssueRollup> {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const childrenOf = new Map<string, string[]>();
  for (const n of nodes) {
    if (n.parentId && byId.has(n.parentId)) {
      const arr = childrenOf.get(n.parentId) ?? [];
      arr.push(n.id);
      childrenOf.set(n.parentId, arr);
    }
  }

  const out = new Map<string, IssueRollup>();

  function walk(id: string, seen: Set<string>): IssueRollup {
    const cached = out.get(id);
    if (cached) return cached;
    const node = byId.get(id)!;
    seen.add(id);

    const roamCounts = emptyRoam();
    const epicIds = new Set<string>();
    let descendantCount = 0;

    const roam = (ROAM_STATUSES as readonly string[]).includes(node.roamStatus)
      ? (node.roamStatus as RoamStatus)
      : "open";
    roamCounts[roam] += 1;
    if (node.epicId) epicIds.add(node.epicId);

    for (const childId of childrenOf.get(id) ?? []) {
      if (seen.has(childId)) continue;
      const child = walk(childId, seen);
      descendantCount += 1 + child.descendantCount;
      for (const s of ROAM_STATUSES) roamCounts[s] += child.roamCounts[s];
      for (const e of child.spannedEpicIds) epicIds.add(e);
    }

    const rollup: IssueRollup = {
      roamCounts,
      spannedEpicIds: [...epicIds],
      descendantCount,
    };
    out.set(id, rollup);
    return rollup;
  }

  for (const n of nodes) if (!out.has(n.id)) walk(n.id, new Set());
  return out;
}
