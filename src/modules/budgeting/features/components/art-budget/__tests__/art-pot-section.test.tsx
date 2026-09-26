import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ArtPotSection } from "@/modules/budgeting/features/components/art-budget/art-pot-section";
import type { ArtPotView } from "@/modules/budgeting/domain/art-budget-model";

/**
 * **Eigene Arbeit reservieren — auch ohne ein einziges ART-Epic.**
 *
 * Gemeldet im September 2026: in einem ART ohne vorgemerktes ART-Epic stand in
 * „Rahmen verteilen" nur der Leertext. Die Zeile „ART-eigene Arbeit" hing in
 * derselben Tabelle und verschwand mit ihr; der Speichern-Knopf erschien nur,
 * wenn eine Epic-Zeile bedienbar war. Der Rahmen eines solchen ARTs liess sich
 * damit überhaupt nicht verplanen.
 */
const view = (over: Partial<ArtPotView> = {}): ArtPotView =>
  ({
    pot: {
      artId: "art-1",
      cycleKey: "2026-H2",
      total: 115_000,
      distributed: 0,
      distributedToEpics: 0,
      distributedToOwnWork: 0,
      remaining: 115_000,
      closedReason: null,
    },
    rows: [],
    ownWork: { amount: 0, ask: 0, canDistribute: true },
    ...over,
  }) as ArtPotView;

const GUIDE = { featureCount: 2, jobSize: 13, rate: 1_000, ask: 13_000 };

describe("ArtPotSection ohne ART-Epic", () => {
  it("zeigt die Zeile für eigene Arbeit samt Eingabefeld und Speichern-Knopf", () => {
    const { container } = render(
      <ArtPotSection view={view()} artId="art-1" canDistribute guide={GUIDE} />,
    );

    expect(screen.getByText(/Kein vorgemerktes ART-Epic/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Reservierung/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /speichern/i })).toBeInTheDocument();

    const ownWork = container.querySelector<HTMLInputElement>('input[name="ownWork"]');
    expect(ownWork).not.toBeNull();
    expect(JSON.parse(ownWork!.value)).toEqual({ amount: 0, ask: 13_000 });
    const amounts = container.querySelector<HTMLInputElement>('input[name="amounts"]');
    expect(JSON.parse(amounts!.value)).toEqual([]);
  });

  it("ohne Verteilrecht: Betrag sichtbar, aber kein Feld und kein Knopf", () => {
    render(
      <ArtPotSection
        view={view({ ownWork: { amount: 20_000, ask: 13_000, canDistribute: false } })}
        artId="art-1"
        canDistribute
        guide={GUIDE}
      />,
    );

    expect(screen.queryByLabelText(/Reservierung/)).toBeNull();
    expect(screen.queryByRole("button", { name: /speichern/i })).toBeNull();
    expect(screen.getAllByText(/20\.000/).length).toBeGreaterThan(0);
  });
});
