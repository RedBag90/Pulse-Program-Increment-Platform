import { describe, it, expect, vi, beforeEach } from "vitest";

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (...args: unknown[]) => revalidatePath(...args) }));

// Imported after the mock is registered.
const { revalidateFor, REGISTRY } = await import("@/server/http/revalidation");

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

  it("issues one revalidatePath call per registered path — genau einen, keinen doppelt", () => {
    revalidateFor("valueStream");
    const paths = revalidatePath.mock.calls.map((c) => c[0]);
    // Aus der Registry abgeleitet statt abgeschrieben: eine neue Route in der
    // Gruppe ist eine Erweiterung, kein Fehlschlag.
    expect(paths).toHaveLength(REGISTRY.valueStream.length);
    expect(new Set(paths).size).toBe(paths.length);
    expect(paths).toEqual(expect.arrayContaining([...REGISTRY.valueStream]));
  });

  // Die Rollenverteilung schreibt über alle drei Ebenen; nach dem Benennen muss
  // sie den neuen Stand zeigen, ohne dass jemand neu lädt.
  it("frischt die Rollenverteilung auf, egal welche Ebene benannt wurde", () => {
    for (const resource of ["valueStream", "art", "solution"] as const) {
      revalidatePath.mockClear();
      revalidateFor(resource);
      expect(
        revalidatePath.mock.calls.map((c) => c[0]),
        resource,
      ).toContain("/structure/rollen");
    }
  });

  /**
   * **Die Flächen, auf denen ein eigenständiges Feature erscheint.** Für es ist
   * `/portfolio/epics/[id]` wirkungslos — es hat keine solche Seite. Ohne diese
   * vier Pfade bliebe es nach dem Anlegen sichtbar veraltet; genau das ist im
   * Haus schon zweimal passiert.
   */
  it("revalidiert für ein Feature auch die Flächen ohne Epic-Bezug", () => {
    for (const p of [
      "/umsetzung",
      "/implementation/features",
      "/portfolio",
      "/structure/solution/[id]",
    ]) {
      expect(REGISTRY.feature).toContain(p);
    }
  });
});
