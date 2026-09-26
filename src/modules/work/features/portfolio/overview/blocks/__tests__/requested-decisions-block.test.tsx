import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { RequestedDecisionsBlock } from "@/modules/work/features/portfolio/overview/blocks/requested-decisions-block";
import type {
  PortfolioOverview,
  RequestedDecisionRow,
} from "@/modules/work/server/views/portfolio-overview";

/**
 * **Beantragte Entscheidungen** — die Kachel unter der Steering-Agenda.
 *
 * Sie nennt den **Antrag**, nicht den erreichten Stand: „Zur Analyse
 * auswählen", nicht „Zur Analyse ausgewählt". Das Epic ist ja noch nicht dort.
 */

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, ...props }: { children: React.ReactNode }) => <a {...props}>{children}</a>,
}));

const row = (over: Partial<RequestedDecisionRow>): RequestedDecisionRow => ({
  id: "e1",
  title: "Kapazitätsplanung",
  step: "analysis",
  requestedByName: "alice@example.com",
  daysWaiting: 3,
  approvalsDone: 1,
  approvalsTotal: 5,
  valueStreamName: "Payments",
  epicClass: null,
  solution: null,
  ...over,
});

const data = (rows: RequestedDecisionRow[]): PortfolioOverview =>
  ({
    requestedDecisionEpics: rows,
    classFilter: { selected: [], hiddenClass: null, hiddenLabelKey: null },
  }) as unknown as PortfolioOverview;

describe("RequestedDecisionsBlock", () => {
  it("zeigt je Antrag Titel, Art des Antrags, Abnahmen und Wartezeit", () => {
    render(
      <RequestedDecisionsBlock
        data={data([row({}), row({ id: "e2", title: "Portal", step: "L2", approvalsDone: 2 })])}
      />,
    );
    expect(screen.getByText("Beantragte Entscheidungen")).toBeInTheDocument();
    expect(screen.getByText("Kapazitätsplanung")).toBeInTheDocument();
    expect(screen.getByText("Zur Analyse auswählen")).toBeInTheDocument();
    expect(screen.getByText("Business-Case-Freigabe")).toBeInTheDocument();
    expect(screen.getByText("2 / 5")).toBeInTheDocument();
    expect(screen.getAllByText("alice@example.com")).toHaveLength(2);
  });

  it("verlinkt auf das Epic", () => {
    render(<RequestedDecisionsBlock data={data([row({})])} />);
    expect(screen.getByText("Kapazitätsplanung").closest("a")?.getAttribute("href")).toBe(
      "/portfolio/epics/e1",
    );
  });

  it("sagt es, wenn nichts beantragt ist", () => {
    render(<RequestedDecisionsBlock data={data([])} />);
    expect(
      screen.getByText("Keine offenen Anträge auf Analyse oder Business-Case-Freigabe."),
    ).toBeInTheDocument();
  });
});
