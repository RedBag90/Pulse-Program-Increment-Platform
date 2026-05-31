/**
 * Detects whether adding a directed edge proposedFrom→proposedTo would create
 * a cycle, given the set of existing directed edges.
 *
 * Uses BFS from proposedTo: if we can reach proposedFrom by following existing
 * edges, the proposed edge would close a cycle.
 */
export function detectCycle(
  proposedFrom: string,
  proposedTo: string,
  existingEdges: ReadonlyArray<{ fromId: string; toId: string }>,
): boolean {
  if (proposedFrom === proposedTo) return true;

  const visited = new Set<string>();
  const queue: string[] = [proposedTo];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === proposedFrom) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    for (const edge of existingEdges) {
      if (edge.fromId === current) queue.push(edge.toId);
    }
  }

  return false;
}

// ---------------------------------------------------------------------------
// Earliest-PI derivation — turns a Feature's upstream dependencies into the
// earliest calendar date it can plausibly start: the day after the latest
// scheduled blocker ends. Used by the PI Planning board to warn (not block)
// on too-early assignments, and by the Feature detail page to surface the
// constraint inline.
// ---------------------------------------------------------------------------

/** One upstream constraint feeding `earliestStartFromBlockers`. */
export interface BlockerWindow {
  blockerId: string;
  blockerTitle: string;
  /** `null` when the blocker is itself unscheduled (then it contributes uncertainty, not a date). */
  blockerEndDate: Date | null;
}

/**
 * The earliest start a Feature can claim given its direct blockers. Returns
 * `earliest = null` when no blocker has a date (the constraint is "unknown"
 * rather than "anywhere"). `unscheduledBlockers` carries the titles of
 * blockers without a PI so the UI can surface "wegen unscheduled F-12".
 *
 * Pure — no Prisma, no I/O. The graph traversal (one-hop direct dependencies)
 * happens at the service layer; this function just folds the windows.
 */
export function earliestStartFromBlockers(blockers: readonly BlockerWindow[]): {
  earliest: Date | null;
  unscheduledBlockers: string[];
} {
  let latest: Date | null = null;
  const unscheduled: string[] = [];
  for (const b of blockers) {
    if (b.blockerEndDate === null) {
      unscheduled.push(b.blockerTitle);
      continue;
    }
    if (latest === null || b.blockerEndDate > latest) latest = b.blockerEndDate;
  }
  return { earliest: latest, unscheduledBlockers: unscheduled };
}
