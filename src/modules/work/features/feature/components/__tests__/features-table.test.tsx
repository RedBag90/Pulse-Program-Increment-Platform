import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { FeaturesListView } from "@/modules/work/features/feature/components/features-table";
import type {
  FeatureOverviewRow,
  FeaturesOverviewModel,
} from "@/modules/work/server/views/features-overview";

/**
 * Die Tabelle wird von zwei Flächen benutzt: der Features-Übersicht (alle
 * Spalten, read-only) und dem Deliverables-Reiter eines Epics (ohne Epic- und
 * Wertstrom-Spalte, mit Bearbeiten-Slots). Geprüft wird genau das, was diese
 * beiden Einsätze unterscheidet — inklusive der Stellen, an denen der Umbau
 * sonst still zerbrochen wäre (Spaltenzahl der Leerzeile).
 */

// `@/i18n/navigation` zieht next-intl nach, das unter vitest nicht auflöst —
// für diese Tests genügt ein einfacher Anker.
vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, ...props }: { children: React.ReactNode }) => <a {...props}>{children}</a>,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/de/portfolio/epics/e1",
  useSearchParams: () => new URLSearchParams(),
}));

function row(over: Partial<FeatureOverviewRow> = {}): FeatureOverviewRow {
  return {
    id: "f1",
    title: "Antragsstrecke neu",
    status: "in_progress",
    epic: { id: "e1", title: "Kundenportal" },
    pi: { id: "p1", name: "PI 4" },
    art: { id: "a1", name: "Mobile ART" },
    valueStream: { id: "v1", name: "Digital Banking" },
    wsjfComputed: 7,
    wsjfTier: "high",
    wsjfBusinessValue: 8,
    wsjfTimeCriticality: 5,
    wsjfRiskReduction: 3,
    wsjfJobSize: 5,
    acceptanceCriteriaCount: 2,
    isBlocked: false,
    createdAtMs: 1,
    featureType: null,
    ...over,
  };
}

function model(rows: FeatureOverviewRow[], showWsjf = true): FeaturesOverviewModel {
  return {
    rows,
    funnelCounts: { draft: 0, approved: 0, in_progress: rows.length, completed: 0 },
    valueStreamOptions: [],
    artOptions: [],
    epicOptions: [],
    piOptions: [],
    showWsjf,
  };
}

describe("FeaturesListView", () => {
  it("zeigt standardmäßig alle Spalten (Verhalten der Features-Übersicht)", () => {
    render(<FeaturesListView model={model([row()])} />);
    expect(screen.getByText("Epic")).toBeInTheDocument();
    expect(screen.getByText("Wertstrom · ART")).toBeInTheDocument();
    expect(screen.getByText(/Digital Banking · Mobile ART/)).toBeInTheDocument();
  });

  it("blendet Epic und Wertstrom aus und zeigt dann nur den ART", () => {
    render(<FeaturesListView model={model([row()])} columns={["pi", "status", "wsjf", "ak"]} />);
    expect(screen.queryByText("Epic")).not.toBeInTheDocument();
    expect(screen.queryByText("Wertstrom · ART")).not.toBeInTheDocument();
    expect(screen.getByText("ART")).toBeInTheDocument();
    expect(screen.getByText("Mobile ART")).toBeInTheDocument();
  });

  it("die Leerzeile spannt über genau die sichtbaren Spalten", () => {
    // Das colSpan war vorher ein hartkodiertes Literal — genau daran wäre der
    // Umbau zerbrochen, sobald Spalten wegfallen.
    const { container } = render(
      <FeaturesListView
        model={model([], true)}
        columns={["pi", "status", "wsjf", "ak"]}
        renderActions={() => <span />}
      />,
    );
    const cell = container.querySelector("td[colspan]");
    // Titel + pi + status + wsjf + ak + Aktionen = 6
    expect(cell?.getAttribute("colspan")).toBe("6");
  });

  it("zeigt den Blocker-Marker nur bei isBlocked", () => {
    const { rerender } = render(<FeaturesListView model={model([row()])} />);
    expect(screen.queryByTitle("Ziel einer Blocker-Abhängigkeit")).not.toBeInTheDocument();
    rerender(<FeaturesListView model={model([row({ isBlocked: true })])} />);
    expect(screen.getByTitle("Ziel einer Blocker-Abhängigkeit")).toBeInTheDocument();
  });

  it("unbekannter Status fällt auf den Rohwert zurück", () => {
    render(<FeaturesListView model={model([row({ status: "irgendwas" })])} />);
    expect(screen.getByText("irgendwas")).toBeInTheDocument();
  });

  it("die WSJF-Spalte folgt der Practice, auch wenn sie angefordert wird", () => {
    render(<FeaturesListView model={model([row()], false)} columns={["wsjf", "ak"]} />);
    expect(screen.queryByText("WSJF")).not.toBeInTheDocument();
  });

  it("Slots werden nur gerendert, wenn sie übergeben sind", () => {
    const { rerender } = render(<FeaturesListView model={model([row()])} />);
    expect(screen.queryByText("Bearbeiten")).not.toBeInTheDocument();

    rerender(
      <FeaturesListView
        model={model([row()])}
        renderActions={() => <button type="button">Bearbeiten</button>}
        renderExpanded={() => <p>Formular</p>}
        renderStatus={() => <span>Dropdown</span>}
      />,
    );
    expect(screen.getByText("Bearbeiten")).toBeInTheDocument();
    expect(screen.getByText("Formular")).toBeInTheDocument();
    expect(screen.getByText("Dropdown")).toBeInTheDocument();
  });
});
