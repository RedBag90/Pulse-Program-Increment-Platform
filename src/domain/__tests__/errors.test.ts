import { describe, it, expect } from "vitest";
import { ok, err, isOk, isErr } from "@/domain/errors";
import type { DomainError } from "@/domain/errors";

describe("Result helpers", () => {
  it("ok() creates a successful result", () => {
    const result = ok("hello");
    expect(result.ok).toBe(true);
    if (isOk(result)) {
      expect(result.value).toBe("hello");
    }
  });

  it("err() creates a failed result", () => {
    const error: DomainError = { kind: "not_found", resourceType: "Epic", id: "abc-123" };
    const result = err(error);
    expect(result.ok).toBe(false);
    if (isErr(result)) {
      expect(result.error.kind).toBe("not_found");
    }
  });

  it("isOk() narrows to the success branch", () => {
    const result = ok(42);
    expect(isOk(result)).toBe(true);
    expect(isErr(result)).toBe(false);
  });

  it("isErr() narrows to the failure branch", () => {
    const error: DomainError = { kind: "forbidden", reason: "insufficient role" };
    const result = err(error);
    expect(isErr(result)).toBe(true);
    expect(isOk(result)).toBe(false);
  });

  it("all DomainError kinds are constructable", () => {
    const errors: DomainError[] = [
      { kind: "hierarchy_violation", violatedConstraint: "I1", detail: "level mismatch" },
      { kind: "not_found", resourceType: "Feature", id: "x" },
      { kind: "forbidden", reason: "wrong role" },
      { kind: "conflict", reason: "duplicate key" },
      { kind: "validation", issues: [{ message: "required" }] },
      { kind: "tenant_mismatch", detail: "parent belongs to different tenant" },
    ];
    expect(errors).toHaveLength(6);
    errors.forEach((e) => expect(e.kind).toBeDefined());
  });
});
