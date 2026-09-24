import { describe, it, expect } from "vitest";
import { anchorId } from "@/modules/wiki/domain/anchor";
import { visibleRoleSheets, type RoleSheet } from "@/modules/wiki/domain/role-sheet";
import type { WikiContext } from "@/modules/wiki/domain/guide-filter";
import { DEFAULT_PRACTICES } from "@/modules/core/kernel/domain/operating-model";

/**
 * Die eine Regel, die diese Flaeche von der Rollen-Tour unterscheidet: **die
 * Rolle des Lesers filtert nicht.** Sie ist leicht wieder zu verlieren — auf
 * `/meine-rolle` filtert sie naemlich sehr wohl, und wer beide Flaechen kennt,
 * haelt es fuer einen Fehler. Deshalb steht sie hier als Test und nicht nur als
 * Satz im Kopf der Datei.
 */

function ctx(over: Partial<WikiContext> = {}): WikiContext {
  return {
    enabledModules: ["core", "work", "budgeting", "drumbeat", "risks"],
    practices: { ...DEFAULT_PRACTICES },
    roles: [],
    ...over,
  };
}

const SHEETS: RoleSheet[] = [
  {
    role: "portfolio_manager",
    label: "Portfolio Manager",
    missionKey: "Du fuehrst das Portfolio.",
    responsibilities: [
      { textKey: "Ohne Tor." },
      { textKey: "Nur mit Budgeting.", module: "budgeting" },
      { textKey: "Nur mit Stage Gates.", practice: "stageGates" },
    ],
    handoffs: [{ textKey: "An den RTE." }],
  },
  {
    role: "viewer",
    label: "Viewer",
    missionKey: "Du liest mit.",
    responsibilities: [],
    handoffs: [],
  },
];

describe("visibleRoleSheets", () => {
  it("laesst alle Blaetter stehen — auch fuer einen Leser ganz ohne Rolle", () => {
    const out = visibleRoleSheets(SHEETS, ctx({ roles: [] }));
    expect(out.map((s) => s.role)).toEqual(["portfolio_manager", "viewer"]);
  });

  it("die Rolle des Lesers aendert nichts am Inhalt", () => {
    const fremd = visibleRoleSheets(SHEETS, ctx({ roles: ["viewer"] }));
    const eigen = visibleRoleSheets(SHEETS, ctx({ roles: ["portfolio_manager"] }));
    expect(fremd).toEqual(eigen);
  });

  it("ein Satz fuer ein nicht gebuchtes Modul faellt weg", () => {
    const out = visibleRoleSheets(SHEETS, ctx({ enabledModules: ["core", "work"] }));
    expect(out[0]!.responsibilities.map((c) => c.textKey)).not.toContain("Nur mit Budgeting.");
    expect(out[0]!.responsibilities.map((c) => c.textKey)).toContain("Ohne Tor.");
  });

  it("ein Satz fuer eine abgeschaltete Practice faellt weg", () => {
    const out = visibleRoleSheets(
      SHEETS,
      ctx({ practices: { ...DEFAULT_PRACTICES, stageGates: false } }),
    );
    expect(out[0]!.responsibilities.map((c) => c.textKey)).not.toContain("Nur mit Stage Gates.");
  });

  it("der Auftrag bleibt immer stehen — er ist modulneutral", () => {
    const out = visibleRoleSheets(SHEETS, ctx({ enabledModules: ["core"] }));
    expect(out[0]!.missionKey).toBe("Du fuehrst das Portfolio.");
  });
});

describe("Sprungziele", () => {
  it("die Anker der Rollen sind eindeutig", () => {
    const ids = SHEETS.map((s) => anchorId("r", s.label));
    expect(new Set(ids).size).toBe(ids.length);
  });

  // „RTE (Feature-QS)" ist seit September 2026 kein Rollen-Label mehr (die
  // Feature-QS fiel 2026-06 weg). Der String bleibt hier als Beispiel stehen,
  // weil er Klammern **und** Bindestrich traegt — geprueft wird die Anker-Bildung,
  // nicht das Label.
  it("Umlaute und Klammern ueberleben als Anker", () => {
    expect(anchorId("r", "RTE (Feature-QS)")).toBe("r-rte-feature-qs");
    expect(anchorId("r", "Zustaendigkeit für Größe")).toBe("r-zustaendigkeit-fuer-groesse");
  });
});
