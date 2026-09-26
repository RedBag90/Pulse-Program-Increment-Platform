import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/umsetzung",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/modules/drumbeat/features/dependencies/hooks/use-dependency-edge-editing", () => ({
  useDependencyEdgeEditing: () => ({
    error: null,
    callLink: vi.fn(),
    callUnlink: vi.fn(),
    callChangeType: vi.fn(),
  }),
}));

import { CockpitNetwork } from "@/modules/drumbeat/features/cockpit/components/cockpit-network";
import type { CockpitFeature, CockpitPiSlot } from "@/modules/drumbeat/domain/cockpit-types";

/**
 * **Die Netzsicht hatte keinen einzigen Test** — und genau sie hatte ich in
 * Etappe 1 versehentlich auf ein einzelnes PI eingesperrt. Gemessen überqueren
 * 15 von 26 Abhängigkeiten eine PI-Grenze; eine Netzsicht auf ein PI kann die
 * Mehrheit dessen, wofür sie da ist, weder zeigen noch anlegen.
 *
 * Diese Zusicherungen stehen gegen den Rückfall.
 */

const pi = (id: string, name: string): CockpitPiSlot => ({
  id,
  name,
  startDate: new Date("2026-01-01"),
  endDate: new Date("2026-03-31"),
  status: "planned",
  featureCount: 0,
  plannedJobSize: 0,
  capacityJobSize: null,
  isCurrent: false,
});

function feat(id: string, piId: string | null): CockpitFeature {
  return {
    id,
    title: `Feature ${id}`,
    status: "approved",
    piId,
    artId: "art-1",
    artName: "ART 1",
    parentId: null,
    parentTitle: null,
    ownerId: null,
    ownerName: null,
    wsjfComputed: null,
    wsjfJobSize: null,
    hasBlocker: false,
    blockerHint: null,
    solutionName: null,
  };
}

const net = (features: CockpitFeature[], pis: CockpitPiSlot[]) =>
  render(
    <CockpitNetwork
      features={features}
      dependencies={[]}
      artId="art-1"
      canLinkDependency
      canUpdate={false}
      savedPositions={{}}
      pis={pis}
      selectedPiId="p2"
    />,
  );

describe("CockpitNetwork — mehrere PIs nebeneinander", () => {
  const pis = [pi("p1", "Werk-PI 1"), pi("p2", "Werk-PI 2"), pi("p3", "Werk-PI 3")];

  /** Das, was heute fehlte: Knoten aus verschiedenen PIs gleichzeitig. */
  it("zeigt Features aus verschiedenen PIs zugleich", () => {
    net([feat("a", "p1"), feat("b", "p2"), feat("c", "p3")], pis);
    expect(screen.getByText("Feature a")).toBeTruthy();
    expect(screen.getByText("Feature b")).toBeTruthy();
    expect(screen.getByText("Feature c")).toBeTruthy();
  });

  it("beschriftet die Spalten mit Backlog, den PIs und dem Außerhalb", () => {
    net([feat("a", null), feat("b", "p2")], pis);
    expect(screen.getByText("Backlog")).toBeTruthy();
    expect(screen.getByText("Werk-PI 1")).toBeTruthy();
    expect(screen.getByText("Werk-PI 3")).toBeTruthy();
    expect(screen.getByText("Außerhalb des Fensters")).toBeTruthy();
  });

  it("bietet beide Anordnungen an", () => {
    net([feat("a", "p2")], pis);
    expect(screen.getByText("Zeitachse")).toBeTruthy();
    expect(screen.getByText("Topologie")).toBeTruthy();
  });

  it("sagt bei leerem Fenster, woran es liegt", () => {
    net([], pis);
    expect(screen.getByText("Keine Features im Zeitfenster")).toBeTruthy();
  });
});
