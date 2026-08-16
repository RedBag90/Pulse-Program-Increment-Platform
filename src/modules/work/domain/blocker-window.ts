/**
 * Pure edge → blocker-window projection, in one place.
 *
 * A Feature F is "blocked by" X when either
 *   • an edge `X → F` of type `blocks` exists (X actively blocks F), or
 *   • an edge `F → X` of type `depends_on` exists (F waits on X).
 * `relates_to` edges are purely informational and produce no window.
 *
 * Both consumers of this rule share the definition: Work's `setFeaturePi`
 * (earliest-start advisory) and Drumbeat's `getBlockerWindowsForFeatures`
 * (which imports DOWN into Work, ADR-0013). The one-hop `dependency` query
 * stays at each service; only the mapping lives here.
 *
 * Pure — no Prisma, no I/O, no Date construction.
 */

import type { BlockerWindow } from "@/modules/core/kernel/domain/dependency-graph";

export type { BlockerWindow };

/** A dependency edge, reduced to what the projection reads. */
export interface BlockerEdge {
  type: string;
  fromId: string;
  toId: string;
  from: { id: string; title: string; pi?: { endDate: Date | null } | null } | null;
  to: { id: string; title: string; pi?: { endDate: Date | null } | null } | null;
}

/**
 * Projects blocker edges onto one blocker-window list per in-scope Feature.
 * The blocker side is the `from` of a `blocks` edge and the `to` of a
 * `depends_on` edge; the opposite endpoint is the Feature. Edges whose Feature
 * endpoint is not in `featureIds` (off-scope), or whose blocker endpoint is
 * missing, are skipped. Insertion order of the input is preserved per Feature.
 */
export function blockerWindowsFromEdges(
  edges: readonly BlockerEdge[],
  featureIds: ReadonlySet<string>,
): Map<string, BlockerWindow[]> {
  const out = new Map<string, BlockerWindow[]>();
  for (const e of edges) {
    // For 'blocks' the *from* side is the blocker; for 'depends_on' the *to* side is.
    const isBlocks = e.type === "blocks";
    const featureSide = isBlocks ? e.toId : e.fromId;
    const blocker = isBlocks ? e.from : e.to;
    if (!blocker) continue;
    if (!featureIds.has(featureSide)) continue;
    const list = out.get(featureSide) ?? [];
    list.push({
      blockerId: blocker.id,
      blockerTitle: blocker.title,
      blockerEndDate: blocker.pi?.endDate ?? null,
    });
    out.set(featureSide, list);
  }
  return out;
}
