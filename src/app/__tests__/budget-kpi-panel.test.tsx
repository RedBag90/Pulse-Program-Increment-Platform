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
  rateSuspicion: () => [],
}));
vi.mock("@/modules/drumbeat/server/views/pi-velocity-view", () => ({
  loadPiVelocity: async () => null,
}));
vi.mock("@/modules/budgeting/features/components/art-budget/budget-kpi-overview", () => ({
  KpiTiles: ({ isTotal }: { isTotal: boolean }) => <div>Kacheln {isTotal ? "Σ" : "eigene"}</div>,
  RateCheckBanner: () => null,
  CoverageTable: ({ rows, stream }: { rows: { name: string }[]; stream: unknown }) => (
    <div>
      Karte Deckung {rows.map((r) => r.name).join(", ")}
      {stream ? " mit Σ" : " ohne Σ"}
    </div>
  ),
  DeliveryCard: ({ selected }: { selected: { name: string } }) => (
    <div>Karte Lieferung {selected.name}</div>
  ),
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
  const panel = (over: { showTotals?: boolean; burnArtId?: string | null } = {}) =>
    BudgetKpiPanel({
      db: {} as never,
      principal,
      arts,
      cycleKey: "2026-H2",
      showTotals: over.showTotals ?? true,
      basePath: "/budgeting/value-streams/vs1",
      burnArtId: over.burnArtId ?? null,
    });

  it("eine Karte je Kennzahl: Kacheln, Deckung mit allen ARTs und Σ, Lieferung für Σ", async () => {
    render(await panel());
    expect(screen.getByText("Kacheln Σ")).toBeInTheDocument();
    expect(screen.getByText("Karte Deckung ART 1, ART 2 mit Σ")).toBeInTheDocument();
    expect(screen.getByText("Karte Lieferung Σ Wertstrom")).toBeInTheDocument();
  });

  it("?kpiArt= wählt den Verlauf eines ARTs", async () => {
    render(await panel({ burnArtId: "a2" }));
    expect(screen.getByText("Karte Lieferung ART 2")).toBeInTheDocument();
  });

  it("ohne Wertstrom-Recht keine Σ — die Lieferung zeigt das erste ART", async () => {
    render(await panel({ showTotals: false }));
    expect(screen.getByText("Kacheln eigene")).toBeInTheDocument();
    expect(screen.getByText("Karte Deckung ART 1, ART 2 ohne Σ")).toBeInTheDocument();
    expect(screen.getByText("Karte Lieferung ART 1")).toBeInTheDocument();
  });

  it("der Verlauf folgt der geltenden Kachel, nicht dem Umschalter", async () => {
    loadBudgetKpis.mockClear();
    await panel();
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
