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
