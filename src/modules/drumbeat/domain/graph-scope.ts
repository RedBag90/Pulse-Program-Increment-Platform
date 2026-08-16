/**
 * Pure scope-classification for dependency graphs (Drumbeat).
 *
 * Single owner for a rule that TWO server views used to derive
 * independently: given a set of in-scope feature ids and a list of
 * dependency edges (`fromId`/`toId`/`type`), decide per edge
 *   1. is the `type` a valid dependency type (else drop),
 *   2. are BOTH endpoints off-scope (else drop),
 *   3. which single endpoint (if any) is off-scope, and on which side.
 *
 * The output is a CANONICAL shape (`ScopedEdge`); each view maps it into
 * its own render model (Breakdown ghost nodes, Cockpit off-scope roles).
 *
 * Pure: no React, no dagre, no I/O, no Date.
 */

export const DEPENDENCY_TYPES = ["blocks", "depends_on", "relates_to"] as const;
export type DependencyType = (typeof DEPENDENCY_TYPES)[number];

/** Type-guard: drops edges whose persisted `type` isn't a known dependency type. */
export function isValidEdgeType(t: string): t is DependencyType {
  return t === "blocks" || t === "depends_on" || t === "relates_to";
}

/** Minimal edge shape the classifier reads. Callers may pass richer objects
 *  (e.g. with `from`/`to` join info) — those pass through untouched on `edge`. */
export interface ScopeEdgeInput {
  fromId: string;
  toId: string;
  type: string;
}

/**
 * Canonical per-edge classification.
 * - `edge` — the original input object (join fields preserved for mapping).
 * - `inScope` — true when BOTH endpoints are in scope (fully renderable).
 * - `offScopeEndpoint` — the single off-scope endpoint + which side it sits
 *   on (`from` = predecessor, `to` = successor), or `null` when both in scope.
 */
export interface ScopedEdge<E extends ScopeEdgeInput = ScopeEdgeInput> {
  edge: E;
  inScope: boolean;
  offScopeEndpoint: { id: string; side: "from" | "to" } | null;
}

/**
 * Classify dependency edges against an in-scope id set.
 *
 * Drops (omits from the result):
 *   - edges with an invalid `type`,
 *   - edges with BOTH endpoints off-scope.
 *
 * Kept edges carry exactly one off-scope endpoint (`offScopeEndpoint != null`)
 * or none (`inScope === true`).
 */
export function classifyScopedEdges<E extends ScopeEdgeInput>(
  edges: readonly E[],
  scopeIds: Set<string>,
): ScopedEdge<E>[] {
  const out: ScopedEdge<E>[] = [];
  for (const edge of edges) {
    if (!isValidEdgeType(edge.type)) continue;
    const fromInScope = scopeIds.has(edge.fromId);
    const toInScope = scopeIds.has(edge.toId);
    if (!fromInScope && !toInScope) continue;
    const offScopeEndpoint = !fromInScope
      ? { id: edge.fromId, side: "from" as const }
      : !toInScope
        ? { id: edge.toId, side: "to" as const }
        : null;
    out.push({ edge, inScope: fromInScope && toInScope, offScopeEndpoint });
  }
  return out;
}
