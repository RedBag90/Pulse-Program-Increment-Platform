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
  featureType: null,
  hasBlocker: false,
  blockerHint: null,
  blockers: [],
  solutionName: null,
  ...over,
});
const eineVonDrei = feature({
  hasBlocker: true,
  blockerHint: "Login-API",
  blockers: [
    { id: "b1", title: "Login-API", state: "blocking" },
    { id: "b2", title: "Rechteprüfung", state: "samePi" },
    { id: "b3", title: "Schema", state: "done" },
  ],
});
const erfuellt = feature({
  blockers: [
    { id: "b2", title: "Rechteprüfung", state: "samePi" },
    { id: "b3", title: "Schema", state: "done" },
  ],
});

const card = (f: CockpitFeature) =>
  render(<FeatureCard feature={f} canDrag canScore={false} draggingId={createRef()} />);

describe("FeatureCard — Blocker", () => {
  beforeEach(() => setParam.mockClear());

  it("ohne blockierende Abhängigkeiten kein Symbol", () => {
    card(feature());
    expect(screen.queryByRole("button", { name: /Blocker|Abhängigkeiten/ })).toBeNull();
  });

  it("zählt nur, was tatsächlich blockiert: eine von drei → 1", () => {
    card(eineVonDrei);
    const symbol = screen.getByRole("button", { name: "1 offener Blocker" });
    expect(symbol.textContent).toBe("1");
    expect(symbol.className).toContain("text-warning");
    expect(screen.queryByText(/blockt durch/i)).toBeNull();
  });

  it("blockiert keine: grünes Dreieck mit Häkchen", () => {
    card(erfuellt);
    const symbol = screen.getByRole("button", { name: "Abhängigkeiten erfüllt" });
    expect(symbol.className).toContain("text-success");
    expect(symbol.textContent).toBe("");
    expect(symbol.querySelectorAll("svg")).toHaveLength(2);
  });

  it("das Popover gruppiert und nennt den Grund; ein Klick öffnet den Blocker", async () => {
    card(eineVonDrei);
    fireEvent.click(screen.getByRole("button", { name: "1 offener Blocker" }));
    await waitFor(() => expect(screen.getByText("Blockiert durch")).toBeInTheDocument());
    expect(screen.getByText("Blockiert nicht")).toBeInTheDocument();
    expect(screen.getByText("im selben PI")).toBeInTheDocument();
    expect(screen.getByText("erledigt")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Login-API" }));
    expect(setParam).toHaveBeenCalledTimes(1);
    expect(setParam).toHaveBeenCalledWith("featureId", "b1");
  });
});
