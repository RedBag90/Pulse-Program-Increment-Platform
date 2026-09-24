import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { MoneySheetView } from "@/modules/core/goals/features/components/money-sheet-view";
import { GoalHealthStrip } from "@/modules/core/goals/features/components/goal-health-strip";
import { GoalScopeFilterBar } from "@/modules/core/goals/features/components/goal-scope-filter-bar";
import { ZieleSubTabs } from "@/modules/core/goals/features/components/ziele-sub-tabs";
import { GoalScopeLinks } from "@/modules/core/goals/features/components/ziele-edit-drawer";

// useUrlState + next/navigation + Options-Fetch stubben — hier interessiert nur
// das modul-bewusste Rendern, nicht das URL-/Fetch-Verhalten.
vi.mock("@/lib/hooks/use-url-state", () => ({
  useUrlState: () => ({ params: new URLSearchParams(), push: vi.fn() }),
}));
vi.mock("@/features/create/use-entity-options", () => ({
  useEntityOptions: () => ({ data: [], loading: false }),
  // `EntitySelect` fragt zusätzlich nach der Route — ohne sie fällt der Picker
  // aus, und der Test läge aus dem falschen Grund rot.
  optionsEndpoint: (kind: string) => `/api/v1/${kind}`,
}));
// next-intl zieht `next/navigation` aus seinem eigenen Auflösungskontext und
// scheitert daran in jsdom. Der Drawer braucht davon ohnehin nur Link + Router.
vi.mock("@/i18n/navigation", () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/ziele",
  redirect: vi.fn(),
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

  /*
   * Die drei €-Kacheln heissen seit der Übersetzung „Plan", „Ist" und
   * „Run-Rate" — vorher standen dort englische Wörter mitten in der deutschen
   * Oberfläche. Geprüft wird weiterhin, **ob** sie da sind, nicht wie sie
   * klingen; die Wörter selbst kommen jetzt aus dem Katalog.
   */
  it("HealthStrip ohne portfolio ⇒ keine €-Kacheln (Plan/Ist/Run-Rate)", () => {
    render(<GoalHealthStrip themes={[]} tenantTrio={ZERO} showMoney={false} />);
    expect(screen.queryByText("Plan")).toBeNull();
    expect(screen.queryByText("Run-Rate")).toBeNull();
  });

  it("HealthStrip mit portfolio ⇒ €-Kacheln sichtbar (Org-Verhalten unverändert)", () => {
    render(<GoalHealthStrip themes={[]} tenantTrio={ZERO} />);
    expect(screen.getByText("Plan")).toBeInTheDocument();
    expect(screen.getByText("Run-Rate")).toBeInTheDocument();
  });

  /**
   * **Hier stand das Gegenteil.** Der Test hielt fest, dass Wertstrom und ART
   * ohne `work`/`drumbeat` **verschwinden** — und schrieb damit den Fehler fest,
   * statt ihn zu fangen: beide sind **Core** (`MODULES.core` beansprucht
   * `value_stream.` und `art.`). Die Schalter dafür gibt es seit dem 21.09.2026
   * nicht mehr; die Leiste zeigt sie immer.
   */
  it("FilterBar zeigt Wertstrom und ART immer — sie sind Core, kein Premium", () => {
    render(<GoalScopeFilterBar />);
    expect(screen.getByText("Zeitraum")).toBeInTheDocument();
    expect(screen.getByText("Wertstrom")).toBeInTheDocument();
    expect(screen.getByText("ART")).toBeInTheDocument();
  });
});

/**
 * **Wertströme und ARTs sind Core — und werden deshalb von keinem Modul gegated.**
 *
 * Bis zum 21.09.2026 hingen die beiden Picker an `modules.portfolio` (= `work`)
 * und `modules.program` (= `drumbeat`). In einem Mandanten mit nur `core`
 * verschwanden sie ersatzlos: der im Prop-Kommentar versprochene 🔒-Hinweis war
 * nie gebaut. Ein Portfolio Manager, der `target.manage`, `value_stream.create`
 * und `art.create` hält, kam damit nicht weiter.
 *
 * `GoalScopeLinks` hatte **keinen einzigen Test** — deshalb fiel es nicht auf.
 * Diese Fälle sind die Lücke.
 */
describe("Verantwortung · Wertströme & ARTs (kein Modul-Gate)", () => {
  const vs = [{ id: "vs-1", name: "Elefanten-Wertstrom 1" }];
  const arts = [{ id: "art-1", name: "Zug Nord" }];

  it("mit Schreibrecht stehen beide Picker da — ohne jede Modul-Angabe", () => {
    render(<GoalScopeLinks goalId="g1" valueStreams={[]} arts={[]} canEdit />);
    // `GoalScopeLinks` nimmt keine Modul-Props mehr entgegen; gäbe es sie noch,
    // liesse sich dieser Aufruf nicht tippen.
    expect(screen.getAllByRole("combobox").length).toBeGreaterThanOrEqual(2);
  });

  it("ohne Schreibrecht kein Picker", () => {
    render(<GoalScopeLinks goalId="g1" valueStreams={[]} arts={[]} canEdit={false} />);
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  /**
   * **Die Asymmetrie, die den Fehler verraten hat.** Vorhandene Zuordnungen
   * wurden immer angezeigt — nur Hinzufügen ging nicht. Ein echtes Entitlement
   * hätte beides verborgen.
   */
  it("zeigt bestehende Zuordnungen auch ohne Schreibrecht", () => {
    render(<GoalScopeLinks goalId="g1" valueStreams={vs} arts={arts} canEdit={false} />);
    expect(screen.getByText("Elefanten-Wertstrom 1")).toBeInTheDocument();
    expect(screen.getByText("Zug Nord")).toBeInTheDocument();
  });

  it("nennt beide Achsen, auch wenn nichts zugeordnet ist", () => {
    render(<GoalScopeLinks goalId="g1" valueStreams={[]} arts={[]} canEdit />);
    expect(screen.getByText("Value Streams")).toBeInTheDocument();
    expect(screen.getByText("ARTs")).toBeInTheDocument();
  });
});
