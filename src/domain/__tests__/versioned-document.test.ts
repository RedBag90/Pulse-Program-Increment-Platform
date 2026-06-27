import { describe, it, expect } from "vitest";
import { appendVersion, parseVersionedDocument } from "@/domain/versioned-document";

interface Fields {
  title?: string;
  body?: string;
}
const hasContent = (f: Fields): boolean =>
  (f.title?.trim() ?? "") !== "" || (f.body?.trim() ?? "") !== "";

describe("parseVersionedDocument", () => {
  it("null/non-object yields the empty document", () => {
    expect(parseVersionedDocument<Fields>(null)).toEqual({ current: {}, history: [] });
    expect(parseVersionedDocument<Fields>(42)).toEqual({ current: {}, history: [] });
  });

  it("versioned shape passes through with history preserved", () => {
    const raw = {
      current: { title: "x" },
      history: [{ content: { title: "y" }, savedAt: "T", savedBy: "u" }],
    };
    expect(parseVersionedDocument<Fields>(raw)).toEqual(raw);
  });

  it("legacy-flat shape is wrapped into a versioned document with empty history", () => {
    const raw = { title: "x", body: "y" };
    expect(parseVersionedDocument<Fields>(raw)).toEqual({
      current: { title: "x", body: "y" },
      history: [],
    });
  });

  it("normalize() runs on the current fields (both legacy and versioned)", () => {
    const upper = (f: Fields): Fields => {
      const t = f.title?.toUpperCase();
      return t !== undefined ? { ...f, title: t } : f;
    };
    expect(parseVersionedDocument<Fields>({ title: "x" }, upper).current.title).toBe("X");
    expect(
      parseVersionedDocument<Fields>({ current: { title: "x" }, history: [] }, upper).current.title,
    ).toBe("X");
  });
});

describe("appendVersion", () => {
  const fixedNow = () => new Date("2026-06-27T10:00:00.000Z");

  it("snapshots previous current into history when it had content", () => {
    const result = appendVersion<Fields>({
      previous: { current: { title: "old" }, history: [] },
      nextFields: { title: "new" },
      hasContent,
      savedBy: "user-1",
      historyLimit: 5,
      now: fixedNow,
    });
    expect(result.current).toEqual({ title: "new" });
    expect(result.history).toEqual([
      { content: { title: "old" }, savedAt: "2026-06-27T10:00:00.000Z", savedBy: "user-1" },
    ]);
  });

  it("leaves history untouched when previous current was empty", () => {
    const result = appendVersion<Fields>({
      previous: { current: {}, history: [] },
      nextFields: { title: "first content" },
      hasContent,
      savedBy: "user-1",
      historyLimit: 5,
    });
    expect(result.history).toEqual([]);
  });

  it("caps the history at historyLimit (newest first)", () => {
    const previous = {
      current: { title: "v3" },
      history: [
        { content: { title: "v2" }, savedAt: "T2", savedBy: "u" },
        { content: { title: "v1" }, savedAt: "T1", savedBy: "u" },
      ],
    };
    const result = appendVersion<Fields>({
      previous,
      nextFields: { title: "v4" },
      hasContent,
      savedBy: "u",
      historyLimit: 2,
      now: fixedNow,
    });
    expect(result.history.map((v) => v.content.title)).toEqual(["v3", "v2"]);
  });
});
