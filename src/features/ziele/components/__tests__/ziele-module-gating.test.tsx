import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MoneySheetView } from "@/features/ziele/components/money-sheet-view";
import { GoalHealthStrip } from "@/features/ziele/components/goal-health-strip";
import { GoalScopeFilterBar } from "@/features/ziele/components/goal-scope-filter-bar";
import { ZieleSubTabs } from "@/features/ziele/components/ziele-sub-tabs";

// useUrlState + next/navigation + Options-Fetch stubben — hier interessiert nur
// das modul-bewusste Rendern, nicht das URL-/Fetch-Verhalten.
vi.mock("@/lib/hooks/use-url-state", () => ({
  useUrlState: () => ({ params: new URLSearchParams(), push: vi.fn() }),
}));
vi.mock("@/features/create/use-entity-options", () => ({
  useEntityOptions: () => ({ data: [], loading: false }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/ziele",
  useSearchParams: () => new URLSearchParams(),
}));

const ZERO = { planned: 0, realized: 0, runRate: 0 };

describe("Freemium-Gating im Ziele-Modul (Personal-Tenant, modules all-off)", () => {
  it("Money-View ohne portfolio ⇒ rendert nichts (Tab ist ausgeblendet)", () => {
    const { container } = render(<MoneySheetView themes={[]} hasPortfolio={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("Money-View mit portfolio ⇒ Tabelle wie bisher", () => {
    render(<MoneySheetView themes={[]} hasPortfolio />);
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText("Portfolio-Dashboard")).toBeInTheDocument();
  });

  it("Sub-Tabs ohne portfolio ⇒ kein Money-Tab", () => {
    render(<ZieleSubTabs active="strategie" showMoney={false} />);
    expect(screen.getByText("Strategie")).toBeInTheDocument();
    expect(screen.queryByText("Money")).toBeNull();
  });

  it("Sub-Tabs mit portfolio ⇒ Money-Tab sichtbar", () => {
    render(<ZieleSubTabs active="strategie" showMoney />);
    expect(screen.getByText("Money")).toBeInTheDocument();
  });

  it("HealthStrip ohne portfolio ⇒ keine €-Kacheln (Planned/Realized/Run-Rate)", () => {
    render(<GoalHealthStrip themes={[]} tenantTrio={ZERO} showMoney={false} />);
    expect(screen.queryByText("Planned")).toBeNull();
    expect(screen.queryByText("Run-Rate")).toBeNull();
  });

  it("HealthStrip mit portfolio ⇒ €-Kacheln sichtbar (Org-Verhalten unverändert)", () => {
    render(<GoalHealthStrip themes={[]} tenantTrio={ZERO} />);
    expect(screen.getByText("Planned")).toBeInTheDocument();
    expect(screen.getByText("Run-Rate")).toBeInTheDocument();
  });

  it("FilterBar ohne portfolio/program ⇒ nur Zeitraum, keine VS-/ART-Dropdowns", () => {
    render(<GoalScopeFilterBar showValueStreams={false} showArts={false} />);
    expect(screen.getByText("Zeitraum")).toBeInTheDocument();
    expect(screen.queryByText("Wertstrom")).toBeNull();
    expect(screen.queryByText("ART")).toBeNull();
  });

  it("FilterBar default ⇒ alle drei Filter (Org-Verhalten unverändert)", () => {
    render(<GoalScopeFilterBar />);
    expect(screen.getByText("Wertstrom")).toBeInTheDocument();
    expect(screen.getByText("ART")).toBeInTheDocument();
  });
});
