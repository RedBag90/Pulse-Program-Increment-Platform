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
    mission: "Du fuehrst das Portfolio.",
    responsibilities: [
      { text: "Ohne Tor." },
      { text: "Nur mit Budgeting.", module: "budgeting" },
      { text: "Nur mit Stage Gates.", practice: "stageGates" },
    ],
    handoffs: [{ text: "An den RTE." }],
  },
  {
    role: "viewer",
    label: "Viewer",
    mission: "Du liest mit.",
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
    expect(out[0]!.responsibilities.map((c) => c.text)).not.toContain("Nur mit Budgeting.");
    expect(out[0]!.responsibilities.map((c) => c.text)).toContain("Ohne Tor.");
  });

  it("ein Satz fuer eine abgeschaltete Practice faellt weg", () => {
    const out = visibleRoleSheets(
      SHEETS,
      ctx({ practices: { ...DEFAULT_PRACTICES, stageGates: false } }),
    );
    expect(out[0]!.responsibilities.map((c) => c.text)).not.toContain("Nur mit Stage Gates.");
  });

  it("der Auftrag bleibt immer stehen — er ist modulneutral", () => {
    const out = visibleRoleSheets(SHEETS, ctx({ enabledModules: ["core"] }));
    expect(out[0]!.mission).toBe("Du fuehrst das Portfolio.");
  });
});

describe("Sprungziele", () => {
  it("die Anker der Rollen sind eindeutig", () => {
    const ids = SHEETS.map((s) => anchorId("r", s.label));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("Umlaute und Klammern ueberleben als Anker", () => {
    expect(anchorId("r", "RTE (Feature-QS)")).toBe("r-rte-feature-qs");
    expect(anchorId("r", "Zustaendigkeit für Größe")).toBe("r-zustaendigkeit-fuer-groesse");
  });
});
