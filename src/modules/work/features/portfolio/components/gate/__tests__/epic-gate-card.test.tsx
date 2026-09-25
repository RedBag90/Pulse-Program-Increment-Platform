import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, within } from "@testing-library/react";

// Server-Actions und `@/i18n/navigation` lösen unter vitest nicht auf — für
// diese Tests genügen ein Anker und drei Platzhalter.
vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, ...props }: { children: React.ReactNode }) => <a {...props}>{children}</a>,
}));
vi.mock("@/modules/work/features/portfolio/actions/stage-gate", () => ({
  requestGateTransitionAction: vi.fn(),
  decideGateTransitionAction: vi.fn(),
  withdrawGateTransitionAction: vi.fn(),
}));
vi.mock("@/modules/work/features/portfolio/actions/epic", () => ({
  setEpicHelpRequestedAction: vi.fn(),
}));

import { EpicGateCard } from "@/modules/work/features/portfolio/components/gate/epic-gate-card";
import {
  gateReadiness,
  GATE_CRITERIA,
  type EpicGateFacts,
} from "@/modules/work/domain/gate-readiness";
import type { EpicGateSlice } from "@/modules/work/server/views/epic-detail";

/**
 * **Die Kachel sagt, was zu tun ist.**
 *
 * Sie trug bis September 2026 eine Zustandsmeldung als Überschrift und darunter
 * eine Checkliste in `text-xs`, deren Sprunglinks in einem Popover hinter einem
 * Text in halber Deckkraft steckten. Ausserdem kannte die Liste zum Schritt nach
 * L2 nur den Business Case — die drei anderen Reiter derselben Stufe nicht.
 */

const EPIC = "11111111-1111-4111-8111-111111111111";

function facts(over: Partial<EpicGateFacts> = {}): EpicGateFacts {
  return {
    stageGate: "L1",
    ownerId: null,
    hypothesisApprovedAt: new Date("2026-01-01"),
    hasHypothesisContent: true,
    hasBusinessCaseContent: false,
    businessCaseApprovedAt: null,
    budgetAllocationSum: 0,
    childFeatureStats: { total: 0, started: 0, completed: 0 },
    kpiCount: 0,
    dependencyCount: 0,
    selectedForDetailingAt: null,
    selectedForAnalyzingAt: new Date("2026-02-01"),
    implementationStartedAt: null,
    implementationCompletedAt: null,
    approvedAt: null,
    impactRecognizedAt: null,
    solutionHorizon: null,
    investmentHorizon: null,
    multiPartyApproval: true,
    budgetingEnabled: true,
    drumbeatEnabled: true,
    intendedClass: null,
    hasGoalLink: false,
    ...over,
  };
}

type AktiveKachel = Extract<EpicGateSlice, { disabled: false }>;

/** Die Kachel eines Epics, das „zur Analyse ausgewählt" ist — nächster Schritt L2. */
function slice(over: Partial<EpicGateFacts> = {}): AktiveKachel {
  return {
    disabled: false,
    current: "analysis",
    next: "L2",
    readiness: gateReadiness(facts(over), "L2"),
    openRequest: null,
    history: [],
    canRequest: true,
    canWithdraw: false,
    canRevert: false,
    viewerMustDecide: false,
    helpRequested: false,
    canRequestHelp: false,
    partyStaffing: null,
  };
}

function karte(over: Partial<EpicGateFacts> = {}) {
  return render(<EpicGateCard epicId={EPIC} gate={slice(over)} approvers={[]} userLabels={{}} />);
}

describe("EpicGateCard — der Kopf", () => {
  it("nennt im Titel den nächsten Schritt und darunter den heutigen Stand", () => {
    karte();
    expect(
      screen.getByRole("heading", { name: /To-dos für L2 Business Case freigegeben/ }),
    ).toBeTruthy();
    expect(screen.getByText(/Reifegrad heute:/)).toBeTruthy();
  });

  it("behauptet am Endgate keine To-dos", () => {
    render(
      <EpicGateCard
        epicId={EPIC}
        gate={{ ...slice(), current: "L5", next: null, readiness: null, canRequest: false }}
        approvers={[]}
        userLabels={{}}
      />,
    );
    expect(screen.queryByRole("heading", { name: /To-dos/ })).toBeNull();
    expect(screen.getByText(/Endgate erreicht/)).toBeTruthy();
  });
});

describe("EpicGateCard — die Checkliste", () => {
  it("führt die vier Reiter der Stufe, jeder mit sichtbarem Link — ohne Aufklappen", () => {
    karte();
    const zeilen = screen.getAllByRole("listitem");
    const ziele = zeilen.map((li) => within(li).queryByRole("link")?.textContent?.trim());

    expect(ziele).toEqual([
      "Zum Business Case",
      "Zu den Deliverables",
      "Zu den Dependencies",
      "Zu KPI & Nutzen",
      "Zum Overview",
    ]);
    // Der Weg zum Reiter steckte vorher hinter diesem Knopf.
    expect(screen.queryByText("How to")).toBeNull();
  });

  it("verlinkt jede Zeile auf den Reiter, in dem man sie erfüllt", () => {
    karte();
    const dep = screen.getByRole("link", { name: /Zu den Dependencies/ });
    expect(dep.getAttribute("href")).toBe(`/portfolio/epics/${EPIC}?tab=dependencies`);
  });

  it("setzt den Haken, sobald im Reiter Inhalt steht", () => {
    const { container } = karte({
      childFeatureStats: { total: 2, started: 0, completed: 0 },
      kpiCount: 1,
    });
    const erledigt = Array.from(container.querySelectorAll("li"))
      .filter((li) => li.querySelector(".text-success") !== null)
      .map((li) => li.textContent ?? "");

    expect(erledigt.some((t) => t.includes("Deliverables sind geschnitten"))).toBe(true);
    expect(erledigt.some((t) => t.includes("KPI sind definiert"))).toBe(true);
    // Ungepflegt bleibt offen — und ohne Häkchen.
    expect(erledigt.some((t) => t.includes("Abhängigkeiten sind erfasst"))).toBe(false);
  });

  it("markiert die Ausnahme, nicht die Regel", () => {
    karte();
    // Genau ein Punkt blockiert; nur er trägt eine Marke. Vorher hing an jedem
    // beratenden Kriterium ein „(optional)" — bei vier von fünf reines Rauschen.
    expect(screen.getAllByText("Pflicht")).toHaveLength(1);
    expect(screen.queryByText("(optional)")).toBeNull();
  });
});

describe("Kriterium → Reiter", () => {
  it("gibt jedem Punkt der L2-Liste ein Sprungziel", () => {
    // Fehlt eines, rendert die Zeile still ohne Link — der Mangel, der diesen
    // Zug ausgelöst hat, nur eine Ebene tiefer.
    karte();
    for (const li of screen.getAllByRole("listitem")) {
      expect(within(li).queryByRole("link"), li.textContent ?? "").toBeTruthy();
    }
    expect(GATE_CRITERIA.L2).toHaveLength(5);
  });
});
