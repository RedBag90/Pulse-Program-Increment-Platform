import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import {
  buildPortfolioOverviewModel,
  type PortfolioOverviewInputs,
} from "@/modules/work/server/views/portfolio-overview";
import { OverviewMissionControl } from "@/modules/work/features/portfolio/overview/overview-mission-control";
import { OverviewExecutive } from "@/modules/work/features/portfolio/overview/overview-executive";
import { DEFAULT_CONTRIBUTION_VIEW } from "@/modules/work/domain/contribution-view-preference";

/**
 * **Eine Fläche ohne Modul verschwindet — sie steht nicht leer da.**
 *
 * Die Übersicht zeigte den Risiko-Abschnitt auch ohne das Risiken-Modul: fünf
 * ROAM-Kacheln mit lauter Nullen und „Keine Risiken in diesem Zustand." Das ist
 * schlimmer als überflüssig — es behauptet, der Mandant habe **keine** Risiken,
 * statt dass er sie gar nicht führt.
 *
 * Das Modell entsteht hier über den echten Builder statt als handgebaute
 * Attrappe: so kann die Zusicherung nicht daran vorbeigehen, wie das Feld
 * wirklich zustande kommt.
 */

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, ...props }: { children: React.ReactNode }) => <a {...props}>{children}</a>,
}));

function inputs(risksEnabled: boolean): PortfolioOverviewInputs {
  return {
    epics: [],
    features: [],
    risks: [],
    goalContributions: [],
    ownerLabels: {},
    themes: [],
    board: { periods: [], pool: {} },
    vsBudgets: { valueStreams: [] },
    cycleAllocations: {},
    budgetCycleKey: "2026-H1",
    epicClasses: null,
    funnelItems: [],
    budgetingEnabled: true,
    risksEnabled,
    horizonTargets: null,
    horizonOnOverview: true,
    selectedClasses: [],
    activePis: [],
    structureGap: { hasTarget: false, targetDate: null, dimensions: [], overallProgress: 0 },
    practiceAdoption: { hasTarget: false, signals: [] },
    filter: { valueStreamIds: [], ownerIds: [], epicClasses: [] },
    now: new Date("2026-09-23T10:00:00.000Z"),
  } as unknown as PortfolioOverviewInputs;
}

const modell = (risksEnabled: boolean) => buildPortfolioOverviewModel(inputs(risksEnabled));

describe("Risiken auf der Portfolio-Übersicht", () => {
  it("stehen da, wo es das Modul gibt", () => {
    render(
      <OverviewMissionControl data={modell(true)} contributionView={DEFAULT_CONTRIBUTION_VIEW} />,
    );
    expect(screen.getByText("Risiken")).toBeInTheDocument();
  });

  it("verschwinden ganz, wo es das Modul nicht gibt", () => {
    render(
      <OverviewMissionControl data={modell(false)} contributionView={DEFAULT_CONTRIBUTION_VIEW} />,
    );
    expect(screen.queryByText("Risiken")).not.toBeInTheDocument();
    // Und zwar wirklich die ganze Fläche, nicht nur die Überschrift.
    expect(screen.queryByText(/Keine Risiken in diesem Zustand/)).not.toBeInTheDocument();
  });

  it("nimmt „Top-Risiken“ nicht mit — das sind Work-Daten", () => {
    // Der Name legt es nahe, die Herkunft nicht: `TopRisksBlock` liest
    // blockierte und liegengebliebene Epics, nicht das Risiko-Register. Wer
    // später „alles mit Risk im Namen" abschaltet, bricht hier.
    render(<OverviewExecutive data={modell(false)} />);
    expect(screen.getByText("Top-Risiken")).toBeInTheDocument();
  });
});

describe("das Modell selbst", () => {
  it("trägt den Schalter durch", () => {
    expect(modell(false).risksEnabled).toBe(false);
    expect(modell(true).risksEnabled).toBe(true);
  });
});
