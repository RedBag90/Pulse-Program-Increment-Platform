// ---------------------------------------------------------------------------
// Domain error types
// ---------------------------------------------------------------------------

export type DomainError =
  | { kind: "hierarchy_violation"; violatedConstraint: string; detail: string }
  | { kind: "not_found"; resourceType: string; id: string }
  | { kind: "forbidden"; reason: string }
  | { kind: "conflict"; reason: string }
  | { kind: "validation"; issues: unknown[] }
  | { kind: "tenant_mismatch"; detail: string };

// ---------------------------------------------------------------------------
// Result monad — services return this, never throw for expected errors
// ---------------------------------------------------------------------------

export type Result<T, E = DomainError> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E extends DomainError>(error: E): Result<never, E> {
  return { ok: false, error };
}

export function isOk<T, E>(
  result: Result<T, E>,
): result is { readonly ok: true; readonly value: T } {
  return result.ok;
}

export function isErr<T, E>(
  result: Result<T, E>,
): result is { readonly ok: false; readonly error: E } {
  return !result.ok;
}
