import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FeatureBvActual } from "@/modules/drumbeat/features/cockpit/components/feature-bv-actual";
import type { CockpitFeature } from "@/modules/drumbeat/domain/cockpit-types";

/**
 * **Der bestätigte Business Value an der Kachel** — nur bei abgeschlossenen
 * Features; die Richtung der Abweichung sagt die Farbe.
 */
const feature = (over: Partial<CockpitFeature>) =>
  ({
    status: "completed",
    wsjfBusinessValue: 8,
    wsjfBusinessValueActual: null,
    ...over,
  }) as CockpitFeature;

describe("FeatureBvActual", () => {
  it("nicht abgeschlossen: nichts", () => {
    const { container } = render(<FeatureBvActual feature={feature({ status: "in_progress" })} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("abgeschlossen, nicht bestätigt: still — die Fusszeile ist zu schmal", () => {
    const { container } = render(<FeatureBvActual feature={feature({})} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("höher bestätigt: Plan → Ist, grün", () => {
    render(<FeatureBvActual feature={feature({ wsjfBusinessValueActual: 13 })} />);
    const badge = screen.getByText("BV 8→13");
    expect(badge.className).toMatch(/success/);
  });

  it("niedriger bestätigt: bernstein", () => {
    render(<FeatureBvActual feature={feature({ wsjfBusinessValueActual: 3 })} />);
    expect(screen.getByText("BV 8→3").className).toMatch(/warning/);
  });

  it("wie geplant bestätigt: „BV 8 ✓“", () => {
    render(<FeatureBvActual feature={feature({ wsjfBusinessValueActual: 8 })} />);
    expect(screen.getByText("BV 8 ✓")).toBeInTheDocument();
  });
});
