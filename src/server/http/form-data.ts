/**
 * A small, pure adapter over `FormData` for server-action `parseFormData`.
 *
 * The whole point is to make the **present / absent / empty** decision explicit
 * and consistent. Under `exactOptionalPropertyTypes` that is a real three-way
 * choice, and hand-rolled `fd.get(...) ?? undefined` / `|| undefined` /
 * `(x as string) || null` idioms had drifted apart across the action layer
 * (one partial-form bug already wiped a field that was merely absent).
 *
 * This produces the `unknown` that `schema.safeParse` consumes — Zod still owns
 * coercion (`z.coerce.number()`) and validation. The reader only decides
 * whether a field is a value, `undefined` (don't touch), or `null` (clear).
 */
export interface FieldReader {
  /** Required field: the raw string, or `null` when absent. Let the schema (e.g. `min(1)`/`uuid()`) reject. */
  string(key: string): string | null;
  /** Optional, empty-preserving: absent → `undefined`; present → the value (including `""`). Matches the old `?? undefined`. */
  optionalString(key: string): string | undefined;
  /** Optional, empty-collapsing: absent OR `""` → `undefined`; else the value. Matches the old `|| undefined`. */
  nonEmptyString(key: string): string | undefined;
  /** Nullable, presence-guarded: absent → `undefined` (don't touch); `""` → `null` (clear); else the value. */
  nullableString(key: string): string | null | undefined;
  /** All values for a repeated field (e.g. multi-select). Non-string entries are dropped. */
  list(key: string): string[];
  /** Escape hatch to the raw entry for bespoke handling (JSON, files). */
  raw(key: string): FormDataEntryValue | null;
  /** The underlying FormData, for cases none of the readers fit. */
  readonly fd: FormData;
}

function asString(v: FormDataEntryValue | null): string | null {
  return typeof v === "string" ? v : null;
}

/** Wrap a `FormData` in a {@link FieldReader}. */
export function fields(fd: FormData): FieldReader {
  return {
    fd,
    raw: (key) => fd.get(key),
    string: (key) => asString(fd.get(key)),
    optionalString: (key) => {
      const v = asString(fd.get(key));
      return v === null ? undefined : v;
    },
    nonEmptyString: (key) => {
      const v = asString(fd.get(key));
      return v ? v : undefined;
    },
    nullableString: (key) => {
      if (!fd.has(key)) return undefined;
      const v = asString(fd.get(key));
      return v ? v : null;
    },
    list: (key) => fd.getAll(key).filter((v): v is string => typeof v === "string"),
  };
}
