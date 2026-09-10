import { describe, it, expect } from "vitest";
import {
  guideVisible,
  visibleGuides,
  preferredPerspective,
  isOwnPerspective,
  guidesForRoles,
  type WikiContext,
} from "@/modules/wiki/domain/guide-filter";
import type { Guide, Perspective } from "@/modules/wiki/domain/guide";
import { ROLES, type Role } from "@/modules/core/kernel/domain/roles";
import type { PracticeFlags } from "@/modules/core/kernel/domain/operating-model";

/**
 * Der eine bewusste Unterschied zur Rollen-Tour: **das Modul filtert, die Rolle
 * waehlt nur vor.** Eine Tour zeigt, was du tun sollst; ein Wiki soll auch
 * erklaeren, was die anderen tun — sonst versteht niemand die Uebergaben.
 * Diese Datei haelt genau das fest, damit es niemand versehentlich zu einem
 * Rollenfilter macht.
 */

const ALL_PRACTICES = new Proxy({} as PracticeFlags, { get: () => true });

function ctx(over: Partial<WikiContext> = {}): WikiContext {
  return {
    enabledModules: ["work", "budgeting", "drumbeat"],
    practices: ALL_PRACTICES,
    roles: [],
    ...over,
  };
}

const perspective = (label: string, role?: Role): Perspective => ({
  label,
  // Nur setzen, wenn es wirklich eine Rolle ist — `exactOptionalPropertyTypes`
  // unterscheidet „nicht da" von „undefined", und das Modell auch.
  ...(role != null ? { role } : {}),
  question: `Frage von ${label}?`,
  stations: [{ title: "Schritt", body: [{ kind: "paragraph", text: "Text" }] }],
});

function guide(over: Partial<Guide> = {}): Guide {
  return {
    slug: "test",
    title: "Test",
    standfirst: "Ein Vorspann, der lang genug ist, um ernst genommen zu werden.",
    teaser: "Erst dies, dann das.",
    cadence: "einmalig",
    mechanics: [{ kind: "paragraph", text: "Mechanik" }],
    perspectives: [perspective("Der Erste"), perspective("Der Zweite", ROLES.PORTFOLIO_MANAGER)],
    misconceptions: [],
    who: [],
    seeAlso: [],
    ...over,
  };
}

describe("guideVisible — Modul und Practice filtern", () => {
  it("ohne Modul-Bindung ist eine Anleitung immer sichtbar", () => {
    expect(guideVisible(guide(), ctx({ enabledModules: [] }))).toBe(true);
  });

  it("eine Budget-Anleitung verschwindet, wenn der Mandant kein Budgeting hat", () => {
    const g = guide({ module: "budgeting" });
    expect(guideVisible(g, ctx())).toBe(true);
    expect(guideVisible(g, ctx({ enabledModules: ["work"] }))).toBe(false);
  });

  it("eine abgeschaltete Practice blendet die zugehoerige Anleitung aus", () => {
    const g = guide({ practice: "wsjf" });
    expect(guideVisible(g, ctx())).toBe(true);
    expect(guideVisible(g, ctx({ practices: { wsjf: false } as PracticeFlags }))).toBe(false);
  });

  it("visibleGuides behaelt die Reihenfolge der Quelle", () => {
    const gs = [
      guide({ slug: "a" }),
      guide({ slug: "b", module: "budgeting" }),
      guide({ slug: "c" }),
    ];
    expect(visibleGuides(gs, ctx({ enabledModules: ["work"] })).map((g) => g.slug)).toEqual([
      "a",
      "c",
    ]);
  });
});

describe("Die Rolle waehlt vor — sie filtert nicht", () => {
  it("eine fremde Rolle blendet keine Anleitung aus", () => {
    const gs = [guide({ slug: "a" }), guide({ slug: "b" })];
    expect(visibleGuides(gs, ctx({ roles: [ROLES.VIEWER] })).length).toBe(2);
  });

  it("keine Perspektive verschwindet, nur weil sie einem anderen gehoert", () => {
    const g = guide();
    expect(g.perspectives.length).toBe(2);
    expect(preferredPerspective(g, [ROLES.PORTFOLIO_MANAGER])?.label).toBe("Der Zweite");
  });

  it("ohne passende Rolle steht die erste Perspektive obenauf", () => {
    expect(preferredPerspective(guide(), [ROLES.VIEWER])?.label).toBe("Der Erste");
    expect(preferredPerspective(guide(), [])?.label).toBe("Der Erste");
  });

  it("eine Perspektive ohne Rolle gehoert niemandem — auch keinem Admin", () => {
    // „Finance" und „Produkt-Manager" sind Benennungen an Feldern, keine Rollen.
    // Sie als „deine" zu markieren waere eine Behauptung, die das Rechtemodell
    // nicht deckt.
    expect(isOwnPerspective(perspective("Finance"), [ROLES.TENANT_ADMIN])).toBe(false);
  });

  it("guidesForRoles zaehlt nur, was den Leser unmittelbar angeht", () => {
    const gs = [guide({ slug: "a" }), guide({ slug: "b", perspectives: [perspective("Finance")] })];
    expect(guidesForRoles(gs, [ROLES.PORTFOLIO_MANAGER]).map((g) => g.slug)).toEqual(["a"]);
    expect(guidesForRoles(gs, [ROLES.VIEWER])).toEqual([]);
  });
});
