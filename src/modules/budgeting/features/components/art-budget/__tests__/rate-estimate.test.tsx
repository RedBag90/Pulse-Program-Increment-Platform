import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: React.ReactNode; href?: string }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("@/modules/budgeting/features/components/art-budget/rate-estimate-form", () => ({
  RateEstimateForm: ({ current }: { current: number | null }) => (
    <div>Formular Schätzung {current ?? "leer"}</div>
  ),
}));
vi.mock("@/modules/budgeting/features/components/art-budget/job-size-burn-chart", () => ({
  JobSizeBurnChart: () => null,
}));

import { ArtCoverageCard } from "@/modules/budgeting/features/components/art-budget/coverage-card";
import type { ArtCoverage } from "@/modules/budgeting/domain/art-budget-model";
import type { JobSizeRate } from "@/modules/budgeting/domain/art-throughput";

/**
 * **Schätzen, wenn es keinen Satz gibt** — das Formular nur mit Recht, und
 * eine Schätzung steht als Schätzung da.
 */
const satz = (over: Partial<JobSizeRate>): JobSizeRate => ({
  source: "none",
  rate: null,
  artEstimate: null,
  cycles: [],
  budgetSum: 0,
  jobSizeSum: 0,
  featureCount: 0,
  standaloneJobSizeSum: 0,
  standaloneFeatureCount: 0,
  caveats: [
    "In den letzten Halbjahren wurde nichts fertiggestellt — der Satz lässt sich nicht ableiten.",
  ],
  ...over,
});
const deckung = (rate: JobSizeRate): ArtCoverage => ({
  plannedJobSize: 40,
  featureCount: 4,
  plannedStandalone: { jobSize: 0, count: 0 },
  plannedByBucket: {
    business: { count: 0, jobSize: 0 },
    enabler: { count: 0, jobSize: 0 },
    maintenance: { count: 0, jobSize: 0 },
  },
  plannedUnclassified: { count: 0, jobSize: 0 },
  rate,
  loadEuro: rate.rate == null ? null : 40 * rate.rate,
  allocated: 100_000,
  gap: rate.rate == null ? null : 40 * rate.rate - 100_000,
  burn: null,
  cycleCompletions: [],
});

describe("RateDetails — die Schätzung", () => {
  it("kein Satz, mit Recht: das Formular steht offen", () => {
    const { container } = render(
      <ArtCoverageCard name="ART 1" coverage={deckung(satz({}))} estimate={{ artId: "a1" }} />,
    );
    expect(screen.getByText("Formular Schätzung leer")).toBeInTheDocument();
    expect(container.querySelector("details")?.hasAttribute("open")).toBe(true);
  });

  it("kein Satz, ohne Recht: kein Formular, aber wer schätzen darf", () => {
    render(<ArtCoverageCard name="ART 1" coverage={deckung(satz({}))} />);
    expect(screen.queryByText(/^Formular/)).toBeNull();
    expect(screen.getByText(/^Schätzen dürfen Admin/)).toBeInTheDocument();
  });

  it("Schätzung aktiv: als Schätzung gekennzeichnet, änderbar", () => {
    render(
      <ArtCoverageCard
        name="ART 1"
        coverage={deckung(satz({ source: "artEstimate", rate: 2_500, artEstimate: 2_500 }))}
        estimate={{ artId: "a1" }}
      />,
    );
    expect(screen.getByText(/^Geschätzter Satz · 2\.500/)).toBeInTheDocument();
    expect(screen.getByText(/eine Schätzung für dieses ART/)).toBeInTheDocument();
    expect(screen.getByText("Formular Schätzung 2500")).toBeInTheDocument();
  });

  it("wieder ableitbar: gemessener Satz, die Schätzung nur noch als Hinweis", () => {
    render(
      <ArtCoverageCard
        name="ART 1"
        coverage={deckung(
          satz({ source: "empirical", rate: 3_000, artEstimate: 2_500, caveats: [] }),
        )}
        estimate={{ artId: "a1" }}
      />,
    );
    expect(screen.getByText(/wird nicht mehr gebraucht/)).toBeInTheDocument();
    expect(screen.queryByText(/^Formular/)).toBeNull();
  });
});
