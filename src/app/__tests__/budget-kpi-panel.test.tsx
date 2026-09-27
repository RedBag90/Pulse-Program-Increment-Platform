import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";

// Der Stichtag: eine fortgeltende Kachel aus H1 — nicht das Kalender-Halbjahr.
const APPLIED = {
  id: "k1",
  cycleKey: "2026-H1",
  start: new Date("2026-01-06"),
  end: new Date("2026-07-04"),
  extended: true,
};
vi.mock("@/modules/budgeting/server/services/budget-stichtag", () => ({
  loadBudgetStichtag: async () => ({
    now: new Date("2026-07-06"),
    applied: APPLIED,
    focusKey: "2026-H1",
  }),
}));
const loadBudgetKpis = vi.fn();
vi.mock("@/modules/budgeting/server/views/budget-kpis", () => ({
  loadBudgetKpis: async (...args: unknown[]) => {
    loadBudgetKpis(...args);
    return {
      cycleKey: "2026-H2",
      stream: { burn: { name: "Verlauf Wertstrom" } },
      arts: [
        { artId: "a1", name: "ART 1", coverage: { burn: { name: "Verlauf ART 1" } } },
        { artId: "a2", name: "ART 2", coverage: { burn: { name: "Verlauf ART 2" } } },
      ],
    };
  },
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

  it("der Verlauf folgt der geltenden Kachel, nicht dem Umschalter", async () => {
    loadBudgetKpis.mockClear();
    await BudgetKpiPanel({
      db: {} as never,
      principal,
      arts,
      cycleKey: "2026-H2",
      vsName: "Hamburg",
      showTotals: true,
    });
    const [, , , opts] = loadBudgetKpis.mock.calls[0]!;
    expect(opts.cycleKey).toBe("2026-H2");
    expect(opts.stichtag.applied).toBe(APPLIED);
  });
});

describe("BudgetBurnPanel — nur der Graf, für den Portfolio Sync", () => {
  const burn = async (artId: string | null) =>
    render(await BudgetBurnPanel({ db: {} as never, principal, arts, artId }));

  it('„gesamt" zeigt den Verlauf des Wertstroms', async () => {
    await burn(null);
    expect(screen.getByText("Graf Verlauf Wertstrom")).toBeInTheDocument();
  });

  it("ein ART zeigt seinen Verlauf — keine Deckungskarte, keine PI-Velocity", async () => {
    await burn("a2");
    expect(screen.getByText("Graf Verlauf ART 2")).toBeInTheDocument();
    expect(screen.queryByText(/^Karte/)).not.toBeInTheDocument();
  });

  it("Verlauf, Satz und Budget stehen auf der geltenden Kachel des Stichtags", async () => {
    loadBudgetKpis.mockClear();
    await burn(null);
    const [, , , opts] = loadBudgetKpis.mock.calls[0]!;
    expect(opts.cycleKey).toBe("2026-H1");
    expect(opts.stichtag.applied).toBe(APPLIED);
  });
});
