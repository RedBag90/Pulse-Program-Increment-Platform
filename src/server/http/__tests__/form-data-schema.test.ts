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
});
