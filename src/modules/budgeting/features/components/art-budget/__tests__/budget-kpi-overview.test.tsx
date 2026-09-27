import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, within } from "@testing-library/react";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: React.ReactNode; href?: string }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("@/modules/budgeting/features/components/art-budget/rate-estimate-form", () => ({
  RateEstimateForm: ({ current }: { current: number | null }) => (
    <div>Formular Schätzung {current ?? "leer"}</div>
  ),
}));
vi.mock("@/modules/budgeting/features/components/art-budget/job-size-burn-chart", () => ({
  JobSizeBurnChart: ({ burn }: { burn: { cycleKey: string } | null }) => (
    <div>Diagramm {burn ? "mit" : "ohne"} Verlauf</div>
  ),
}));

import {
  CoverageTable,
  DeliveryCard,
  KpiTiles,
  RateCheckBanner,
  type CoverageRow,
  type DeliveryRow,
} from "@/modules/budgeting/features/components/art-budget/budget-kpi-overview";
import type { ArtCoverage } from "@/modules/budgeting/domain/art-budget-model";
import type { JobSizeRate } from "@/modules/budgeting/domain/art-throughput";
import type { JobSizeBurn } from "@/modules/budgeting/domain/job-size-burn";
import type { StreamKpi } from "@/modules/budgeting/server/views/budget-kpis";

/**
 * **Der Reiter „Budget-KPIs"** — Kacheln, Hinweis, Deckungstabelle, Lieferung.
 * Zahlen wie im Wertstrom „Produktion" (H2 2026).
 */

const satz = (over: Partial<JobSizeRate> = {}): JobSizeRate => ({
  source: "none",
  rate: null,
  artEstimate: null,
  cycles: [],
  budgetSum: 0,
  jobSizeSum: 0,
  featureCount: 0,
  standaloneJobSizeSum: 0,
  standaloneFeatureCount: 0,
  caveats: [{ code: "noCompletions", values: {} }],
  ...over,
});

const verlauf = (over: Partial<JobSizeBurn> = {}): JobSizeBurn => ({
  cycleKey: "2026-H2",
  reason: "ok",
  start: new Date("2026-07-06T00:00:00Z"),
  end: new Date("2027-01-01T00:00:00Z"),
  extended: false,
  today: new Date("2026-09-27T00:00:00Z"),
  expected: 97,
  planToday: 45,
  actualToday: 293,
  deviation: 5.45,
  withinBand: false,
  actual: [],
  ...over,
});

const deckung = (rate: JobSizeRate, over: Partial<ArtCoverage> = {}): ArtCoverage => ({
  plannedJobSize: 40,
  featureCount: 4,
  plannedStandalone: { jobSize: 0, count: 0 },
  plannedByBucket: {
    business: { count: 0, jobSize: 0 },
    enabler: { count: 0, jobSize: 0 },
    maintenance: { count: 0, jobSize: 0 },
  },
  plannedUnclassified: { count: 0, jobSize: 0 },
  rate,
  loadEuro: rate.rate == null ? null : 40 * rate.rate,
  allocated: 100_000,
  gap: rate.rate == null ? null : 40 * rate.rate - 100_000,
  burn: null,
  cycleCompletions: [],
  ...over,
});

const strom = (over: Partial<StreamKpi> = {}): StreamKpi => ({
  plannedJobSize: 541,
  featureCount: 96,
  loadEuro: 7_048_776,
  allocated: 744_800,
  gap: 6_303_976,
  withoutRate: [],
  burn: verlauf(),
  ...over,
});

describe("KpiTiles — zwei Kacheln, jede mit ihrem Zeitraum", () => {
  it("Deckung im gewählten Halbjahr, Lieferung in der Kachel", () => {
    render(<KpiTiles stream={strom()} cycleKey="2026-H2" artCount={2} isTotal />);
    expect(screen.getByText("Deckung · H2 2026")).toBeInTheDocument();
    expect(screen.getByText("Lieferung · Kachel H2 2026")).toBeInTheDocument();
    expect(screen.getByText(/^Σ Wertstrom · /)).toBeInTheDocument();
  });

  it("die Lücke als Wort, ohne Minuszeichen", () => {
    const { container } = render(
      <KpiTiles stream={strom()} cycleKey="2026-H2" artCount={2} isTotal />,
    );
    expect(screen.getByText("Überbucht")).toBeInTheDocument();
    expect(screen.getByText(/^fehlen 6,3/)).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/-6[.,]3/);
    expect(screen.getByText("Über Plan")).toBeInTheDocument();
    expect(screen.getByText("+545 %")).toBeInTheDocument();
  });

  it("gedeckt: X frei", () => {
    render(
      <KpiTiles
        stream={strom({ loadEuro: 500_000, gap: -244_800 })}
        cycleKey="2026-H2"
        artCount={2}
        isTotal
      />,
    );
    expect(screen.getByText("Gedeckt")).toBeInTheDocument();
    expect(screen.getByText(/frei$/)).toBeInTheDocument();
  });

  it("ohne Wertstrom-Recht: die eigenen ARTs, ohne geltende Kachel: kein Plan", () => {
    render(
      <KpiTiles stream={strom({ burn: null })} cycleKey="2026-H2" artCount={1} isTotal={false} />,
    );
    expect(screen.getByText(/^Σ deiner ARTs · /)).toBeInTheDocument();
    expect(screen.getByText("Kein Plan")).toBeInTheDocument();
    expect(screen.getByText(/^Keine geltende Budget-Kachel/)).toBeInTheDocument();
  });
});

describe("RateCheckBanner", () => {
  it("nennt die ARTs, deren Satz zu prüfen ist", () => {
    render(
      <RateCheckBanner
        suspicions={[{ artId: "a1", name: "Materials & Energy", direction: "high" }]}
      />,
    );
    expect(screen.getByText("Satz prüfen")).toBeInTheDocument();
    expect(screen.getByText(/Betroffen: Materials & Energy/)).toBeInTheDocument();
  });

  it("ohne Verdacht kein Hinweis", () => {
    const { container } = render(<RateCheckBanner suspicions={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

const zeile = (coverage: ArtCoverage, over: Partial<CoverageRow> = {}): CoverageRow => ({
  artId: "a1",
  name: "ART 1",
  coverage,
  ...over,
});

describe("CoverageTable — Last gegen Budget je ART", () => {
  it("Σ nur mit Wertstrom-Recht", () => {
    const { container, rerender } = render(
      <CoverageTable
        rows={[zeile(deckung(satz({ source: "empirical", rate: 3_000 })))]}
        stream={strom()}
        cycleKey="2026-H2"
        suspicions={[]}
      />,
    );
    expect(container.querySelector('[data-row="summe"]')).not.toBeNull();
    rerender(
      <CoverageTable
        rows={[zeile(deckung(satz({ source: "empirical", rate: 3_000 })))]}
        stream={null}
        cycleKey="2026-H2"
        suspicions={[]}
      />,
    );
    expect(container.querySelector('[data-row="summe"]')).toBeNull();
  });

  it("die Quelle des Satzes als Wort, der Verdacht als Chip", () => {
    render(
      <CoverageTable
        rows={[zeile(deckung(satz({ source: "empirical", rate: 21_490, caveats: [] })))]}
        stream={null}
        cycleKey="2026-H2"
        suspicions={[{ artId: "a1", name: "ART 1", direction: "high" }]}
      />,
    );
    expect(screen.getByText("empirisch")).toBeInTheDocument();
    expect(screen.getByText("prüfen")).toBeInTheDocument();
  });

  it("die Vorbehalte übersetzt, die Halbjahre des Satzes als Tabelle", () => {
    const { container } = render(
      <CoverageTable
        rows={[
          zeile(
            deckung(
              satz({
                source: "empirical",
                rate: 21_490,
                cycles: [
                  {
                    cycleKey: "2025-H2",
                    budget: 357_200,
                    jobSize: 0,
                    featureCount: 0,
                    standaloneJobSize: 0,
                    standaloneFeatureCount: 0,
                  },
                  {
                    cycleKey: "2026-H1",
                    budget: 287_500,
                    jobSize: 30,
                    featureCount: 4,
                    standaloneJobSize: 13,
                    standaloneFeatureCount: 1,
                  },
                ],
                budgetSum: 644_700,
                jobSizeSum: 30,
                featureCount: 4,
                caveats: [{ code: "emptyCycles", values: { empty: 1, total: 2 } }],
              }),
            ),
          ),
        ]}
        stream={null}
        cycleKey="2026-H2"
        suspicions={[]}
      />,
    );
    expect(
      screen.getByText(/^In 1 von 2 Halbjahren des Fensters wurde nichts fertiggestellt/),
    ).toBeInTheDocument();
    const tabelle = container.querySelector('[data-kpi="rate-cycles"]') as HTMLElement;
    expect(within(tabelle).getByText("H2 2025")).toBeInTheDocument();
    expect(within(tabelle).getByText("644.700 €")).toBeInTheDocument();
  });

  // Die vier Fälle der früheren Satz-Herleitung, jetzt unter „Wie gerechnet?".
  it("kein Satz, mit Recht: „Wie gerechnet?“ steht offen, mit Formular", () => {
    const { container } = render(
      <CoverageTable
        rows={[zeile(deckung(satz()), { estimate: { artId: "a1" } })]}
        stream={null}
        cycleKey="2026-H2"
        suspicions={[]}
      />,
    );
    expect(screen.getByText("Formular Schätzung leer")).toBeInTheDocument();
    expect(container.querySelector("details")?.hasAttribute("open")).toBe(true);
    expect(screen.getByText("kein Satz")).toBeInTheDocument();
  });

  it("kein Satz, ohne Recht: kein Formular, aber wer schätzen darf", () => {
    render(
      <CoverageTable
        rows={[zeile(deckung(satz()))]}
        stream={null}
        cycleKey="2026-H2"
        suspicions={[]}
      />,
    );
    expect(screen.queryByText(/^Formular/)).toBeNull();
    expect(screen.getByText(/^Schätzen dürfen Admin/)).toBeInTheDocument();
  });

  it("Schätzung aktiv: als Schätzung gekennzeichnet, änderbar", () => {
    render(
      <CoverageTable
        rows={[
          zeile(deckung(satz({ source: "artEstimate", rate: 2_500, artEstimate: 2_500 })), {
            estimate: { artId: "a1" },
          }),
        ]}
        stream={null}
        cycleKey="2026-H2"
        suspicions={[]}
      />,
    );
    expect(screen.getByText("geschätzt")).toBeInTheDocument();
    expect(screen.getByText(/^Geschätzter Satz · 2\.500/)).toBeInTheDocument();
    expect(screen.getByText("Formular Schätzung 2500")).toBeInTheDocument();
  });

  it("wieder ableitbar: gemessener Satz, die Schätzung nur noch als Hinweis", () => {
    render(
      <CoverageTable
        rows={[
          zeile(
            deckung(satz({ source: "empirical", rate: 3_000, artEstimate: 2_500, caveats: [] })),
            { estimate: { artId: "a1" } },
          ),
        ]}
        stream={null}
        cycleKey="2026-H2"
        suspicions={[]}
      />,
    );
    expect(screen.getByText(/wird nicht mehr gebraucht/)).toBeInTheDocument();
    expect(screen.queryByText(/^Formular/)).toBeNull();
  });
});

describe("DeliveryCard — ein Diagramm, eine Tabelle", () => {
  const rows: DeliveryRow[] = [
    { artId: "a1", name: "ART 1", burn: verlauf({ deviation: 20.2 }), href: "?kpiArt=a1" },
    {
      artId: "a2",
      name: "ART 2",
      burn: verlauf({ reason: "noRate", expected: null, planToday: null, deviation: null }),
      href: "?kpiArt=a2",
    },
    { artId: null, name: "Σ Wertstrom", burn: verlauf(), href: "?" },
  ];

  it("die gewählte Zeile ist markiert, ein ART ohne Plan hat einen Grund", () => {
    const { container } = render(<DeliveryCard rows={rows} selected={rows[2]!} />);
    expect(container.querySelector('[data-row="summe"]')?.getAttribute("aria-current")).toBe(
      "true",
    );
    const ohne = container.querySelector('[data-row="a2"]') as HTMLElement;
    expect(within(ohne).getByText("kein Satz")).toBeInTheDocument();
    expect(screen.getByText("Diagramm mit Verlauf")).toBeInTheDocument();
    expect(screen.getByText(/^Kachel H2 2026/)).toBeInTheDocument();
  });
});
