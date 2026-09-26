import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, within } from "@testing-library/react";
import {
  buildPortfolioOverviewModel,
  type PortfolioOverviewInputs,
} from "@/modules/work/server/views/portfolio-overview";
import {
  availableOverviewViews,
  resolveOverviewView,
} from "@/modules/work/features/portfolio/overview/view-switcher-config";
import { OverviewReview } from "@/modules/work/features/portfolio/overview/overview-review";
import { OverviewSync } from "@/modules/work/features/portfolio/overview/overview-sync";
import { OverviewBudgeting } from "@/modules/work/features/portfolio/overview/overview-budgeting";
import { DEFAULT_CONTRIBUTION_VIEW } from "@/modules/work/domain/contribution-view-preference";

/**
 * **Die Meeting-Ansichten der Portfolio-Übersicht** — je Termin das, was er
 * braucht, und der Weg zu seiner Agenda im Wiki.
 */

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: React.ReactNode; href?: string }) => (
    <a href={href}>{children}</a>
  ),
}));

function epic(id: string, over: Record<string, unknown> = {}) {
  return {
    id,
    title: `Epic ${id}`,
    status: "active",
    stageGate: "L2",
    ownerId: null,
    selectedForDetailingAt: null,
    selectedForAnalyzingAt: null,
    businessCaseApprovedAt: null,
    approvedAt: null,
    implementationCompletedAt: null,
    updatedAt: new Date("2026-09-01T00:00:00.000Z"),
    needsSteeringAttention: false,
    stagedForBudgeting: false,
    timeline: null,
    valueStream: { id: "vs1", name: "Wertstrom A" },
    investmentHorizon: null,
    primarySolution: null,
    ...over,
  };
}

function inputs(over: Partial<PortfolioOverviewInputs> = {}): PortfolioOverviewInputs {
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
    budgetCycleKey: "2026-H2",
    epicClasses: null,
    funnelItems: [],
    budgetingEnabled: true,
    risksEnabled: true,
    horizonTargets: null,
    horizonOnOverview: false,
    selectedClasses: [],
    activePis: [],
    structureGap: { hasTarget: false, targetDate: null, dimensions: [], overallProgress: 0 },
    practiceAdoption: { hasTarget: false, signals: [] },
    now: new Date("2026-09-23T10:00:00.000Z"),
    ...over,
  } as unknown as PortfolioOverviewInputs;
}

describe("Umschalter", () => {
  it("kennt Gesamt und die drei Termine; alte Varianten landen auf Gesamt", () => {
    expect(resolveOverviewView("review")).toBe("review");
    expect(resolveOverviewView("sync")).toBe("sync");
    expect(resolveOverviewView("budgeting")).toBe("budgeting");
    expect(resolveOverviewView("hero")).toBe("mission");
    expect(resolveOverviewView("executive")).toBe("mission");
    expect(resolveOverviewView(undefined)).toBe("mission");
  });

  it("ohne Budgeting-Modul gibt es die Budgeting-Ansicht nicht", () => {
    const ohne = availableOverviewViews(false);
    expect(ohne).toEqual(["mission", "review", "sync"]);
    expect(resolveOverviewView("budgeting", ohne)).toBe("mission");
  });
});

describe("Budget-Kandidaten im Modell", () => {
  it("nur vorgemerkte Epics — nach Horizont, darin die teuersten zuerst", () => {
    const m = buildPortfolioOverviewModel(
      inputs({
        epics: [
          epic("a", { stagedForBudgeting: true, investmentHorizon: "h2" }),
          epic("b", { stagedForBudgeting: true, investmentHorizon: "h1" }),
          epic("c", { stagedForBudgeting: true, investmentHorizon: "h1" }),
          epic("d"),
        ] as never,
        candidateCosts: { b: 50_000, c: 200_000, a: 900_000 },
      }),
    );
    expect(m.budgetCandidates.map((r) => r.id)).toEqual(["c", "b", "a"]);
    expect(m.budgetCandidates[0]).toMatchObject({ cost: 200_000, valueStreamName: "Wertstrom A" });
  });

  it("ohne Business Case keine Kosten — und zuletzt in seinem Horizont", () => {
    const m = buildPortfolioOverviewModel(
      inputs({
        epics: [
          epic("x", { stagedForBudgeting: true, investmentHorizon: "h1" }),
          epic("y", { stagedForBudgeting: true, investmentHorizon: "h1" }),
        ] as never,
        candidateCosts: { y: 10_000 },
      }),
    );
    expect(m.budgetCandidates.map((r) => [r.id, r.cost])).toEqual([
      ["y", 10_000],
      ["x", null],
    ]);
  });
});

describe("die Ansichten", () => {
  const wikiLink = (anker: string) =>
    screen.getByRole("link", { name: /Wer ist dabei/ }).getAttribute("href") ===
    `/wiki/termine#${anker}`;

  it("Strategic Review: Kopfzeile, Kennzahlen, Entscheidungen — keine Fälligkeiten", () => {
    render(
      <OverviewReview
        data={buildPortfolioOverviewModel(inputs())}
        contributionView={DEFAULT_CONTRIBUTION_VIEW}
      />,
    );
    expect(screen.getByText("Strategic Portfolio Review")).toBeInTheDocument();
    expect(wikiLink("strategic-portfolio-review")).toBe(true);
    expect(screen.getByText("Ziele auf Kurs")).toBeInTheDocument();
    expect(screen.queryByText("Features fällig (≤ 2 Wochen)")).not.toBeInTheDocument();
  });

  it("Portfolio Sync: die Steering-Agenda, Fälligkeiten und die Wege zu Issues und Abhängigkeiten", () => {
    render(<OverviewSync data={buildPortfolioOverviewModel(inputs())} />);
    expect(wikiLink("portfolio-sync")).toBe(true);
    expect(screen.getByText("Features fällig (≤ 2 Wochen)")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Alle Issues/ }).getAttribute("href")).toBe("/issues");
    expect(screen.getByRole("link", { name: /Abhängigkeiten/ }).getAttribute("href")).toBe(
      "/dependencies",
    );
  });

  it("Portfolio Sync: je Wertstrom der Weg zu seinen Budget-KPIs", () => {
    render(
      <OverviewSync
        data={buildPortfolioOverviewModel(
          inputs({
            vsBudgets: {
              valueStreams: [
                { valueStreamId: "vs1", name: "Wertstrom A", total: 100, byPeriod: {} },
              ],
            } as never,
          }),
        )}
      />,
    );
    const karte = screen.getByText("Budget-KPIs je Wertstrom").closest("div")!.parentElement!;
    expect(within(karte).getByRole("link", { name: "Wertstrom A" }).getAttribute("href")).toBe(
      "/budgeting/value-streams/vs1?tab=kpi",
    );
  });

  it("Budgeting: der Topf des Budget-Halbjahrs, nicht die Summe aller Perioden", () => {
    render(
      <OverviewBudgeting
        data={buildPortfolioOverviewModel(
          inputs({
            epics: [epic("b", { stagedForBudgeting: true, investmentHorizon: "h1" })] as never,
            candidateCosts: { b: 250_000 },
            // Zwei Perioden; das Budget-Halbjahr ist H2 2026 (`budgetCycleKey`).
            board: {
              periods: [
                { key: "2026-H1", label: "H1 2026" },
                { key: "2026-H2", label: "H2 2026" },
              ],
              pool: { "2026-H1": 4_000_000, "2026-H2": 2_000_000 },
            },
            vsBudgets: {
              valueStreams: [
                {
                  valueStreamId: "vs1",
                  name: "Wertstrom A",
                  total: 0,
                  byPeriod: { "2026-H2": 500_000 },
                },
              ],
            },
          }),
        )}
      />,
    );
    expect(wikiLink("participatory-budgeting")).toBe(true);
    expect(screen.getByText("H2 2026")).toBeInTheDocument();
    // 2,0 Mio gesamt, 0,5 verteilt, 1,5 frei — nicht die 6,0 Mio beider Perioden.
    expect(screen.getByText(/^2[.,]0 Mio/)).toBeInTheDocument();
    expect(screen.getByText(/^1[.,]5 Mio/)).toBeInTheDocument();
    expect(screen.queryByText(/^6[.,]0 Mio/)).not.toBeInTheDocument();
    const zeile = screen.getByRole("link", { name: "Epic b" }).closest("tr")!;
    expect(within(zeile).getByText(/250/)).toBeInTheDocument();
  });
});
