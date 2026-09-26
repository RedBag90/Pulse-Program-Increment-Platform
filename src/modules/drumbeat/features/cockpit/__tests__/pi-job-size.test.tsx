import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PiJobSize } from "@/modules/drumbeat/features/cockpit/components/pi-job-size";
import type { CockpitPiSlot } from "@/modules/drumbeat/domain/cockpit-types";

/**
 * **Unter dem PI-Titel steht, wie viel Arbeit darin liegt.**
 *
 * Vorher stand dort nur eine Anzahl — drei kleine Features sind aber nicht
 * dasselbe wie drei grosse. Die Kapazität war gepflegt (`setPiCapacity`) und
 * wurde gegen nichts gestellt.
 */

const pi = (over: Partial<CockpitPiSlot>): CockpitPiSlot => ({
  id: "pi1",
  name: "PI 1",
  startDate: new Date(0),
  endDate: new Date(0),
  status: "planned",
  featureCount: 0,
  plannedJobSize: 0,
  capacityJobSize: null,
  isCurrent: false,
  ...over,
});

describe("PiJobSize", () => {
  it("zeigt die Summe, wenn keine Kapazität hinterlegt ist", () => {
    render(<PiJobSize pi={pi({ plannedJobSize: 18 })} />);
    expect(screen.getByText("18 JS")).toBeInTheDocument();
  });

  it("stellt sie gegen die Kapazität, sobald eine da ist", () => {
    render(<PiJobSize pi={pi({ plannedJobSize: 18, capacityJobSize: 25 })} />);
    expect(screen.getByText("18 / 25 JS")).toBeInTheDocument();
  });

  it("färbt die Überbuchung", () => {
    render(<PiJobSize pi={pi({ plannedJobSize: 30, capacityJobSize: 25 })} />);
    expect(screen.getByText("30 / 25 JS").className).toContain("text-destructive");
  });

  it("schweigt, wenn nichts bewertet und nichts hinterlegt ist", () => {
    // Eine „0 JS" unter jedem PI wäre Rauschen, kein Signal.
    const { container } = render(<PiJobSize pi={pi({})} />);
    expect(container.textContent).toBe("");
  });

  it("zeigt eine Kapazität auch ohne eingeplante Arbeit", () => {
    // „0 / 25" ist eine Aussage: der Zeitraum ist frei.
    render(<PiJobSize pi={pi({ capacityJobSize: 25 })} />);
    expect(screen.getByText("0 / 25 JS")).toBeInTheDocument();
  });
});
