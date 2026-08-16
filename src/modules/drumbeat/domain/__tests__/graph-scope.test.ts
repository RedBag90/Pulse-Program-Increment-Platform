import { describe, it, expect } from "vitest";
import {
  classifyScopedEdges,
  isValidEdgeType,
  type ScopeEdgeInput,
} from "@/modules/drumbeat/domain/graph-scope";

const scope = new Set(["a", "b"]);

function edge(fromId: string, toId: string, type: string): ScopeEdgeInput {
  return { fromId, toId, type };
}

describe("isValidEdgeType", () => {
  it("accepts the three known dependency types", () => {
    expect(isValidEdgeType("blocks")).toBe(true);
    expect(isValidEdgeType("depends_on")).toBe(true);
    expect(isValidEdgeType("relates_to")).toBe(true);
  });

  it("rejects unknown types", () => {
    expect(isValidEdgeType("owns")).toBe(false);
    expect(isValidEdgeType("")).toBe(false);
  });
});

describe("classifyScopedEdges", () => {
  it("keeps both-in-scope edges with no off-scope endpoint", () => {
    const result = classifyScopedEdges([edge("a", "b", "blocks")], scope);
    expect(result).toHaveLength(1);
    expect(result[0]!.inScope).toBe(true);
    expect(result[0]!.offScopeEndpoint).toBeNull();
    // Original edge object is preserved for view mapping.
    expect(result[0]!.edge.type).toBe("blocks");
  });

  it("flags the off-scope source (side 'from') when only the target is in scope", () => {
    const result = classifyScopedEdges([edge("x", "a", "depends_on")], scope);
    expect(result).toHaveLength(1);
    expect(result[0]!.inScope).toBe(false);
    expect(result[0]!.offScopeEndpoint).toEqual({ id: "x", side: "from" });
  });

  it("flags the off-scope target (side 'to') when only the source is in scope", () => {
    const result = classifyScopedEdges([edge("a", "y", "relates_to")], scope);
    expect(result).toHaveLength(1);
    expect(result[0]!.inScope).toBe(false);
    expect(result[0]!.offScopeEndpoint).toEqual({ id: "y", side: "to" });
  });

  it("drops edges with BOTH endpoints off-scope", () => {
    const result = classifyScopedEdges([edge("x", "y", "blocks")], scope);
    expect(result).toHaveLength(0);
  });

  it("drops edges with an invalid type (even when in scope)", () => {
    const result = classifyScopedEdges([edge("a", "b", "owns")], scope);
    expect(result).toHaveLength(0);
  });

  it("classifies a mixed batch and drops only the invalid / both-off ones", () => {
    const result = classifyScopedEdges(
      [
        edge("a", "b", "blocks"), // kept, in scope
        edge("x", "a", "depends_on"), // kept, off-scope from
        edge("b", "y", "relates_to"), // kept, off-scope to
        edge("x", "y", "blocks"), // dropped, both off
        edge("a", "b", "nope"), // dropped, invalid type
      ],
      scope,
    );
    expect(result).toHaveLength(3);
    expect(result.map((r) => r.offScopeEndpoint)).toEqual([
      null,
      { id: "x", side: "from" },
      { id: "y", side: "to" },
    ]);
  });
});
