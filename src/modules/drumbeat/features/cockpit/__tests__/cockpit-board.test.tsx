import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";

// Die Schreib-Actions sind `"use server"`-Module; im jsdom-Lauf werden sie nur
// als Referenz gereicht, nie aufgerufen.
vi.mock("@/modules/work/features/feature/actions/feature", () => ({
  setFeaturePiAction: async () => ({}),
  setFeatureDeliveryStatusAction: async () => ({}),
  bulkSetFeatureDeliveryStatusAction: async () => ({}),
}));
vi.mock("@/modules/drumbeat/features/lib/use-url-state", () => ({
  useUrlState: () => ({
    searchParams: new URLSearchParams(),
    setParam: vi.fn(),
    setParams: vi.fn(),
  }),
}));

import { CockpitBoard } from "@/modules/drumbeat/features/cockpit/components/cockpit-board";
import type { CockpitFeature, CockpitPiSlot } from "@/modules/drumbeat/domain/cockpit-types";

/**
 * **Das Board hatte keinen einzigen Rendering-Test.** Geprüft war nur die Logik
 * darunter (`buildBoardMatrix`, `splitCell`) — Layout und Bedienung ließen sich
 * umbauen, ohne dass etwas rot wurde.
 *
 * Diese Zusicherungen beschreiben, was die Kappung verspricht: die Seite wird
 * kürzer, **ohne dass etwas verschwindet**.
 */

const pi: CockpitPiSlot = {
  id: "pi-1",
  name: "PI 1",
  startDate: new Date(0),
  endDate: new Date(0),
  status: "active",
  featureCount: 0,
  plannedJobSize: 0,
  capacity: null,
  jobSizeTarget: null,
  deliveredPerCapacity: null,
  isCurrent: true,
};

function feat(id: string, status: CockpitFeature["status"]): CockpitFeature {
  return {
    id,
    title: `Feature ${id}`,
    status,
    piId: "pi-1",
    artId: "art-1",
    artName: "ART 1",
    parentId: "e1",
    parentTitle: "Mein Epic",
    ownerId: "u1",
    ownerName: "anna@x.dev",
    wsjfComputed: 3.2,
    wsjfJobSize: 5,
    wsjfBusinessValue: null,
    wsjfTimeCriticality: null,
    wsjfRiskReduction: null,
    hasBlocker: false,
    blockerHint: null,
    solutionName: "Logistik Betrieb",
  };
}

const board = (features: CockpitFeature[]) =>
  render(
    <CockpitBoard
      pis={[pi]}
      features={features}
      artId="art-1"
      canUpdate={false}
      canSetDelivery={false}
    />,
  );

describe("CockpitBoard — die Kappung", () => {
  it("zeigt in einer Haufen-Bahn fünf Karten und meldet den Rest", () => {
    board(Array.from({ length: 20 }, (_, i) => feat(`a${i}`, "approved")));
    expect(screen.getByText("Feature a0")).toBeTruthy();
    expect(screen.getByText("Feature a4")).toBeTruthy();
    expect(screen.getByText("+ 15 weitere")).toBeTruthy();
  });

  /**
   * **Nichts verschwindet.** Der Rest steht in einem `<details>` — im DOM
   * vorhanden, nur zugeklappt. Genau der Unterschied zur alten Überlauf-Lücke,
   * bei der Karten gar nicht gerendert wurden.
   */
  it("hält den Rest im Dokument, nur eingeklappt", () => {
    board(Array.from({ length: 20 }, (_, i) => feat(`a${i}`, "approved")));
    expect(screen.getByText("Feature a19")).toBeTruthy();
    expect(screen.getByText("Feature a19").closest("details")).toBeTruthy();
    expect(screen.getByText("Feature a0").closest("details")).toBeNull();
  });

  it("kappt die Tagesordnung nicht — Blockiertes bleibt ganz", () => {
    board(Array.from({ length: 12 }, (_, i) => feat(`b${i}`, "blocked")));
    expect(screen.queryByText(/weitere/)).toBeNull();
    expect(screen.getByText("Feature b11")).toBeTruthy();
  });

  it("kappt die laufende Arbeit nicht — eine lange Bahn ist ein WIP-Signal", () => {
    board(Array.from({ length: 12 }, (_, i) => feat(`w${i}`, "in_progress")));
    expect(screen.queryByText(/weitere/)).toBeNull();
  });

  it("meldet nichts, wenn die Zelle in die Grenze passt", () => {
    board(Array.from({ length: 5 }, (_, i) => feat(`a${i}`, "approved")));
    expect(screen.queryByText(/weitere/)).toBeNull();
  });
});

describe("CockpitBoard — die vier Signale der Karte", () => {
  it("zeigt Epic, Solution, Owner und WSJF", () => {
    const { container } = board([feat("x", "approved")]);
    // Epic und Solution stehen in **einer** Zeile, durch ein ▸ getrennt — der
    // Text liegt also über mehrere Knoten verteilt.
    expect(container.textContent).toContain("Mein Epic");
    expect(container.textContent).toContain("Logistik Betrieb");
    expect(screen.getByText("anna@x.dev")).toBeTruthy();
    expect(screen.getByText(/3\.2/)).toBeTruthy();
    // Die Initialen des Owners als Avatar-Ersatz.
    expect(screen.getByText("AN")).toBeTruthy();
  });

  /** 40 % der Features hängen an einem Epic ohne Primär-Solution. */
  it("kommt ohne Solution aus, ohne einen leeren Platzhalter zu zeigen", () => {
    board([{ ...feat("x", "approved"), solutionName: null }]);
    expect(screen.getByText("Mein Epic")).toBeTruthy();
    expect(screen.queryByText("▸")).toBeNull();
  });
});
