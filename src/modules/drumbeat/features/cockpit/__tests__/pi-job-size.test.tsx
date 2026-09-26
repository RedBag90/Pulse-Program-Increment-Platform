import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  PiJobSize,
  PiTargetDerivation,
} from "@/modules/drumbeat/features/cockpit/components/pi-job-size";
import type { CockpitPiSlot } from "@/modules/drumbeat/domain/cockpit-types";
import type { JobSizeTarget } from "@/modules/drumbeat/domain/pi-job-size-target";

/**
 * **Unter dem PI-Titel steht, wie viel Arbeit darin liegt — gegen ein Ziel,
 * das sich nachrechnen lässt.**
 *
 * Bis September 2026 war das Ziel eine eingetippte Zahl. Jetzt entsteht es aus
 * der Kapazität und der Lieferung der letzten PIs, und die Rechnung steht
 * daneben.
 */

const pi = (over: Partial<CockpitPiSlot>): CockpitPiSlot => ({
  id: "pi1",
  name: "PI 1",
  startDate: new Date(0),
  endDate: new Date(0),
  status: "planned",
  featureCount: 0,
  plannedJobSize: 0,
  capacity: null,
  jobSizeTarget: null,
  deliveredPerCapacity: null,
  isCurrent: false,
  ...over,
});

const ziel = (over: Partial<JobSizeTarget>): JobSizeTarget => ({
  target: 25,
  perCapacity: 12.5,
  basis: [
    { piId: "a", name: "PI 0", capacity: 2, delivered: 25, ratio: 12.5 },
    { piId: "b", name: "PI -1", capacity: 2, delivered: 25, ratio: 12.5 },
  ],
  reason: "ok",
  ...over,
});

describe("PiJobSize", () => {
  it("zeigt die Summe, wenn es kein Ziel gibt", () => {
    render(<PiJobSize pi={pi({ plannedJobSize: 18 })} />);
    expect(screen.getByText("18 JS")).toBeInTheDocument();
  });

  it("stellt sie gegen das errechnete Ziel", () => {
    render(<PiJobSize pi={pi({ plannedJobSize: 18, jobSizeTarget: ziel({}) })} />);
    expect(screen.getByText("18 / 25 JS")).toBeInTheDocument();
  });

  it("färbt die Überplanung", () => {
    render(<PiJobSize pi={pi({ plannedJobSize: 30, jobSizeTarget: ziel({}) })} />);
    expect(screen.getByText("30 / 25 JS").className).toContain("text-destructive");
  });

  it("schweigt, wenn nichts bewertet ist und kein Ziel entsteht", () => {
    const { container } = render(
      <PiJobSize pi={pi({ jobSizeTarget: ziel({ target: null, reason: "noCapacity" }) })} />,
    );
    expect(container.textContent).toBe("");
  });

  it("zeigt ein Ziel auch ohne eingeplante Arbeit", () => {
    // „0 / 25" ist eine Aussage: der Zeitraum ist frei.
    render(<PiJobSize pi={pi({ jobSizeTarget: ziel({}) })} />);
    expect(screen.getByText("0 / 25 JS")).toBeInTheDocument();
  });
});

describe("PiTargetDerivation", () => {
  it("schreibt die Rechnung aus — mit Zahl der Vorgänger und Faktor", () => {
    render(<PiTargetDerivation pi={pi({ capacity: 2.5, jobSizeTarget: ziel({}) })} />);
    expect(
      screen.getByText("Ziel 25 JS = Ø 12,5 JS je Kapazität (2 PIs) × 2,5 × 0,8"),
    ).toBeInTheDocument();
  });

  it("nennt die Vorgänger mit ihrer Quote im Tooltip", () => {
    render(<PiTargetDerivation pi={pi({ capacity: 2, jobSizeTarget: ziel({}) })} />);
    const zeile = screen.getByText(/^Ziel 25 JS/);
    expect(zeile.getAttribute("title")).toContain("PI 0: 25 JS ÷ 2 = 12,5");
  });

  it("sagt, welcher Eingang fehlt", () => {
    const { rerender } = render(
      <PiTargetDerivation
        pi={pi({ jobSizeTarget: ziel({ target: null, reason: "noCapacity" }) })}
      />,
    );
    expect(screen.getByText(/Kapazität eintragen/)).toBeInTheDocument();
    rerender(
      <PiTargetDerivation
        pi={pi({
          capacity: 5,
          jobSizeTarget: ziel({ target: null, perCapacity: null, basis: [], reason: "noHistory" }),
        })}
      />,
    );
    expect(screen.getByText(/Noch kein abgeschlossener PI/)).toBeInTheDocument();
  });

  it("zeigt bei einem abgeschlossenen PI dessen eigene Quote", () => {
    render(
      <PiTargetDerivation
        pi={pi({
          status: "completed",
          capacity: 4,
          deliveredPerCapacity: 11,
          jobSizeTarget: ziel({}),
        })}
      />,
    );
    expect(screen.getByText("11 JS je Kapazität geliefert")).toBeInTheDocument();
  });
});
