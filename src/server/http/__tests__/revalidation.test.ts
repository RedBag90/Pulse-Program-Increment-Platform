import { describe, it, expect, vi, beforeEach } from "vitest";

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (...args: unknown[]) => revalidatePath(...args) }));

// Imported after the mock is registered.
const { revalidateFor } = await import("@/server/http/revalidation");

beforeEach(() => revalidatePath.mockClear());

describe("revalidateFor", () => {
  it("revalidates the full path set registered for a resource", () => {
    revalidateFor("art");
    const paths = revalidatePath.mock.calls.map((c) => c[0]);
    expect(paths).toEqual(
      expect.arrayContaining(["/structure", "/art/[artId]/settings", "/value-streams/[id]"]),
    );
  });

  it("passes the 'page' type for dynamic-segment templates and omits it for static routes", () => {
    revalidateFor("art");
    const calls = Object.fromEntries(revalidatePath.mock.calls.map((c) => [c[0], c[1]]));
    expect(calls["/art/[artId]/settings"]).toBe("page"); // dynamic template
    expect(calls["/structure"]).toBeUndefined(); // static route, no type arg
  });

  it("revalidates the cross-resource pages a feature touches (epics, PI, planning)", () => {
    revalidateFor("feature");
    const paths = revalidatePath.mock.calls.map((c) => c[0]);
    expect(paths).toEqual(
      expect.arrayContaining([
        "/art/[artId]/features",
        "/portfolio/epics/[id]",
        "/feature/[featureId]",
        "/quality/features",
        "/pi/[piId]",
        "/pi-planning",
      ]),
    );
  });

  it("issues one revalidatePath call per registered path", () => {
    revalidateFor("valueStream");
    expect(revalidatePath).toHaveBeenCalledTimes(2); // /structure + /value-streams/[id]
  });
});
