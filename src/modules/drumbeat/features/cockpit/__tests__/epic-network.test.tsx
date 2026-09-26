import { describe, it, expect, vi } from "vitest";
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

const replace = vi.fn();
// Stabil wie in Next: ein neues Objekt je Render baute Layout und Kanten
// jedes Mal neu — eine Endlosschleife, die es im Browser nicht gibt.
const suche = new URLSearchParams();
const router = { replace, refresh: vi.fn() };
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/portfolio/epics/e1",
  useSearchParams: () => suche,
}));
vi.mock("@/modules/work/features/portfolio/hooks/use-breakdown-realtime", () => ({
  useBreakdownRealtime: () => undefined,
}));
vi.mock("@/modules/work/features/feature/components/create-feature-dialog", () => ({
  CreateFeatureDialog: () => <button type="button">Feature anlegen</button>,
}));

import { EpicNetwork } from "@/modules/drumbeat/features/cockpit/components/epic-network";
import type { CockpitFeature } from "@/modules/drumbeat/domain/cockpit-types";
import type { EpicNetworkModel } from "@/modules/drumbeat/server/views/epic-network-view";

/**
 * **Der Epic-Netzplan ist derselbe wie der der Umsetzung** — seit September
 * 2026 ein Mantel um `DependencyNetwork`. Hier steht, was ihm eigen ist.
 */

function feat(id: string, art: string): CockpitFeature {
  return {
    id,
    title: `Feature ${id}`,
    status: "approved",
    piId: null,
    artId: art,
    artName: `ART ${art}`,
    parentId: "e1",
    parentTitle: "Das Epic",
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
    solutionName: "Portal",
  };
}

const model = (over: Partial<EpicNetworkModel> = {}): EpicNetworkModel => ({
  features: [feat("a", "1"), feat("b", "2")],
  dependencies: [],
  pis: [],
  selectedPiId: null,
  artId: "1",
  permissions: { canUpdate: false, canLink: false, canCreate: false, canScore: false },
  ...over,
});

const netz = (m: EpicNetworkModel) =>
  render(
    <EpicNetwork
      epicId="e1"
      tenantId="t1"
      epicTitle="Das Epic"
      epicValueStreamId={null}
      model={m}
      savedPositions={{}}
      canEditEpic
    />,
  );

describe("EpicNetwork", () => {
  /** Alle Karten tragen dasselbe Epic — die Zeile sagt deshalb das ART. */
  it("zeigt auf der Karte ART ▸ Solution statt Epic ▸ Solution", () => {
    netz(model());
    expect(screen.getByText(/ART 1/)).toBeTruthy();
    expect(screen.getByText(/ART 2/)).toBeTruthy();
    expect(screen.queryByText(/Das Epic/)).toBeNull();
  });

  it("der Geist nennt das andere Epic und öffnet sein Feature", () => {
    replace.mockClear();
    netz(
      model({
        dependencies: [
          {
            id: "d1",
            fromId: "x",
            toId: "a",
            type: "blocks",
            offScopeRole: "from",
            offScopeLabel: "Fremde Vorarbeit",
            offScopeEpicTitle: "Anderes Epic",
          },
        ],
      }),
    );
    expect(screen.getByText("Anderes Epic")).toBeTruthy();
    const geist = screen
      .getAllByRole("button", { hidden: true })
      .find((b) => b.textContent?.includes("Fremde Vorarbeit"));
    expect(geist).toBeDefined();
    fireEvent.click(geist!);
    expect(replace).toHaveBeenCalledWith(expect.stringContaining("featureId=x"), {
      scroll: false,
    });
  });

  it("ohne Features: der leere Zustand des Epics, mit Anlegen", () => {
    netz(model({ features: [] }));
    expect(screen.getByText("Feature anlegen")).toBeTruthy();
    expect(screen.queryByText("Keine Features im Zeitfenster")).toBeNull();
  });
});
