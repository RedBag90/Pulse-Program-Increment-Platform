import type { z, ZodTypeAny } from "zod";
import { fields, type FieldReader } from "@/server/http/form-data";

/**
 * Schema-driven FormData reader. Walks a Zod object schema and picks the
 * matching `fields()` reader variant per field, so action authors don't have
 * to re-spell the schema in a `parseFormData` callback.
 *
 * Mapping rules (per field):
 *   - `z.array(...)`                    → `fields.list`
 *   - `z.string().nullable().optional()`→ `fields.nullableString`
 *   - `.optional()` (any inner)         → `fields.nonEmptyString`
 *   - everything else                   → `fields.string` (Zod handles
 *     coercion/refinement/enums — the reader just delivers the raw string)
 *
 * What it deliberately doesn't handle:
 *   - JSON bodies hidden in a single FormData field (`payload`-style) — the
 *     escape hatch stays: pass your own `parseFormData` callback.
 *   - Nested objects (Zod permits them but FormData is flat).
 *   - Refinements that change semantics on absent values — the reader
 *     returns the same shape your schema expects, then `schema.safeParse`
 *     refines.
 *
 * The output is `unknown` because the caller hands it straight to
 * `schema.safeParse(...)`. No type-level claim is made about field names
 * lining up — that's the schema's job.
 */
export function parseFromSchema(fd: FormData, schema: z.ZodTypeAny): unknown {
  const shape = getObjectShape(schema);
  if (!shape) {
    // Not an object schema (rare — but accepted as no-op so the call site
    // can still hand control to `safeParse`).
    return {};
  }
  const f = fields(fd);
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(shape)) {
    const field = shape[key];
    if (!field) continue;
    out[key] = readField(f, key, field);
  }
  return out;
}

function readField(f: FieldReader, key: string, type: ZodTypeAny): unknown {
  const { isArray, isOptional, isNullable } = unwrap(type);
  if (isArray) return f.list(key);
  if (isOptional && isNullable) return f.nullableString(key);
  if (isOptional) return f.nonEmptyString(key);
  return f.string(key);
}

interface UnwrappedFlags {
  isArray: boolean;
  isOptional: boolean;
  isNullable: boolean;
}

/**
 * Peels `.optional()` / `.nullable()` wrappers off a Zod type to find the
 * inner shape, recording the flags we care about. Stops at the first non-
 * wrapper (`ZodString`, `ZodNumber`, `ZodArray`, …).
 */
function unwrap(type: ZodTypeAny): UnwrappedFlags {
  let isOptional = false;
  let isNullable = false;
  let isArray = false;
  let cursor: ZodTypeAny = type;
  // Defensive ceiling; Zod schemas in this codebase nest at most ~3 deep.
  for (let depth = 0; depth < 8; depth++) {
    const name = typeName(cursor);
    if (name === "ZodOptional") {
      isOptional = true;
      cursor = cursorInner(cursor);
      continue;
    }
    if (name === "ZodNullable") {
      isNullable = true;
      cursor = cursorInner(cursor);
      continue;
    }
    if (name === "ZodDefault") {
      // `z.array(...).default([])` ⇒ ZodDefault<ZodArray>. Ohne Abschälen bricht
      // die Schleife hier ab, das Array bleibt unerkannt und wird als Skalar
      // (fields.string) gelesen — leer = `null` statt `[]`, was `z.array().default`
      // NICHT auffängt (Default greift nur bei `undefined`). Der innere Typ liegt
      // wie bei Optional/Nullable in `_def.innerType`.
      cursor = cursorInner(cursor);
      continue;
    }
    if (name === "ZodEffects") {
      // Zod's `.refine()` / `.transform()` wrap the type in ZodEffects; the
      // inner shape is what we want to inspect.
      cursor = (cursor as unknown as { _def: { schema: ZodTypeAny } })._def.schema;
      continue;
    }
    if (name === "ZodPipeline") {
      // `z.coerce.number()` becomes ZodPipeline(string → number) in some Zod
      // builds. The output type is what consumers see; reading raw strings is
      // always fine because Zod coerces.
      cursor = (cursor as unknown as { _def: { in: ZodTypeAny } })._def.in;
      continue;
    }
    if (name === "ZodArray") {
      isArray = true;
    }
    break;
  }
  return { isArray, isOptional, isNullable };
}

function typeName(type: ZodTypeAny): string {
  const def = (type as unknown as { _def?: { typeName?: string } })._def;
  return def?.typeName ?? "";
}

function cursorInner(type: ZodTypeAny): ZodTypeAny {
  return (type as unknown as { _def: { innerType: ZodTypeAny } })._def.innerType;
}

function getObjectShape(schema: z.ZodTypeAny): Record<string, ZodTypeAny> | null {
  // ZodObject exposes `shape` via the public API and `.shape` getter; the
  // safest read is `schema._def.shape()` which returns the shape map.
  //
  // `.superRefine()` / `.refine()` / `.transform()` wickeln das Objekt in
  // ZodEffects. Ohne das Abschälen läse der Reader hier `null` und lieferte ein
  // **leeres** Objekt an `safeParse` — jedes Feld einer Action mit Cross-Field-
  // Validierung wäre still weg. Deshalb erst die Effekt-Hüllen abtragen.
  let cursor: z.ZodTypeAny = schema;
  for (let depth = 0; depth < 8; depth++) {
    const def = (
      cursor as unknown as {
        _def?: {
          typeName?: string;
          shape?: () => Record<string, ZodTypeAny>;
          schema?: ZodTypeAny;
        };
      }
    )._def;
    if (def?.typeName === "ZodEffects" && def.schema) {
      cursor = def.schema;
      continue;
    }
    if (def?.typeName !== "ZodObject" || typeof def.shape !== "function") return null;
    return def.shape();
  }
  return null;
}
