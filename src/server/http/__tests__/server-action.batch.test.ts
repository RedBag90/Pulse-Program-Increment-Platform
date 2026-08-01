import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";

// Spies for the modules `createServerAction` depends on. They must be set up
// before importing the action factory so the static imports resolve to them.
const buildContextSpy = vi.fn();
const authorizeSpy = vi.fn();
const revalidateSpy = vi.fn();

vi.mock("@/server/http/request-context", () => ({
  buildRequestContext: () => buildContextSpy(),
}));
vi.mock("@/server/auth/authorize", () => ({
  authorize: (...args: unknown[]) => authorizeSpy(...args),
}));
vi.mock("@/server/http/revalidation", () => ({
  revalidateFor: (key: string) => revalidateSpy(key),
}));

// Imported after mocks so the factory sees the mocked dependencies.
import { createServerAction } from "@/server/http/server-action";
import { ok, err } from "@/domain/errors";

const tenantCtx = {
  principal: {
    id: "u1",
    tenantId: "t1",
    email: "",
    roles: [],
    scopes: { artIds: [], teamIds: [], valueStreamIds: [] },
    tenantKind: "organization",
    isPlatformAdmin: false,
    enabledModules: [
      "ziele",
      "portfolio",
      "program",
      "controlling",
      "roadmap",
      "reporting",
      "structure",
      "admin",
    ],
  },
  db: {},
} as unknown;

beforeEach(() => {
  buildContextSpy.mockReset();
  authorizeSpy.mockReset();
  revalidateSpy.mockReset();
  buildContextSpy.mockResolvedValue(tenantCtx);
  authorizeSpy.mockReturnValue({ allow: true });
});

function fdFromObject(o: Record<string, string | string[]>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(o)) {
    if (Array.isArray(v)) {
      for (const item of v) fd.append(k, item);
    } else {
      fd.set(k, v);
    }
  }
  return fd;
}

const schema = z.object({
  ids: z.array(z.string()).min(1),
  piId: z.string(),
});

describe("createServerAction — batch mode", () => {
  it("calls service once per item, threads `rest` of the input", async () => {
    const calls: Array<{ item: string; rest: { piId: string } }> = [];
    const action = createServerAction({
      schema,
      action: "feature.update",
      resource: (_input, p) => ({ tenantId: p.tenantId }),
      batch: {
        iterateOver: "ids",
        service: async (_ctx, item, rest) => {
          calls.push({ item, rest: { piId: rest.piId } });
          return ok({});
        },
      },
    });
    const state = await action({}, fdFromObject({ ids: ["a", "b", "c"], piId: "p" }));
    expect(state).toEqual({ success: true });
    expect(calls).toEqual([
      { item: "a", rest: { piId: "p" } },
      { item: "b", rest: { piId: "p" } },
      { item: "c", rest: { piId: "p" } },
    ]);
  });

  it("folds per-item warnings into state.warnings", async () => {
    const action = createServerAction({
      schema,
      action: "feature.update",
      resource: (_input, p) => ({ tenantId: p.tenantId }),
      batch: {
        iterateOver: "ids",
        service: async (_ctx, item) => ok({ warnings: [`warn-${item}`] }),
        foldWarnings: (out) => out.warnings,
      },
    });
    const state = await action({}, fdFromObject({ ids: ["a", "b"], piId: "p" }));
    expect(state).toEqual({ success: true, warnings: ["warn-a", "warn-b"] });
  });

  it("stops on first error by default and applies mapError once", async () => {
    const mapError = vi.fn(() => "mapped");
    const action = createServerAction({
      schema,
      action: "feature.update",
      resource: (_input, p) => ({ tenantId: p.tenantId }),
      batch: {
        iterateOver: "ids",
        service: async (_ctx, item) =>
          item === "b" ? err({ kind: "conflict" as const, reason: "boom" }) : ok({}),
      },
      mapError,
    });
    const state = await action({}, fdFromObject({ ids: ["a", "b", "c"], piId: "p" }));
    expect(state).toEqual({ error: "mapped" });
    expect(mapError).toHaveBeenCalledTimes(1);
  });

  it("continueOnError: true keeps iterating; reports first error + collected warnings", async () => {
    const action = createServerAction({
      schema,
      action: "feature.update",
      resource: (_input, p) => ({ tenantId: p.tenantId }),
      batch: {
        iterateOver: "ids",
        continueOnError: true,
        service: async (_ctx, item) => {
          if (item === "b") return err({ kind: "conflict" as const, reason: "boom" });
          return ok({ warnings: [`warn-${item}`] });
        },
        foldWarnings: (out) => out.warnings,
      },
      mapError: (e) => (e.kind === "conflict" ? e.reason : "fallback"),
    });
    const state = await action({}, fdFromObject({ ids: ["a", "b", "c"], piId: "p" }));
    expect(state.error).toBe("boom");
    expect(state.warnings).toEqual(["warn-a", "warn-c"]);
  });

  it("does not call revalidate on error", async () => {
    const action = createServerAction({
      schema,
      action: "feature.update",
      resource: (_input, p) => ({ tenantId: p.tenantId }),
      batch: {
        iterateOver: "ids",
        service: async () => err({ kind: "conflict" as const, reason: "boom" }),
      },
      revalidate: "feature",
      mapError: (e) => (e.kind === "conflict" ? e.reason : "fallback"),
    });
    await action({}, fdFromObject({ ids: ["a"], piId: "p" }));
    expect(revalidateSpy).not.toHaveBeenCalled();
  });

  it("revalidates once on batch success (not once per item)", async () => {
    const action = createServerAction({
      schema,
      action: "feature.update",
      resource: (_input, p) => ({ tenantId: p.tenantId }),
      batch: {
        iterateOver: "ids",
        service: async () => ok({}),
      },
      revalidate: "feature",
    });
    await action({}, fdFromObject({ ids: ["a", "b", "c"], piId: "p" }));
    expect(revalidateSpy).toHaveBeenCalledTimes(1);
    expect(revalidateSpy).toHaveBeenCalledWith("feature");
  });

  it("rejects when the iterated field is missing the array shape", async () => {
    // The Zod schema requires array(min 1); validation rejects before batch runs.
    const action = createServerAction({
      schema,
      action: "feature.update",
      resource: (_input, p) => ({ tenantId: p.tenantId }),
      batch: {
        iterateOver: "ids",
        service: async () => ok({}),
      },
    });
    const state = await action({}, fdFromObject({ piId: "p" }));
    expect(state.error).toBeDefined();
    expect(state.success).toBeUndefined();
  });
});
