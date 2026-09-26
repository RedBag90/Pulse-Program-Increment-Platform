import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, within } from "@testing-library/react";
import {
  FundingBar,
  FundingSnapshotTable,
} from "@/modules/work/features/portfolio/overview/blocks/funding-snapshot-table";
import type { PortfolioOverview } from "@/modules/work/server/views/portfolio-overview";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: React.ReactNode; href?: string }) => (
    <a href={href}>{children}</a>
  ),
}));

/**
 * **Der Funding-Snapshot** — je Wertstrom Portfolio-Epics plus ART-Rahmen der
 * geltenden Kachel, der offene Rahmen sichtbar.
 */

const daten = (changeBudgets: PortfolioOverview["changeBudgets"]) =>
  ({ budgetCycleKey: "2026-H2", changeBudgets }) as unknown as PortfolioOverview;

describe("FundingSnapshotTable", () => {
  it("Summe = Portfolio + ART-Rahmen, vier Segmente, Kachel im Kopf", () => {
    const { container } = render(
      <FundingSnapshotTable
        data={daten([
          {
            valueStreamId: "vs1",
            name: "Niederlassung Hamburg",
            portfolio: 100_000,
            toEpics: 20_000,
            toOwnWork: 5_000,
            open: 25_000,
          },
        ])}
      />,
    );
    expect(screen.getByText("Funding-Snapshot · Kachel H2 2026")).toBeInTheDocument();
    const zeile = container.querySelector('[data-vs="vs1"]') as HTMLElement;
    // 150.000 € — nicht mehr nur die 100.000 € der Portfolio-Epics.
    expect(within(zeile).getByText(/^150/)).toBeInTheDocument();
    for (const s of ["portfolio", "toEpics", "toOwnWork", "open"]) {
      expect(zeile.querySelector(`[data-segment="${s}"]`), s).not.toBeNull();
    }
    expect(within(zeile).getByText(/davon .* noch nicht vergeben/)).toBeInTheDocument();
  });

  it("die Legende nennt jedes Segment in Worten", () => {
    render(
      <FundingSnapshotTable
        data={daten([
          { valueStreamId: "vs1", name: "A", portfolio: 1, toEpics: 0, toOwnWork: 0, open: 0 },
        ])}
      />,
    );
    for (const w of [
      "Portfolio-Epics aus der Kachel",
      "ART-Rahmen · an ART-Epics",
      "ART-Rahmen · für ART-eigene Arbeit",
      "ART-Rahmen · noch nicht vergeben",
    ]) {
      expect(screen.getByText(w)).toBeInTheDocument();
    }
  });

  it("nach Summe sortiert", () => {
    const { container } = render(
      <FundingSnapshotTable
        data={daten([
          {
            valueStreamId: "klein",
            name: "Klein",
            portfolio: 10,
            toEpics: 0,
            toOwnWork: 0,
            open: 0,
          },
          {
            valueStreamId: "gross",
            name: "Gross",
            portfolio: 0,
            toEpics: 0,
            toOwnWork: 0,
            open: 90,
          },
        ])}
      />,
    );
    expect(
      [...container.querySelectorAll("[data-vs]")].map((e) => e.getAttribute("data-vs")),
    ).toEqual(["gross", "klein"]);
  });

  it("ohne Geld in der Kachel: der leere Zustand mit dem Weg ins Budgeting", () => {
    render(<FundingSnapshotTable data={daten([])} />);
    expect(screen.getByRole("link").getAttribute("href")).toBe("/budgeting/periods");
  });
});

describe("FundingBar", () => {
  it("ein negativer Rest hat keine Breite, steht aber als Zahl in der Zeile", () => {
    const { container } = render(
      <FundingBar
        row={{ portfolio: 100_000, toEpics: 30_000, toOwnWork: 0, open: -10_000 }}
        max={200_000}
      />,
    );
    expect(container.querySelector('[data-segment="portfolio"]')).not.toBeNull();
    expect(container.querySelector('[data-segment="toEpics"]')).not.toBeNull();
    expect(container.querySelector('[data-segment="toOwnWork"]')).toBeNull();
    expect(container.querySelector('[data-segment="open"]')).toBeNull();
    expect(screen.getByText(/davon .*-10.* noch nicht vergeben/)).toBeInTheDocument();
  });

  it("die Breite ist relativ zum größten Wertstrom", () => {
    const { container } = render(
      <FundingBar row={{ portfolio: 50, toEpics: 0, toOwnWork: 0, open: 50 }} max={400} />,
    );
    const balken = container.firstElementChild!.firstElementChild as HTMLElement;
    expect(balken.style.width).toBe("25%");
  });
});
