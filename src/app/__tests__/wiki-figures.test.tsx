import { describe, it, expect } from "vitest";
import { resolveFigures } from "@/app/[locale]/(dashboard)/wiki/_figures";
import { GUIDES } from "@/modules/wiki/domain/guides";
import type { Block } from "@/modules/wiki/domain/blocks";

/**
 * **Die Naht zwischen Wiki und Modulen.** Das Wiki benennt eine Figur nur
 * (`{ kind: "figure", figure: "horizonLadder" }`); aufgeloest wird sie im
 * App-Root, der einzigen Schicht, die mehrere Module verdrahten darf
 * (ADR-0013). Der Renderer laesst eine unaufgeloeste Figur **lautlos** aus —
 * damit eine Anleitung nicht zerreisst, aber eben auch, ohne dass es auffiele.
 *
 * Dieser Test ist der Ersatz fuer das Auffallen: wer eine Figur in einer
 * Anleitung benutzt und hier nicht anbietet, bekommt es rot statt still.
 */

const USED = new Set(
  GUIDES.flatMap((g) => [
    ...g.mechanics,
    ...g.perspectives.flatMap((p) => p.stations.flatMap((s) => s.body)),
  ])
    .filter((b): b is Extract<Block, { kind: "figure" }> => b.kind === "figure")
    .map((b) => b.figure),
);

describe("Wiki-Figuren", () => {
  it("jede benutzte Figur wird vom App-Root aufgeloest", () => {
    const figures = resolveFigures();
    const unresolved = [...USED].filter((f) => figures[f] == null);
    expect(unresolved).toEqual([]);
  });

  it("keine Figur wird angeboten, die keine Anleitung benutzt", () => {
    // Andersherum ebenso: eine Figur ohne Leser ist toter Code, der bei jeder
    // Domaenen-Aenderung mitgepflegt werden will.
    const orphans = Object.keys(resolveFigures()).filter((f) => !USED.has(f as never));
    expect(orphans).toEqual([]);
  });
});
