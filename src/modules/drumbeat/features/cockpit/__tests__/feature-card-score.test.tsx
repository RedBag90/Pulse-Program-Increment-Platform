import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRef } from "react";
import { render, screen, fireEvent } from "@testing-library/react";

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
 * **WSJF und Job Size auf der Karte im Umsetzungs-Cockpit.**
 *
 * Gemeldet: in der Umsetzung liess sich der WSJF nicht anklicken, und die Job
 * Size — das, was sich gegen das PI-Ziel summiert — stand nirgends auf der
 * Karte. Der Knopf sitzt auf einer Karte, die selbst ein Klickziel ist; der
 * Klick darf nur den Dialog öffnen, nicht zugleich das Slide-Over.
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
  featureType: null,
  hasBlocker: false,
  blockerHint: null,
  blockers: [],
  successors: [],
  solutionName: null,
  ...over,
});

const card = (f: CockpitFeature, canScore: boolean) =>
  render(<FeatureCard feature={f} canDrag canScore={canScore} draggingId={createRef()} />);

describe("FeatureCard — WSJF und Job Size", () => {
  beforeEach(() => setParam.mockClear());

  it("zeigt die Job Size neben dem WSJF", () => {
    card(feature(), false);
    expect(screen.getByText("JS 3")).toBeInTheDocument();
    expect(screen.getByText("WSJF 3.0")).toBeInTheDocument();
  });

  it("ein unbewertetes Feature fällt auf: JS —", () => {
    card(feature({ wsjfJobSize: null, wsjfComputed: null }), false);
    expect(screen.getByText("JS —")).toBeInTheDocument();
  });

  it("der Klick auf WSJF öffnet den Dialog, nicht das Slide-Over", () => {
    card(feature(), true);
    fireEvent.click(screen.getByRole("button", { name: /WSJF bearbeiten: Feature 5/ }));
    expect(screen.getByText("WSJF-Wert setzen")).toBeInTheDocument();
    expect(setParam).not.toHaveBeenCalled();
  });

  it("ein Klick im Dialog erreicht die Karte nicht", () => {
    card(feature(), true);
    fireEvent.click(screen.getByRole("button", { name: /WSJF bearbeiten/ }));
    fireEvent.click(screen.getByText("WSJF-Wert setzen"));
    fireEvent.keyDown(screen.getByText("WSJF-Wert setzen"), { key: "Enter" });
    expect(setParam).not.toHaveBeenCalled();
  });

  it("ohne Recht ist es eine Anzeige — der Klick öffnet das Slide-Over", () => {
    card(feature(), false);
    expect(screen.queryByRole("button", { name: /WSJF bearbeiten/ })).toBeNull();
    fireEvent.click(screen.getByText("JS 3"));
    expect(setParam).toHaveBeenCalledWith("featureId", "f1");
  });
});
