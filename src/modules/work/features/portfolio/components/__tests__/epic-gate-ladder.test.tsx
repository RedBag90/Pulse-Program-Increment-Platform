import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";

import { EpicGateLadder } from "@/modules/work/features/portfolio/components/epic-gate-ladder";

/**
 * **Die Reifegrad-Leiter zeigt Reifegrade.**
 *
 * Sie lief bis September 2026 über `GATE_STEPS` und damit über einen Schritt
 * mit, der keine Nummer trägt: „Zur Analyse ausgewählt". Die Beschriftung
 * entstand aus dem ersten Wort des Etiketts — auf der Leiter stand deshalb ein
 * Punkt namens **„Zur"**.
 */

/** Die Marken aller Punkte, in Anzeigereihenfolge. */
function marks(): string[] {
  return screen
    .getAllByRole("listitem")
    .map((li) => li.textContent?.trim() ?? "")
    .filter((t) => t !== "");
}

describe("EpicGateLadder", () => {
  it("zeigt die sieben Reifegrade — und kein abgeschnittenes Wort", () => {
    render(<EpicGateLadder current="L1" />);

    expect(marks()).toEqual(["L0", "L1", "L2", "L3", "L4.1", "L4.2", "L5"]);
    expect(screen.queryByText("Zur")).toBeNull();
  });

  it("hebt bei einem nummernlosen Schritt den Reifegrad hervor, auf dem das Epic steht", () => {
    // Ein Epic „zur Analyse ausgewählt" bleibt auf L1. Zeigte die Leiter hier
    // auf nichts, wäre der Stand für jedes Epic zwischen Hypothese und
    // Business Case unsichtbar — das ist der Fall, für den `gateOfStep` da ist.
    render(<EpicGateLadder current="analysis" />);

    const hervorgehoben = screen
      .getAllByRole("listitem")
      .filter((li) => li.querySelector(".text-primary") !== null)
      .map((li) => li.textContent?.trim());

    expect(hervorgehoben).toEqual(["L1"]);
  });

  it("markiert den erreichten Stand und lässt Späteres offen", () => {
    render(<EpicGateLadder current="L3" />);

    const punkte = screen
      .getAllByRole("listitem")
      .map((li) => li.querySelector("span[aria-hidden]:not([class*='absolute'])"));

    // L0–L2 erledigt (gefüllt), L3 jetzt (Ring), L4.1 aufwärts offen.
    expect(punkte[2]?.className).toContain("bg-primary");
    expect(punkte[3]?.className).toContain("ring-primary/20");
    expect(punkte[4]?.className).toContain("border-border");
  });

  /**
   * **Die Leiste sagt, was sie ist.** Die Auskunft stand nur im `aria-label`;
   * auf dem Bildschirm waren es sieben Punkte mit Marken und kein Wort dazu.
   *
   * Geprüft wird über den **zugänglichen Namen**, nicht über den blossen Text:
   * das deckt Überschrift und Verknüpfung in einem. Ein `SectionLabel`, das
   * danebensteht, ohne dass die Liste darauf zeigt, bestünde diesen Test nicht.
   */
  it("ist über ihre sichtbare Überschrift auffindbar", () => {
    render(<EpicGateLadder current="L1" />);

    expect(screen.getByRole("list", { name: "Reifegrad" })).toBeTruthy();
  });
});
