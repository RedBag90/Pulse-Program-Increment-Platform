import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { CompactKanban } from "@/modules/work/features/portfolio/overview/blocks/compact-kanban";
import type {
  OverviewEpicCard,
  PortfolioOverview,
} from "@/modules/work/server/views/portfolio-overview";
import { HORIZON_LANES } from "@/modules/work/domain/portfolio-guardrails";
import {
  PORTFOLIO_COLUMNS,
  PORTFOLIO_COLUMN_LABELS,
  type PortfolioColumn,
} from "@/modules/work/features/portfolio/lib/epic-lifecycle";

/**
 * **Das Board mit und ohne Horizont-Achse.**
 *
 * Die Kachel hatte keinen Test — und die Zusammensetzung der Portfolio-Übersicht
 * hat bis heute überhaupt keinen. Ein abgeschaltetes Horizont-Band wäre also von
 * nichts bemerkt worden.
 *
 * Geprüft wird die eine Eigenschaft, die beim Umschalten schiefgehen kann: das
 * Board darf dabei **keine Epics verlieren**. Es zeichnet ohne Bahnen aus
 * `epicsByColumn` statt aus der Summe der Bahnen — zwei Wege zur selben Zahl,
 * und nur einer davon zählt auch die Spaltenköpfe.
 */

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, ...props }: { children: React.ReactNode }) => <a {...props}>{children}</a>,
}));

const epic = (id: string, horizon: string | null): OverviewEpicCard =>
  ({ id, title: `Epic ${id}`, horizon, needsSteeringAttention: false }) as OverviewEpicCard;

/**
 * Fünf Epics über zwei Spalten und vier Bahnen.
 *
 * Die Bahnen sind `HORIZON_LANES` — die **Horizonte** eines Epics (h3, h2, h1,
 * h0, ohne). Nicht die fünf Stationen der Guardrail-Achse: H1 zerfällt nur dort
 * in Investing und Extracting, ein Epic trägt schlicht „h1".
 */
const EPICS: { epic: OverviewEpicCard; lane: string; col: PortfolioColumn }[] = [
  { epic: epic("a", "h3"), lane: "h3", col: "funnel" },
  { epic: epic("b", "h3"), lane: "h3", col: "funnel" },
  { epic: epic("c", "h2"), lane: "h2", col: "investment" },
  { epic: epic("d", "h1"), lane: "h1", col: "investment" },
  { epic: epic("e", null), lane: "none", col: "investment" },
];

function data(horizonOnOverview: boolean): PortfolioOverview {
  const leer = <T,>(fill: () => T): Record<PortfolioColumn, T> =>
    Object.fromEntries(PORTFOLIO_COLUMNS.map((c) => [c, fill()])) as Record<PortfolioColumn, T>;

  const epicsByColumn = leer<OverviewEpicCard[]>(() => []);
  const epicsByHorizonGate = Object.fromEntries(
    HORIZON_LANES.map((l) => [l, leer<OverviewEpicCard[]>(() => [])]),
  ) as PortfolioOverview["epicsByHorizonGate"];

  for (const { epic: e, lane, col } of EPICS) {
    epicsByColumn[col].push(e);
    epicsByHorizonGate[lane as keyof typeof epicsByHorizonGate][col].push(e);
  }

  return {
    epicsByColumn,
    epicsByHorizonGate,
    horizonBudgets: Object.fromEntries(
      HORIZON_LANES.map((l) => [l, { budgetiert: 0, umsetzung: 0, umgesetzt: 0 }]),
    ),
    horizonOnOverview,
    budgetCycleKey: "2026-H1",
    classFilter: { selected: [], hiddenLabel: null, hiddenClass: null, hiddenCount: 0 },
  } as unknown as PortfolioOverview;
}

/** Die Zellen des Boards — eine Reihe je Bahn, sechs je Reihe. */
const zellen = (c: HTMLElement): number => c.querySelectorAll("[class*='min-h-[52px]']").length;

/** Die Epic-Titel, die das Board zeigt — in Lesereihenfolge. */
const gezeigteEpics = (): string[] =>
  screen
    .getAllByRole("link")
    .map((a) => a.textContent?.trim() ?? "")
    .filter((t) => t.startsWith("Epic "));

describe("CompactKanban — mit Horizont-Achse", () => {
  it("nennt die Achse in der Überschrift und führt eine Bahn je Horizont", () => {
    render(<CompactKanban data={data(true)} />);
    expect(screen.getByText(/Epic Portfolio-Kanban · Horizonte/)).toBeTruthy();
    // Die Bahn-Spalte traegt den Budget-Kopf — sie gibt es nur mit Bahnen.
    expect(screen.getByText(/Budget · /)).toBeTruthy();
  });

  it("legt je Bahn eine volle Zeile an", () => {
    const { container } = render(<CompactKanban data={data(true)} />);
    expect(zellen(container)).toBe(HORIZON_LANES.length * PORTFOLIO_COLUMNS.length);
  });
});

describe("CompactKanban — ohne Horizont-Achse", () => {
  it("lässt Bahnen und Bahn-Beschriftung weg", () => {
    render(<CompactKanban data={data(false)} />);
    expect(screen.getByText("Epic Portfolio-Kanban")).toBeTruthy();
    expect(screen.queryByText(/· Horizonte/)).toBeNull();
    // Die 180px-Spalte traegt die Budgetzahlen der Bahn — ohne Bahnen entfaellt sie.
    expect(screen.queryByText(/Budget · /)).toBeNull();
  });

  it("legt genau eine Zeile an", () => {
    const { container } = render(<CompactKanban data={data(false)} />);
    expect(zellen(container)).toBe(PORTFOLIO_COLUMNS.length);
  });

  it("verliert dabei kein einziges Epic", () => {
    // Der eigentliche Punkt. Ohne Bahnen kommen die Karten aus `epicsByColumn`
    // statt aus der Summe der Bahnen; beides muss dieselbe Menge ergeben.
    const { unmount } = render(<CompactKanban data={data(true)} />);
    const mitBahnen = [...gezeigteEpics()].sort();
    unmount();

    render(<CompactKanban data={data(false)} />);
    expect([...gezeigteEpics()].sort()).toEqual(mitBahnen);
    expect(mitBahnen).toHaveLength(EPICS.length);
  });

  it("zählt in den Spaltenköpfen unverändert", () => {
    for (const an of [true, false]) {
      const { unmount } = render(<CompactKanban data={data(an)} />);
      const kopf = screen.getByText(PORTFOLIO_COLUMN_LABELS.investment).parentElement
        ?.parentElement;
      expect(kopf?.textContent, `Schalter ${an}`).toContain("3");
      unmount();
    }
  });
});
