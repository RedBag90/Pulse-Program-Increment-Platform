import { describe, it, expect } from "vitest";

import { canOpenArt, canOpenValueStream } from "@/modules/core/org/domain/structure-access";

const NONE = { valueStreamIds: [], artIds: [] };
const VS_SCOPE = { valueStreamIds: ["vs-a"], artIds: [] };
const ART_SCOPE = { valueStreamIds: [], artIds: ["art-1"] };

const vsA = { id: "vs-a", artIds: ["art-1", "art-2"] };
const vsB = { id: "vs-b", artIds: ["art-9"] };

describe("canOpenValueStream", () => {
  it("ohne Scope ist alles offen", () => {
    expect(canOpenValueStream(NONE, vsA)).toBe(true);
    expect(canOpenValueStream(NONE, vsB)).toBe(true);
  });

  it("mit Wertstrom-Scope nur der eigene", () => {
    expect(canOpenValueStream(VS_SCOPE, vsA)).toBe(true);
    expect(canOpenValueStream(VS_SCOPE, vsB)).toBe(false);
  });

  // Der Fall, der bei einer zu engen Regel zuerst bricht: ein RTE „besitzt"
  // keinen Wertstrom, arbeitet aber in einem.
  it("öffnet den Wertstrom, in dem der eigene ART liegt", () => {
    expect(canOpenValueStream(ART_SCOPE, vsA)).toBe(true);
    expect(canOpenValueStream(ART_SCOPE, vsB)).toBe(false);
  });

  it("ein Wertstrom ohne ARTs sperrt bei fremdem ART-Scope", () => {
    expect(canOpenValueStream(ART_SCOPE, { id: "vs-leer", artIds: [] })).toBe(false);
  });
});

describe("canOpenArt", () => {
  const art1 = { id: "art-1", valueStreamId: "vs-a" };
  const art9 = { id: "art-9", valueStreamId: "vs-b" };

  it("ohne Scope ist alles offen", () => {
    expect(canOpenArt(NONE, art1)).toBe(true);
    expect(canOpenArt(NONE, art9)).toBe(true);
  });

  it("mit ART-Scope nur der eigene", () => {
    expect(canOpenArt(ART_SCOPE, art1)).toBe(true);
    expect(canOpenArt(ART_SCOPE, art9)).toBe(false);
  });

  // Wer den Wertstrom verantwortet, kommt an jeden ART darin.
  it("mit Wertstrom-Scope alle ARTs dieses Wertstroms", () => {
    expect(canOpenArt(VS_SCOPE, art1)).toBe(true);
    expect(canOpenArt(VS_SCOPE, art9)).toBe(false);
  });

  it("ein ausdrücklicher ART-Scope schlägt den Wertstrom-Scope", () => {
    const both = { valueStreamIds: ["vs-b"], artIds: ["art-1"] };
    expect(canOpenArt(both, art1)).toBe(true);
    // `art-9` liegt im gescopten Wertstrom, steht aber nicht in der ART-Liste —
    // die engere Angabe gewinnt, sonst wäre sie wirkungslos.
    expect(canOpenArt(both, art9)).toBe(false);
  });
});
