import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRef } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("@/modules/work/features/feature/actions/feature", () => ({
  scoreFeatureAction: async () => ({}),
}));
const setParam = vi.fn();
vi.mock("@/modules/drumbeat/features/lib/use-url-state", () => ({
  useUrlState: () => ({ searchParams: new URLSearchParams(), setParam, setParams: vi.fn() }),
}));

import { FeatureCard } from "@/modules/drumbeat/features/cockpit/components/feature-card";
import type { CockpitFeature } from "@/modules/drumbeat/domain/cockpit-types";

/**
 * **Das Blocker-Symbol auf der Kachel.**
 *
 * Gewünscht: ein Symbol, sobald die Kachel durch ihre Abhängigkeiten
 * blockiert ist; beim Überfahren die Links zu den blockierenden Karten. Vorher
 * stand dort eine Textzeile mit dem ersten Blocker, ohne Link.
 */
const feature = (over: Partial<CockpitFeature> = {}): CockpitFeature => ({
  id: "f1",
  title: "Feature 5",
  status: "approved",
  piId: "pi-1",
  artId: "art-1",
  artName: "ART",
  parentId: null,
  parentTitle: null,
  ownerId: null,
  ownerName: null,
  wsjfComputed: 3,
  wsjfJobSize: 3,
  wsjfBusinessValue: 3,
  wsjfTimeCriticality: 3,
  wsjfRiskReduction: 3,
  hasBlocker: false,
  blockerHint: null,
  blockers: [],
  solutionName: null,
  ...over,
});
const blockiert = feature({
  hasBlocker: true,
  blockerHint: "Login-API",
  blockers: [
    { id: "b1", title: "Login-API" },
    { id: "b2", title: "Rechteprüfung" },
  ],
});

const card = (f: CockpitFeature) =>
  render(<FeatureCard feature={f} canDrag canScore={false} draggingId={createRef()} />);

describe("FeatureCard — Blocker", () => {
  beforeEach(() => setParam.mockClear());

  it("ohne Blocker kein Symbol", () => {
    card(feature());
    expect(screen.queryByRole("button", { name: /Blocker/ })).toBeNull();
  });

  it("mit Blockern: Symbol mit Zahl, die alte Textzeile ist weg", () => {
    card(blockiert);
    expect(screen.getByRole("button", { name: "2 offene Blocker" })).toBeInTheDocument();
    expect(screen.queryByText(/blockt durch/i)).toBeNull();
  });

  it("zeigt alle Blocker als Links; ein Klick öffnet den Blocker, nicht die eigene Karte", async () => {
    card(blockiert);
    fireEvent.click(screen.getByRole("button", { name: "2 offene Blocker" }));
    await waitFor(() => expect(screen.getByText("Blockiert durch")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Rechteprüfung" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Login-API" }));
    expect(setParam).toHaveBeenCalledTimes(1);
    expect(setParam).toHaveBeenCalledWith("featureId", "b1");
  });
});
