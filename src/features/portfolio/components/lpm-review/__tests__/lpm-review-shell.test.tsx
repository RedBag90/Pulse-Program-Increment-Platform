import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { LpmReviewShell } from "@/features/portfolio/components/lpm-review/lpm-review-shell";
import type { LpmReviewPageData } from "@/server/views/lpm-review-view";

// next/navigation braucht im Test einen Router-Kontext — minimal stubben,
// damit useUrlState (usePathname/useRouter/useSearchParams) läuft.
vi.mock("next/navigation", () => ({
  usePathname: () => "/de/portfolio/review",
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

// Recharts-Charts brauchen im jsdom eine Größe (ResponsiveContainer) und hängen
// sonst — die Charts sind tsc-geprüft + eigenständig; hier stubben wir sie, um
// die Shell-Struktur (Kopf, Karten, Tabellen, Drilldown) zu verifizieren.
vi.mock("@/features/portfolio/components/lpm-review/benefit-waterfall", () => ({
  BenefitWaterfall: () => <div data-testid="waterfall" />,
}));
vi.mock("@/features/portfolio/components/lpm-review/benefit-burnup", () => ({
  BenefitBurnup: () => <div data-testid="burnup" />,
}));
vi.mock("@/features/portfolio/components/lpm-review/portfolio-bubble-matrix", () => ({
  PortfolioBubbleMatrix: () => <div data-testid="matrix" />,
}));
vi.mock("@/features/portfolio/components/lpm-review/diverging-schedule-bar", () => ({
  DivergingScheduleBar: () => <div data-testid="diverging" />,
}));

const data: LpmReviewPageData = {
  asOfMs: Date.parse("2026-09-30"),
  asOfIso: "2026-09-30",
  periodLabel: "Q3 / 2026",
  activePiId: null,
  pis: [{ id: "pi3", label: "PI 3", endMs: Date.parse("2026-09-30") }],
  model: {
    portfolio: {
      benefitPlan: 142_000_000,
      benefitForecast: 130_600_000,
      benefitDelta: -11_400_000,
      benefitDeltaRatio: -0.08,
      plantreue: 0.79,
      performance: 0.78,
      ampel: "amber",
      epicTotal: 21,
      epicsOnPlan: 14,
      epicsAtRisk: 5,
      epicsCritical: 2,
    },
    valueStreams: [
      {
        id: "vs1",
        name: "Payments",
        benefitPlan: 58_000_000,
        benefitForecast: 55_100_000,
        plantreue: 0.92,
        performance: 0.88,
        ampel: "green",
        epicCount: 6,
      },
    ],
    epics: [
      {
        id: "e1",
        title: "KYC-Automatisierung",
        valueStreamId: "vs1",
        valueStreamName: "Payments",
        benefitPlan: 12_000_000,
        benefitForecast: 9_600_000,
        plantreue: 0.41,
        performance: 0.41,
        progressActual: 0.41,
        progressTarget: 1,
        terminabweichungPis: 2,
        ampel: "rose",
        entscheidung: "Pivot / Stop?",
      },
    ],
    waterfall: [
      { kind: "start", label: "Benefit Plan", value: 142_000_000 },
      { kind: "loss", label: "Payments", value: -2_900_000 },
      { kind: "end", label: "Benefit Forecast", value: 130_600_000 },
    ],
    burnup: [
      {
        piId: "pi3",
        label: "PI 3",
        plannedCum: 80_000_000,
        realizedCum: 60_000_000,
        forecastCum: 60_000_000,
      },
    ],
  },
};

describe("LpmReviewShell — Render-Smoke", () => {
  it("rendert Kopf + alle drei Abschnitte ohne Laufzeitfehler", () => {
    render(<LpmReviewShell data={data} />);
    expect(screen.getByText("Portfolio Review — Q3 / 2026")).toBeInTheDocument();
    expect(screen.getByText("Portfolio gesamt")).toBeInTheDocument();
    expect(screen.getByText("Value Streams")).toBeInTheDocument();
    expect(screen.getByText("Epics")).toBeInTheDocument();
    // KPI-Karten + eine Kernzahl
    expect(screen.getByText("Benefit geplant")).toBeInTheDocument();
    expect(screen.getByText("142,0 Mio €")).toBeInTheDocument();
    // Tabellen-Inhalte ("Payments" erscheint auch im Filter-Dropdown → getAllByText)
    expect(screen.getAllByText("Payments").length).toBeGreaterThan(0);
    expect(screen.getByText("KYC-Automatisierung")).toBeInTheDocument();
    expect(screen.getByText("Pivot / Stop?")).toBeInTheDocument();
  });
});
