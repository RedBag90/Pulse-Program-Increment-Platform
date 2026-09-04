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
      expect.arrayContaining(["/structure", "/structure/art/[id]", "/structure/value-stream/[id]"]),
    );
  });

  it("passes the 'page' type for dynamic-segment templates and omits it for static routes", () => {
    revalidateFor("art");
    const calls = Object.fromEntries(revalidatePath.mock.calls.map((c) => [c[0], c[1]]));
    expect(calls["/structure/art/[id]"]).toBe("page"); // dynamic template
    expect(calls["/structure"]).toBeUndefined(); // static route, no type arg
  });

  it("revalidates the cross-resource pages a feature touches (epics, PI, planning)", () => {
    revalidateFor("feature");
    const paths = revalidatePath.mock.calls.map((c) => c[0]);
    expect(paths).toEqual(
      expect.arrayContaining([
        "/umsetzung/feature/[id]",
        "/portfolio/epics/[id]",
        "/feature/[featureId]",
        "/pi/[piId]",
        "/pi-planning",
      ]),
    );
  });

  it("issues one revalidatePath call per registered path", () => {
    revalidateFor("valueStream");
    // /structure + /structure/value-stream/[id] + /budgeting/value-streams/[id]:
    // die Budget-Fläche des Wertstroms lebt seit dem Umzug unter /budgeting.
    expect(revalidatePath).toHaveBeenCalledTimes(3);
  });
});
