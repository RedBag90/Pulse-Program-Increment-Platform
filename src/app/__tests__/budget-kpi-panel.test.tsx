import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";

vi.mock("@/modules/budgeting/server/services/running-period", () => ({
  loadRunningPeriod: async () => null,
}));
vi.mock("@/modules/budgeting/server/views/budget-kpis", () => ({
  loadBudgetKpis: async () => ({
    cycleKey: "2026-H2",
    stream: { burn: { name: "Verlauf Wertstrom" } },
    arts: [
      { artId: "a1", name: "ART 1", coverage: { burn: { name: "Verlauf ART 1" } } },
      { artId: "a2", name: "ART 2", coverage: { burn: { name: "Verlauf ART 2" } } },
    ],
  }),
}));
vi.mock("@/modules/drumbeat/server/views/pi-velocity-view", () => ({
  loadPiVelocity: async () => null,
}));
vi.mock("@/modules/budgeting/features/components/art-budget/coverage-card", () => ({
  StreamCoverageCard: ({ name }: { name: string }) => <div>Karte {name}</div>,
  ArtCoverageCard: ({ name }: { name: string }) => <div>Karte {name}</div>,
}));
vi.mock("@/modules/budgeting/features/components/art-budget/job-size-burn-chart", () => ({
  JobSizeBurnChart: ({ burn }: { burn: { name: string } | null }) => (
    <div>Graf {burn?.name ?? "leer"}</div>
  ),
}));

import { BudgetKpiPanel } from "@/app/[locale]/(dashboard)/budgeting/_components/budget-kpi-panel";
import { BudgetBurnPanel } from "@/app/[locale]/(dashboard)/budgeting/_components/budget-burn-panel";

/**
 * **Die beiden Panels der Composition Root** — die Budgetseite zeigt alle
 * Karten, der Portfolio Sync nur den Job-Size-Verlauf der Auswahl.
 */
const principal = { tenantId: "t1", enabledModules: ["budgeting"] } as never;
const arts = [
  { id: "a1", name: "ART 1", timelineId: null },
  { id: "a2", name: "ART 2", timelineId: null },
];

describe("BudgetKpiPanel — die Budgetseite", () => {
  it("Wertstrom und alle ARTs, wie der KPI-Reiter", async () => {
    render(
      await BudgetKpiPanel({
        db: {} as never,
        principal,
        arts,
        cycleKey: "2026-H2",
        vsName: "Hamburg",
        showTotals: true,
      }),
    );
    expect(screen.getByText("Karte Hamburg · gesamt")).toBeInTheDocument();
    expect(screen.getByText("Karte ART 1")).toBeInTheDocument();
    expect(screen.getByText("Karte ART 2")).toBeInTheDocument();
  });
});

describe("BudgetBurnPanel — nur der Graf, für den Portfolio Sync", () => {
  const burn = async (artId: string | null) =>
    render(await BudgetBurnPanel({ db: {} as never, principal, arts, cycleKey: "2026-H2", artId }));

  it('„gesamt" zeigt den Verlauf des Wertstroms', async () => {
    await burn(null);
    expect(screen.getByText("Graf Verlauf Wertstrom")).toBeInTheDocument();
  });

  it("ein ART zeigt seinen Verlauf — keine Deckungskarte, keine PI-Velocity", async () => {
    await burn("a2");
    expect(screen.getByText("Graf Verlauf ART 2")).toBeInTheDocument();
    expect(screen.queryByText(/^Karte/)).not.toBeInTheDocument();
  });
});
