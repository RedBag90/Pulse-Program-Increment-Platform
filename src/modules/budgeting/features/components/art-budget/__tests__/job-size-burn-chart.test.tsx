import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { JobSizeBurnChart } from "@/modules/budgeting/features/components/art-budget/job-size-burn-chart";
import { jobSizeBurn, halfYearWindow } from "@/modules/budgeting/domain/job-size-burn";

/**
 * **Das Diagramm** — Plan, Band, Ist und heute; die Abweichung in Worten,
 * nicht nur in Farbe.
 */

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);
const burn = (js: number, rate: number | null = 3_000, today = d("2026-10-01")) =>
  jobSizeBurn({
    window: halfYearWindow("2026-H2"),
    allocated: 300_000,
    rate,
    completions: [{ at: d("2026-09-01"), jobSize: js }],
    today,
  });

describe("JobSizeBurnChart", () => {
  it("zeichnet Plan, beide Band-Linien, das Ist und heute", () => {
    const { container } = render(<JobSizeBurnChart burn={burn(45)} />);
    for (const linie of ["plan", "band-oben", "band-unten", "ist", "heute"]) {
      expect(container.querySelector(`[data-line="${linie}"]`), linie).not.toBeNull();
    }
    expect(screen.getByText(/erwartet bis Halbjahresende: 100 JS/)).toBeInTheDocument();
  });

  it("die Legende nennt jede Linie in Worten", () => {
    render(<JobSizeBurnChart burn={burn(45)} />);
    expect(screen.getByText("Plan (Budget ÷ Satz, linear)")).toBeInTheDocument();
    expect(screen.getByText("±20 % um den Plan")).toBeInTheDocument();
    expect(screen.getByText("Ist (fertig gemeldete Features)")).toBeInTheDocument();
  });

  it("die Kopfzeile sagt Ist, Plan heute, Abweichung und Lage", () => {
    render(<JobSizeBurnChart burn={burn(45)} />);
    expect(screen.getByText(/^Ist 45 JS · Plan heute 50 JS · -10 % · im Band/)).toBeInTheDocument();
  });

  it("ausserhalb des Bands steht es als Text da, nicht nur als Farbe", () => {
    render(<JobSizeBurnChart burn={burn(30)} />);
    expect(screen.getByText(/-40 % · unter Plan/)).toBeInTheDocument();
  });

  it("ohne Satz: kein Plan, kein Band — das Ist und der Grund", () => {
    const { container } = render(<JobSizeBurnChart burn={burn(8, null)} />);
    expect(container.querySelector('[data-line="plan"]')).toBeNull();
    expect(container.querySelector('[data-line="band-oben"]')).toBeNull();
    expect(container.querySelector('[data-line="ist"]')).not.toBeNull();
    expect(
      screen.getByText(/^Ohne Satz keine erwartete Job Size — Ist bisher 8 JS/),
    ).toBeInTheDocument();
  });

  it("ohne Budget: der Grund in Worten statt einer Plan-Linie auf null", () => {
    const { container } = render(
      <JobSizeBurnChart
        burn={jobSizeBurn({
          window: halfYearWindow("2026-H2"),
          allocated: 0,
          rate: 3_000,
          completions: [{ at: d("2026-09-01"), jobSize: 7 }],
          today: d("2026-10-01"),
        })}
      />,
    );
    expect(container.querySelector('[data-line="plan"]')).toBeNull();
    expect(screen.getByText(/nichts zugeteilt — keine erwartete Job Size/)).toBeInTheDocument();
  });

  it("ein Halbjahr, das noch nicht begonnen hat: nur der Plan", () => {
    const { container } = render(
      <JobSizeBurnChart
        burn={jobSizeBurn({
          window: halfYearWindow("2027-H1"),
          allocated: 300_000,
          rate: 3_000,
          completions: [],
          today: d("2026-10-01"),
        })}
      />,
    );
    expect(container.querySelector('[data-line="ist"]')).toBeNull();
    expect(screen.getByText(/noch nicht begonnen — erwartet 100 JS/)).toBeInTheDocument();
  });
});

describe("JobSizeBurnChart — die Kachel", () => {
  it("nennt die laufende Kachel mit ihren Daten", () => {
    render(
      <JobSizeBurnChart
        burn={jobSizeBurn({
          window: {
            cycleKey: "2026-H2",
            start: d("2026-07-06"),
            end: d("2027-01-01"),
            extended: false,
          },
          allocated: 300_000,
          rate: 3_000,
          completions: [],
          today: d("2026-10-01"),
        })}
      />,
    );
    expect(
      screen.getByText(/Geltende Budget-Kachel H2 2026 · 06\.07\.2026 – 31\.12\.2026/),
    ).toBeInTheDocument();
  });

  it("ohne laufende Kachel: der Satz statt eines Diagramms", () => {
    const { container } = render(<JobSizeBurnChart burn={null} />);
    expect(screen.getByText(/^Keine geltende Budget-Kachel/)).toBeInTheDocument();
    expect(container.querySelector("svg")).toBeNull();
  });
});
