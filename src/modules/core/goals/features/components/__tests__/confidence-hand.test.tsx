import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { ConfidenceHand } from "@/modules/core/goals/features/components/confidence-hand";

/** Die Hand zeigt so viele gestreckte Finger wie der Vote, unter 3 in Rot. */
describe("ConfidenceHand", () => {
  const gestreckt = (el: Element) => el.querySelectorAll("[data-raised]").length;

  it.each([1, 2, 3, 4, 5] as const)("Wert %i streckt %i Finger", (v) => {
    const { container } = render(<ConfidenceHand value={v} />);
    expect(gestreckt(container.querySelector("svg")!)).toBe(v);
    expect(container.querySelectorAll("[data-finger]")).toHaveLength(5);
  });

  it("färbt nach dem Vote in den Status-Tönen: unter 3 rot, 3 gelb, ab 4 grün", () => {
    const ton = (v: 1 | 2 | 3 | 4 | 5) =>
      render(<ConfidenceHand value={v} />).container.querySelector("svg")!;
    expect(ton(1).getAttribute("data-tone")).toBe("rose");
    expect(ton(2).getAttribute("data-tone")).toBe("rose");
    expect(ton(3).getAttribute("data-tone")).toBe("amber");
    expect(ton(4).getAttribute("data-tone")).toBe("green");
    expect(ton(5).getAttribute("data-tone")).toBe("green");
    // Dieselbe Farbe wie Status-Pill-Punkt und Status-Ring.
    expect(ton(4).getAttribute("style")).toMatch(/color/);
  });

  it("übernimmt mit tone=„current“ die Textfarbe", () => {
    const { container } = render(<ConfidenceHand value={1} tone="current" />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("style")).toBeNull();
    expect(svg.getAttribute("data-tone")).toBeNull();
  });

  it("nennt Wert und Bedeutung", () => {
    render(<ConfidenceHand value={4} />);
    expect(screen.getByRole("img").getAttribute("aria-label")).toMatch(/4/);
  });
});
