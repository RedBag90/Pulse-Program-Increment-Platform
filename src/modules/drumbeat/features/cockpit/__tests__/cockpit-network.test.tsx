import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";

/** Die URL der Sicht — je Test setzbar (Typfilter, Suche). */
let suche = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/umsetzung",
  useSearchParams: () => suche,
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
  capacity: null,
  jobSizeTarget: null,
  deliveredPerCapacity: null,
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
    wsjfBusinessValue: null,
    wsjfTimeCriticality: null,
    wsjfRiskReduction: null,
    featureType: null,
    hasBlocker: false,
    blockerHint: null,
    blockers: [],
    successors: [],
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

describe("CockpitNetwork — Spalten sichtbar getrennt", () => {
  const pis = [pi("p1", "Werk-PI 1"), pi("p2", "Werk-PI 2")];

  /**
   * Gewünscht: beim Ziehen in ein anderes PI müssen die Spalten sichtbar
   * voneinander getrennt sein. Je Spalte — Backlog, jedes PI, „Außerhalb" —
   * ein Band hinter den Knoten.
   */
  it("zeichnet ein Band je Spalte", () => {
    const { container } = net([feat("a", "p1"), feat("b", null)], pis);
    const baender = container.querySelectorAll('[data-id^="piband:"]');
    expect(baender).toHaveLength(pis.length + 2);
  });

  it("die Bänder schlucken keine Zeigerereignisse — die Leinwand bleibt verschiebbar", () => {
    const { container } = net([feat("a", "p1")], pis);
    const band = container.querySelector<HTMLElement>('[data-id="piband:1"]');
    expect(band?.style.pointerEvents).toBe("none");
  });
});

describe("CockpitNetwork — der Knoten ist die Board-Karte plus Status", () => {
  const pis = [pi("p1", "Werk-PI 1")];
  const voll: CockpitFeature = {
    ...feat("x", "p1"),
    title: "Erstlösungsquote Feature 3",
    status: "in_progress",
    parentTitle: "Kundenservice",
    solutionName: "Portal",
    ownerName: "admin@pulse.dev",
    featureType: "enabler",
    wsjfComputed: 3,
    wsjfJobSize: 3,
    wsjfBusinessValue: 3,
    wsjfTimeCriticality: 3,
    wsjfRiskReduction: 3,
    hasBlocker: true,
    blockerHint: "Vorarbeit",
    blockers: [{ id: "v", title: "Vorarbeit", state: "blocking" }],
  };
  const netz = (canScoreWsjf: boolean) =>
    render(
      <CockpitNetwork
        features={[voll]}
        dependencies={[]}
        artId="art-1"
        canLinkDependency={false}
        canUpdate={false}
        canScoreWsjf={canScoreWsjf}
        savedPositions={{}}
        pis={pis}
        selectedPiId="p1"
      />,
    );

  it("zeigt Epic ▸ Solution, Owner, Status, WSJF, JS und den Typ-Streifen mit Wort", () => {
    netz(false);
    expect(screen.getByText(/Kundenservice/)).toBeTruthy();
    expect(screen.getByText(/Portal/)).toBeTruthy();
    expect(screen.getByText("admin@pulse.dev")).toBeTruthy();
    expect(screen.getByText("In Umsetzung")).toBeTruthy();
    expect(screen.getByText("JS 3")).toBeTruthy();
    expect(screen.getByText("WSJF 3.0")).toBeTruthy();
    expect(screen.getByTitle("Enabler").className).toContain("bg-violet-500");
  });

  it("Blocker-Symbol und WSJF-Knopf ziehen den Knoten nicht (nodrag)", () => {
    netz(true);
    // React Flow blendet ungemessene Knoten aus (`visibility: hidden`) — in
    // jsdom wird nie gemessen, und für verborgene Elemente berechnet
    // `getByRole` keinen Namen. Deshalb über das `aria-label`.
    const knopf = (label: RegExp) =>
      screen
        .getAllByRole("button", { hidden: true })
        .find((b) => label.test(b.getAttribute("aria-label") ?? ""));
    const blocker = knopf(/^1 offener Blocker$/);
    const wsjf = knopf(/^WSJF bearbeiten/);
    expect(blocker).toBeDefined();
    expect(wsjf).toBeDefined();
    expect(blocker!.closest(".nodrag")).not.toBeNull();
    expect(wsjf!.closest(".nodrag")).not.toBeNull();
  });
});

describe("DependencyNetwork — die Extras aus dem Epic-Netzplan", () => {
  const pis = [pi("p1", "Werk-PI 1")];
  beforeEach(() => {
    suche = new URLSearchParams();
  });
  const mitEpic = (id: string): CockpitFeature => ({
    ...feat(id, "p1"),
    parentId: "epic-1",
    parentTitle: "Epic 1",
  });
  const netz = (
    features: CockpitFeature[],
    rechte: { canLink?: boolean; canCreate?: boolean } = {},
  ) =>
    render(
      <CockpitNetwork
        features={features}
        dependencies={[]}
        artId="art-1"
        canLinkDependency={rechte.canLink ?? false}
        canUpdate={false}
        canCreateFeature={rechte.canCreate ?? false}
        savedPositions={{}}
        pis={pis}
        selectedPiId="p1"
      />,
    );
  const plusKnoepfe = () =>
    screen
      .queryAllByRole("button", { hidden: true })
      .filter((b) => b.getAttribute("aria-label") === "Folge-Feature anlegen");

  it('„+" am Knoten nur mit feature.create und nur an Features mit Epic', () => {
    netz([mitEpic("a"), feat("b", "p1")], { canCreate: true });
    expect(plusKnoepfe()).toHaveLength(1);
    expect(plusKnoepfe()[0]!.closest("[data-id]")?.getAttribute("data-id")).toBe("a");
  });

  it('ohne feature.create kein „+"', () => {
    netz([mitEpic("a")]);
    expect(plusKnoepfe()).toHaveLength(0);
  });

  it("der Typfilter blendet ab statt auszublenden", () => {
    suche = new URLSearchParams("ntyp=enabler");
    const { container } = netz([
      { ...feat("a", "p1"), featureType: "enabler" },
      { ...feat("b", "p1"), featureType: "feature" },
    ]);
    const knoten = (id: string) => container.querySelector<HTMLElement>(`[data-id="${id}"]`);
    expect(knoten("b")).not.toBeNull();
    expect(knoten("b")!.style.opacity).toBe("0.25");
    expect(knoten("a")!.style.opacity).not.toBe("0.25");
    expect(screen.getByText("1 von 2 sichtbar")).toBeTruthy();
  });

  it("der Typ neuer Kanten ist umschaltbar — nur mit dependency.link", () => {
    netz([feat("a", "p1")], { canLink: true });
    expect(screen.getByRole("group", { name: /^Kanten-Typ$/ })).toBeTruthy();
  });

  it("ohne dependency.link kein Umschalter", () => {
    netz([feat("a", "p1")]);
    expect(screen.queryByRole("group", { name: /^Kanten-Typ$/ })).toBeNull();
  });

  it("bietet den PNG-Export an", () => {
    netz([feat("a", "p1")]);
    expect(screen.getByRole("button", { name: /exportieren/i })).toBeTruthy();
  });
});
