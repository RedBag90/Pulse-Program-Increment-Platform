import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, within } from "@testing-library/react";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: React.ReactNode; href?: string }) => (
    <a href={href}>{children}</a>
  ),
}));

import {
  TOP_RISKS_LIMIT,
  TopRisksBlock,
  criticalRisks,
} from "@/modules/work/features/portfolio/overview/blocks/top-risks-block";
import type {
  OverviewRisk,
  PortfolioOverview,
} from "@/modules/work/server/views/portfolio-overview";

/**
 * **Top-Risiken = die kritischen Risiken aus dem Issue-Register** — nicht mehr
 * die Liefersignale aus Work.
 */

const risk = (id: string, over: Partial<OverviewRisk> = {}): OverviewRisk => ({
  id,
  riskNumber: Number(id.replace(/\D/g, "")) || null,
  title: `Risiko ${id}`,
  band: "critical",
  score: 20,
  roamStatus: "open",
  epic: null,
  ...over,
});
const daten = (risks: OverviewRisk[]) => ({ risks }) as unknown as PortfolioOverview;

describe("criticalRisks", () => {
  it("nur kritisch, ohne gelöste — nach Score, höchster zuerst", () => {
    const r = criticalRisks([
      risk("r1", { score: 16 }),
      risk("r2", { band: "high", score: 15 }),
      risk("r3", { score: 25 }),
      risk("r4", { roamStatus: "resolved", score: 25 }),
      risk("r5", { roamStatus: "accepted", score: 20 }),
    ]);
    expect(r.map((x) => x.id)).toEqual(["r3", "r5", "r1"]);
  });
});

describe("TopRisksBlock", () => {
  it("je Risiko Nummer, Titel als Link aufs Issue, das Band als Wort und der ROAM-Status", () => {
    const { container } = render(
      <TopRisksBlock data={daten([risk("r7", { epic: { id: "e1", title: "Epic Eins" } })])} />,
    );
    const zeile = container.querySelector('[data-risk="r7"]') as HTMLElement;
    expect(
      within(zeile)
        .getByRole("link", { name: /#7\s*Risiko r7/ })
        .getAttribute("href"),
    ).toBe("/issues/r7");
    expect(within(zeile).getByText("Kritisch")).toBeInTheDocument();
    expect(within(zeile).getByRole("link", { name: "Epic Eins" }).getAttribute("href")).toBe(
      "/portfolio/epics/e1",
    );
    expect(screen.getByText("kritisch · aus dem Issue-Register")).toBeInTheDocument();
  });

  it(`höchstens ${TOP_RISKS_LIMIT}, dann der Weg zur Issue-Liste`, () => {
    const viele = Array.from({ length: TOP_RISKS_LIMIT + 2 }, (_, i) => risk(`r${i + 1}`));
    const { container } = render(<TopRisksBlock data={daten(viele)} />);
    expect(container.querySelectorAll("[data-risk]")).toHaveLength(TOP_RISKS_LIMIT);
    expect(screen.getByRole("link", { name: /\+2 weitere kritische/ }).getAttribute("href")).toBe(
      "/issues",
    );
  });

  it("ohne kritisches Risiko: der Satz — auch wenn es hohe gibt", () => {
    render(<TopRisksBlock data={daten([risk("r1", { band: "high", score: 12 })])} />);
    expect(screen.getByText("Keine kritischen Risiken im Issue-Register.")).toBeInTheDocument();
  });
});
