import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/portfolio",
  useSearchParams: () => new URLSearchParams("view=sync&vs=x&kpiVs=vs1&kpiArt=a1"),
}));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: React.ReactNode; href?: string }) => (
    <a href={href}>{children}</a>
  ),
}));

import { BudgetKpiSelect } from "@/modules/work/features/portfolio/overview/budget-kpi-select";

/**
 * **Die Auswahl schreibt die URL** — und behält, was sonst darin steht.
 */
const OPTIONEN = [
  { id: "vs1", name: "Wertstrom A", showTotals: true, arts: [{ id: "a1", name: "ART 1" }] },
  { id: "vs2", name: "Wertstrom B", showTotals: false, arts: [{ id: "b1", name: "ART B" }] },
];

describe("BudgetKpiSelect", () => {
  beforeEach(() => replace.mockClear());

  it("ein neuer Wertstrom setzt kpiVs, löscht kpiArt und behält Ansicht und Filter", () => {
    render(<BudgetKpiSelect options={OPTIONEN} selectedVs="vs1" selectedArt="a1" />);
    fireEvent.change(screen.getByLabelText("Wertstrom"), { target: { value: "vs2" } });
    const url = replace.mock.calls[0]![0] as string;
    const p = new URLSearchParams(url.split("?")[1]);
    expect(p.get("kpiVs")).toBe("vs2");
    expect(p.get("kpiArt")).toBeNull();
    expect(p.get("view")).toBe("sync");
    expect(p.get("vs")).toBe("x");
  });

  it('„Wertstrom gesamt" löscht kpiArt; nur mit Wertstrom-Recht wählbar', () => {
    const { rerender } = render(
      <BudgetKpiSelect options={OPTIONEN} selectedVs="vs1" selectedArt="a1" />,
    );
    fireEvent.change(screen.getByLabelText("Sicht"), { target: { value: "" } });
    const p = new URLSearchParams((replace.mock.calls[0]![0] as string).split("?")[1]);
    expect(p.get("kpiArt")).toBeNull();
    rerender(<BudgetKpiSelect options={OPTIONEN} selectedVs="vs2" selectedArt="b1" />);
    expect(screen.queryByRole("option", { name: "Wertstrom gesamt" })).toBeNull();
  });

  it("führt zur Budgetseite des gewählten Wertstroms", () => {
    render(<BudgetKpiSelect options={OPTIONEN} selectedVs="vs1" selectedArt={null} />);
    expect(screen.getByRole("link", { name: /Zur Budgetseite/ }).getAttribute("href")).toBe(
      "/budgeting/value-streams/vs1?tab=kpi",
    );
  });
});
