import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";

/**
 * **Bei L0 zeigt das Overview, wo man anfängt.**
 *
 * Auf L0 ist ein Epic noch nicht eingeordnet — Typ und Horizont fehlen, Titel
 * und Wertstrom sind roh, Owner und Solution unbesetzt. Genau die Kacheln, in
 * denen man das erledigt, tragen dort Ring und Akzentschiene; die Akte daneben
 * (Wirtschaftlichkeit, Governance, Budget, Zeitfenster) bleibt still.
 *
 * Geprüft wird am Ring, nicht an der Klassenkette: er ist das einzige Element,
 * das `SectionCard` für `atGate` zusätzlich rendert — dieselbe Haltung wie im
 * Test der Reiterschiene.
 */

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, ...rest }: { children?: ReactNode; href?: string }) => (
    <a {...rest}>{children}</a>
  ),
}));
vi.mock("@/modules/work/features/portfolio/components/epic-edit-form", () => ({
  EpicEditForm: () => <div data-testid="edit-form" />,
}));

const { EpicOverviewTab } =
  await import("@/modules/work/features/portfolio/components/epic-overview-tab");

const EPIC = {
  id: "e1",
  title: "Test Epic 1",
  description: null,
  stageGate: "L0",
  status: "in_progress",
  ownerId: null,
  updatedAt: new Date("2026-09-01"),
  approvedAt: null,
  plannedStartAt: null,
  plannedEndAt: null,
  valueStream: { id: "vs1", name: "Elefanten-Wertstrom 1" },
  artId: null,
  primarySolution: null,
  investmentHorizon: null,
  businessCaseApprovedAt: null,
  solutionLinks: [],
  businessCase: null,
  children: [],
  needsSteeringAttention: false,
  stagedForBudgeting: false,
  impactRecognizedAt: null,
  epicType: null,
};

function setup(over: { currentGate?: string; canEdit?: boolean } = {}) {
  const { container } = render(
    <EpicOverviewTab
      epic={EPIC}
      canEdit={over.canEdit ?? true}
      canOverrideHorizon={false}
      totals={{ implementationCost: 0, oneTimeBenefit: 0, recurringBenefit: 0 }}
      solutions={[]}
      {...(over.currentGate != null ? { currentGate: over.currentGate } : {})}
    />,
  );
  return container;
}

/** Die Überschriften der Kacheln, die den Ring tragen. */
function mitRing(container: HTMLElement): string[] {
  return [...container.querySelectorAll("h2")]
    .filter((h) => h.querySelector("span[aria-hidden]") != null)
    .map((h) => h.textContent?.trim() ?? "");
}

describe("Epic-Overview — die Kacheln bei L0", () => {
  it("markiert genau die drei Kacheln, in denen man das Epic in Ordnung bringt", () => {
    // „Strategische Beiträge" fehlt hier bewusst: die Kachel rendert nichts,
    // solange kein Ziel verknüpft ist, und sie kommt als Slot von der Seite.
    expect(mitRing(setup({ currentGate: "L0" }))).toEqual([
      "Vorhaben bearbeiten",
      "Einordnung",
      "Zuordnung",
    ]);
  });

  it("lässt die Akte daneben still", () => {
    const container = setup({ currentGate: "L0" });
    const alle = [...container.querySelectorAll("h2")].map((h) => h.textContent?.trim());

    // Sie stehen da — nur ohne Marke. Eine Fläche, auf der jede Kachel leuchtet,
    // hebt nichts mehr hervor.
    expect(alle).toContain("Governance");
    expect(alle).toContain("Zeitfenster");
    expect(mitRing(container)).not.toContain("Governance");
    expect(mitRing(container)).not.toContain("Zeitfenster");
  });

  it("markiert ab L1 keine einzige — dort führt die Reiterschiene", () => {
    expect(mitRing(setup({ currentGate: "L1" }))).toEqual([]);
    expect(mitRing(setup({ currentGate: "L2" }))).toEqual([]);
  });

  it("markiert gar nichts, wenn der Reifegrad fehlt", () => {
    expect(mitRing(setup())).toEqual([]);
  });

  it("fordert nicht zum Bearbeiten auf, wo man nicht bearbeiten darf", () => {
    // Ohne das Recht heisst die Kachel „Beschreibung" und ist reine Anzeige.
    const container = setup({ currentGate: "L0", canEdit: false });

    expect(mitRing(container)).toEqual(["Einordnung", "Zuordnung"]);
    expect(screen.getByText("Beschreibung")).toBeInTheDocument();
  });
});
