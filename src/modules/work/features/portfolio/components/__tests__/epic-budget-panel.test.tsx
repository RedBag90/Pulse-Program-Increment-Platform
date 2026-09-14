import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { EpicBudgetPanel } from "@/modules/work/features/portfolio/components/epic-budget-panel";
import type { EpicBudgetStandingView } from "@/modules/work/server/views/epic-detail";

/**
 * **Der Zeitraum muss im Text stehen.**
 *
 * Genau das ging beim Umbau auf die Bauteil-Bibliothek verloren, ohne dass
 * irgendetwas rot wurde: der Stand wurde weiter berechnet und weiter
 * durchgereicht, nur nicht mehr gelesen. Ein Test über die Daten hätte das
 * nicht gemerkt — er muss über das **Gerenderte** gehen.
 */
const utc = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const FUNDABLE = { may: true, firstStep: "L3.1" };

const standing = (over: Partial<EpicBudgetStandingView> = {}): EpicBudgetStandingView => ({
  state: "applies",
  currentAmount: 400_000,
  currentPeriod: { cycleKey: "2026-H1", start: utc("2026-01-01"), end: utc("2026-06-30") },
  totalAmount: 400_000,
  cycleCount: 1,
  span: { start: utc("2026-01-01"), end: utc("2026-06-30") },
  startsAt: null,
  periods: [
    {
      cycleKey: "2026-H1",
      amount: 400_000,
      start: utc("2026-01-01"),
      end: utc("2026-06-30"),
      applies: true,
    },
  ],
  ...over,
});

describe("EpicBudgetPanel", () => {
  it("geltendes Budget: Betrag, Geltung und der Zeitraum", () => {
    render(<EpicBudgetPanel standing={standing()} allocationState={null} fundable={FUNDABLE} />);
    expect(screen.getByText(/gilt jetzt/)).toBeTruthy();
    // Der Zeitraum — die Regression, die dieser Test verhindert. Er steht zu
    // Recht zweimal da: in der Kopfzeile und in der Zeile seines Zeitraums.
    expect(screen.getAllByText(/1\. Jan\. 2026 – 30\. Juni 2026/).length).toBeGreaterThan(0);
  });

  it("künftiges Budget: das Startdatum, nicht nur „später“", () => {
    render(
      <EpicBudgetPanel
        standing={standing({
          state: "upcoming",
          currentAmount: 0,
          currentPeriod: null,
          startsAt: utc("2026-07-01"),
        })}
        allocationState={null}
        fundable={FUNDABLE}
      />,
    );
    expect(screen.getByText(/gilt ab 1\. Juli 2026/)).toBeTruthy();
    expect(screen.queryByText(/gilt später/)).toBeNull();
  });

  it("künftiges Budget ohne Kachel: sagt, dass der Rahmen noch fehlt", () => {
    render(
      <EpicBudgetPanel
        standing={standing({ state: "upcoming", currentAmount: 0, currentPeriod: null })}
        allocationState={null}
        fundable={FUNDABLE}
      />,
    );
    expect(screen.getByText(/Rahmen noch in Ausarbeitung/)).toBeTruthy();
  });

  it("abgelaufenes Budget nennt die Spanne", () => {
    render(
      <EpicBudgetPanel
        standing={standing({ state: "expired", currentAmount: 0, currentPeriod: null })}
        allocationState={null}
        fundable={FUNDABLE}
      />,
    );
    expect(screen.getByText(/Rahmen abgelaufen/)).toBeTruthy();
    expect(screen.getAllByText(/1\. Jan\. 2026 – 30\. Juni 2026/).length).toBeGreaterThan(0);
  });

  it("mehrere Zyklen: Geltung UND Summe, nicht das eine statt des anderen", () => {
    // Vorher trug die eine Hinweiszeile die Summe *anstelle* der Geltung.
    render(
      <EpicBudgetPanel
        standing={standing({ totalAmount: 1_000_000, cycleCount: 3 })}
        allocationState={null}
        fundable={FUNDABLE}
      />,
    );
    expect(screen.getByText(/gilt jetzt/)).toBeTruthy();
    expect(screen.getByText(/über 3 Zeiträume/)).toBeTruthy();
  });

  it("zeigt die Aufteilung je Zeitraum", () => {
    render(
      <EpicBudgetPanel
        standing={standing({
          totalAmount: 1_000_000,
          cycleCount: 2,
          periods: [
            {
              cycleKey: "2026-H1",
              amount: 400_000,
              start: utc("2026-01-01"),
              end: utc("2026-06-30"),
              applies: true,
            },
            { cycleKey: "2026-H2", amount: 600_000, start: null, end: null, applies: false },
          ],
        })}
        allocationState={null}
        fundable={FUNDABLE}
      />,
    );
    expect(screen.getByText("H1 2026")).toBeTruthy();
    expect(screen.getByText("H2 2026")).toBeTruthy();
    // Ein Zyklus ohne Kachel bekommt keine erfundene Spanne.
    expect(screen.getByText("—")).toBeTruthy();
  });

  it("zeigt den Zustand der Zuteilung, wenn er mitkommt", () => {
    render(
      <EpicBudgetPanel
        standing={standing()}
        allocationState={{ key: "committed", label: "Gebunden" }}
        fundable={FUNDABLE}
      />,
    );
    expect(screen.getByText("Gebunden")).toBeTruthy();
  });

  it("ohne Budget vor L3.1: erklärt, statt nur zu melden", () => {
    render(
      <EpicBudgetPanel
        standing={standing({ state: "none" })}
        allocationState={null}
        fundable={{ may: false, firstStep: "L3.1" }}
      />,
    );
    expect(screen.getByText(/Budget gibt es erst ab L3\.1/)).toBeTruthy();
  });

  it("ohne Budget ab L3.1: schlicht keins zugeteilt", () => {
    render(
      <EpicBudgetPanel
        standing={standing({ state: "none" })}
        allocationState={null}
        fundable={FUNDABLE}
      />,
    );
    expect(screen.getByText("Kein Budget zugeteilt.")).toBeTruthy();
  });
});
