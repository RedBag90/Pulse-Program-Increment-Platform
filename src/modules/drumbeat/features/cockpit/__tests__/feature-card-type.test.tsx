import { describe, it, expect, vi } from "vitest";
import { createRef } from "react";
import { render, screen } from "@testing-library/react";

vi.mock("@/modules/work/features/feature/actions/feature", () => ({
  scoreFeatureAction: async () => ({}),
}));
vi.mock("@/modules/drumbeat/features/lib/use-url-state", () => ({
  useUrlState: () => ({
    searchParams: new URLSearchParams(),
    setParam: vi.fn(),
    setParams: vi.fn(),
  }),
}));

import { FeatureCard } from "@/modules/drumbeat/features/cockpit/components/feature-card";
import type { CockpitFeature } from "@/modules/drumbeat/domain/cockpit-types";

/**
 * **Der Streifen der Kachel zeigt den Typ.**
 *
 * Gewünscht: die Farbe links an der Kachel steht nicht mehr für den Status —
 * den zeigen die Board-Zeilen —, sondern für Feature, Enabler oder
 * Maintenance. Das Wort steht dabei (ADR-0021).
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
  wsjfComputed: null,
  wsjfJobSize: null,
  wsjfBusinessValue: null,
  wsjfTimeCriticality: null,
  wsjfRiskReduction: null,
  featureType: null,
  hasBlocker: false,
  blockerHint: null,
  blockers: [],
  solutionName: null,
  ...over,
});

const streifen = (f: CockpitFeature) => {
  const { unmount } = render(
    <FeatureCard feature={f} canDrag={false} canScore={false} draggingId={createRef()} />,
  );
  const label = f.featureType
    ? { feature: "Feature", enabler: "Enabler", maintenance: "Maintenance" }[f.featureType]
    : "ohne Typ";
  const el = screen.getByTitle(label);
  const cls = el.className;
  unmount();
  return cls;
};

describe("FeatureCard — Typ-Streifen", () => {
  it("Enabler violett, Maintenance türkis, Feature blau — mit Wort", () => {
    expect(streifen(feature({ featureType: "enabler" }))).toContain("bg-violet-500");
    expect(streifen(feature({ featureType: "maintenance" }))).toContain("bg-teal-500");
    expect(streifen(feature({ featureType: "feature" }))).toContain("bg-blue-500");
  });

  it("ohne Typ grau", () => {
    expect(streifen(feature({ featureType: null }))).toContain("bg-muted-foreground");
  });

  it("hängt nicht mehr am Status", () => {
    expect(streifen(feature({ featureType: "enabler", status: "blocked" }))).toBe(
      streifen(feature({ featureType: "enabler", status: "completed" })),
    );
  });
});
