import { describe, it, expect } from "vitest";
import { z } from "zod";
import { parseFromSchema } from "@/server/http/form-data-schema";

function makeFd(entries: Array<[string, string]>): FormData {
  const fd = new FormData();
  for (const [k, v] of entries) fd.append(k, v);
  return fd;
}

describe("parseFromSchema — picks the right fields() reader per Zod shape", () => {
  it("z.string() → required reader (string | null)", () => {
    const schema = z.object({ name: z.string() });
    expect(parseFromSchema(makeFd([["name", "Hello"]]), schema)).toEqual({ name: "Hello" });
    expect(parseFromSchema(makeFd([]), schema)).toEqual({ name: null });
  });

  it("z.string().uuid() / .email() / .min().max() still routes to required reader", () => {
    const schema = z.object({
      id: z.string().uuid(),
      email: z.string().email(),
      title: z.string().min(1).max(100),
    });
    const fd = makeFd([
      ["id", "550e8400-e29b-41d4-a716-446655440000"],
      ["email", "x@y.z"],
      ["title", "T"],
    ]);
    expect(parseFromSchema(fd, schema)).toEqual({
      id: "550e8400-e29b-41d4-a716-446655440000",
      email: "x@y.z",
      title: "T",
    });
  });

  it("z.string().optional() → nonEmptyString (absent + empty → undefined)", () => {
    const schema = z.object({ description: z.string().optional() });
    expect(parseFromSchema(makeFd([["description", "abc"]]), schema)).toEqual({
      description: "abc",
    });
    expect(parseFromSchema(makeFd([["description", ""]]), schema)).toEqual({
      description: undefined,
    });
    expect(parseFromSchema(makeFd([]), schema)).toEqual({ description: undefined });
  });

  it("z.string().nullable().optional() → nullableString (absent → undefined, '' → null)", () => {
    const schema = z.object({ rteId: z.string().uuid().nullable().optional() });
    expect(parseFromSchema(makeFd([["rteId", "v"]]), schema)).toEqual({ rteId: "v" });
    expect(parseFromSchema(makeFd([["rteId", ""]]), schema)).toEqual({ rteId: null });
    expect(parseFromSchema(makeFd([]), schema)).toEqual({ rteId: undefined });
  });

  it("z.coerce.number().int() → required reader (Zod coerces the string)", () => {
    const schema = z.object({ headcount: z.coerce.number().int() });
    const result = parseFromSchema(makeFd([["headcount", "42"]]), schema) as {
      headcount: string | null;
    };
    expect(result.headcount).toBe("42");
    // Round-trip through the schema confirms Zod's coercion still applies.
    expect(schema.parse(result)).toEqual({ headcount: 42 });
  });

  it("z.coerce.number().int().optional() → nonEmptyString (and Zod coerces non-empty)", () => {
    const schema = z.object({ headcount: z.coerce.number().int().optional() });
    expect(parseFromSchema(makeFd([["headcount", "42"]]), schema)).toEqual({ headcount: "42" });
    expect(parseFromSchema(makeFd([["headcount", ""]]), schema)).toEqual({ headcount: undefined });
    expect(schema.parse({ headcount: undefined })).toEqual({ headcount: undefined });
  });

  it("z.enum([...]) → required reader (Zod refines)", () => {
    const schema = z.object({ severity: z.enum(["low", "high"]) });
    expect(parseFromSchema(makeFd([["severity", "high"]]), schema)).toEqual({ severity: "high" });
  });

  it("z.array(z.string()) → list reader", () => {
    const schema = z.object({ tags: z.array(z.string()) });
    const fd = makeFd([
      ["tags", "a"],
      ["tags", "b"],
      ["tags", "c"],
    ]);
    expect(parseFromSchema(fd, schema)).toEqual({ tags: ["a", "b", "c"] });
    expect(parseFromSchema(makeFd([]), schema)).toEqual({ tags: [] });
  });

  // Regression: `z.array(...).default([])` is ZodDefault<ZodArray>. Before the
  // ZodDefault-peel in unwrap(), an empty field was read as the scalar `null`
  // (fields.string) and `.default([])` did NOT catch it (default only fires on
  // `undefined`) → the action failed with "Expected array, received null".
  it("z.array(...).default([]) → list reader (empty → [], not null)", () => {
    const schema = z.object({ ids: z.array(z.string().uuid()).max(10).default([]) });
    // Absent → [] (the exact "no named people selected" case).
    const emptyRaw = parseFromSchema(makeFd([]), schema);
    expect(emptyRaw).toEqual({ ids: [] });
    expect(schema.safeParse(emptyRaw).success).toBe(true);
    // Present values are collected via getAll.
    const fd = makeFd([
      ["ids", "550e8400-e29b-41d4-a716-446655440000"],
      ["ids", "00000000-0000-0000-0000-000000000000"],
    ]);
    expect(parseFromSchema(fd, schema)).toEqual({
      ids: ["550e8400-e29b-41d4-a716-446655440000", "00000000-0000-0000-0000-000000000000"],
    });
  });

  it("z.string().default('x') stays a scalar reader (ZodDefault peel doesn't force arrays)", () => {
    const schema = z.object({ mode: z.string().default("x") });
    // Absent → null (scalar), and the schema's default then applies on parse.
    expect(parseFromSchema(makeFd([]), schema)).toEqual({ mode: null });
    expect(parseFromSchema(makeFd([["mode", "y"]]), schema)).toEqual({ mode: "y" });
  });

  it("non-object schema returns an empty object (caller hands to safeParse anyway)", () => {
    const schema = z.string();
    expect(parseFromSchema(makeFd([["x", "y"]]), schema)).toEqual({});
  });

  it("multi-field schema picks reader independently per field", () => {
    const schema = z.object({
      id: z.string().uuid(),
      name: z.string().min(1).max(100),
      description: z.string().optional(),
      rteId: z.string().uuid().nullable().optional(),
      tags: z.array(z.string()),
    });
    const fd = makeFd([
      ["id", "00000000-0000-0000-0000-000000000000"],
      ["name", "Train A"],
      ["description", ""],
      ["rteId", ""],
      ["tags", "x"],
    ]);
    expect(parseFromSchema(fd, schema)).toEqual({
      id: "00000000-0000-0000-0000-000000000000",
      name: "Train A",
      description: undefined,
      rteId: null,
      tags: ["x"],
    });
  });

  // Regression: an absent `.or(z.literal(""))`-union field is read via the plain
  // string reader → `null`. The union rejects null with Zod's generic "Invalid
  // input". The `preprocess(v => v ?? undefined, …)` wrapper (statusField /
  // ownerIdField pattern) makes the field parse cleanly when absent.
  it("clearable union field (.or('')) is null when absent — needs null→undefined normalisation", () => {
    const rawUnion = z.object({
      status: z.enum(["on_track"]).optional().or(z.literal("")),
    });
    const raw = parseFromSchema(makeFd([]), rawUnion);
    expect(raw).toEqual({ status: null });
    // Bare union rejects the null → "Invalid input".
    expect(rawUnion.safeParse(raw).success).toBe(false);

    // With the null→undefined preprocess, the absent field parses fine.
    const fixed = z.object({
      status: z.preprocess(
        (v) => v ?? undefined,
        z.enum(["on_track"]).optional().or(z.literal("")),
      ),
    });
    const fixedRaw = parseFromSchema(makeFd([]), fixed);
    const parsed = fixed.safeParse(fixedRaw);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.status).toBeUndefined();
    // "" still clears; a real value still passes.
    expect(fixed.safeParse({ status: "" }).success).toBe(true);
    expect(fixed.safeParse({ status: "on_track" }).success).toBe(true);
  });

  it("peels ZodEffects — a .superRefine()'d object still yields its shape", () => {
    // Cross-Field-Validierung wickelt das Objekt in ZodEffects. Ohne Abschälen
    // läse der Reader ein leeres Objekt und JEDES Feld wäre still weg.
    const base = z.object({ periodStart: z.string().optional(), periodEnd: z.string().optional() });
    const refined = base.superRefine((v, ctx) => {
      const s = v.periodStart ?? "";
      const e = v.periodEnd ?? "";
      if (s === "" && e === "") return;
      if (s === "" || e === "") {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "beide Grenzen" });
      }
    });
    const fd = makeFd([
      ["periodStart", "2026-01-01"],
      ["periodEnd", "2026-06-30"],
    ]);
    expect(parseFromSchema(fd, refined)).toEqual({
      periodStart: "2026-01-01",
      periodEnd: "2026-06-30",
    });

    // …und die Verfeinerung greift auf dem gelesenen Rohobjekt.
    const half = parseFromSchema(makeFd([["periodStart", "2026-01-01"]]), refined);
    expect(half).toEqual({ periodStart: "2026-01-01", periodEnd: undefined });
    expect(refined.safeParse(half).success).toBe(false);
    expect(refined.safeParse(parseFromSchema(makeFd([]), refined)).success).toBe(true);
  });

  it("peels nested ZodEffects (.refine().superRefine())", () => {
    const schema = z
      .object({ a: z.string().optional() })
      .refine(() => true)
      .superRefine(() => {});
    expect(parseFromSchema(makeFd([["a", "x"]]), schema)).toEqual({ a: "x" });
  });
});
