import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within, waitFor, act } from "@testing-library/react";
import type { ReactNode } from "react";
import type * as DndKit from "@dnd-kit/core";

/**
 * dnd-kit misst Rechtecke, die jsdom nicht hat. Der Test fängt deshalb den
 * `DndContext` ab und löst Loslassen und Abbruch direkt aus — geprüft wird,
 * was das Board daraus macht, und wie die Sensoren eingestellt sind.
 */
type Ctx = {
  onDragStart: (e: unknown) => void;
  onDragEnd: (e: unknown) => void;
  onDragCancel: () => void;
  sensors: { sensor: { name: string }; options: { activationConstraint?: unknown } }[];
};
let ctx: Ctx | null = null;
vi.mock("@dnd-kit/core", async (orig) => {
  const real = await orig<typeof DndKit>();
  return {
    ...real,
    DndContext: (props: Ctx & { children: ReactNode }) => {
      ctx = props;
      return props.children;
    },
  };
});

const setStatus = vi.fn(async (_args: unknown) => ({}));
vi.mock("@/modules/work/features/feature/actions/feature", () => ({
  setFeatureDeliveryStatusAction: async () => ({}),
  scoreFeatureAction: async () => ({}),
}));
vi.mock("@/modules/work/features/feature/lib/feature-actions-client", () => ({
  setFeatureDeliveryStatus: (_a: unknown, args: unknown) => setStatus(args),
}));
const setParam = vi.fn();
vi.mock("@/modules/drumbeat/features/lib/use-url-state", () => ({
  useUrlState: () => ({ searchParams: new URLSearchParams(), setParam, setParams: vi.fn() }),
}));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

import { PiStatusBoard } from "@/modules/drumbeat/features/cockpit/components/lage/pi-status-board";
import { LageView } from "@/modules/drumbeat/features/cockpit/components/lage/lage-view";
import { LageStrip } from "@/modules/drumbeat/features/cockpit/components/lage/lage-strip";
import type { CockpitFeature } from "@/modules/drumbeat/domain/cockpit-types";
import type { PiLage } from "@/modules/drumbeat/server/views/pi-lage-view";

/**
 * **Die Sicht „Lage"** — Kopf mit Signal, das Board nur dieses PIs und die
 * Kurzfassung in der Leiste.
 */
const feature = (over: Partial<CockpitFeature>): CockpitFeature =>
  ({
    id: "f1",
    title: "Feature",
    status: "approved",
    piId: "pi",
    artId: "art",
    artName: "ART",
    parentId: null,
    parentTitle: null,
    ownerId: null,
    ownerName: null,
    wsjfComputed: 2,
    wsjfJobSize: 3,
    wsjfBusinessValue: 3,
    wsjfTimeCriticality: 3,
    wsjfRiskReduction: 3,
    wsjfBusinessValueActual: null,
    featureType: null,
    hasBlocker: false,
    blockerHint: null,
    blockers: [],
    successors: [],
    solutionName: null,
    ...over,
  }) as CockpitFeature;

const D = (s: string) => new Date(`${s}T00:00:00Z`);

const lage = (over: Partial<PiLage> = {}): PiLage => ({
  pi: {
    id: "pi",
    name: "PI 2026.3",
    status: "active",
    startDate: D("2026-08-30"),
    endDate: D("2026-11-07"),
  },
  head: {
    signal: "behind",
    days: { total: 69, elapsed: 28 },
    timeShare: 28 / 69,
    deliveredShare: 1 / 3,
    plannedJs: 42,
    deliveredJs: 14,
    plannedCount: 11,
    deliveredCount: 5,
    gapPoints: 8,
    forecastJs: 35,
  },
  burnup: {
    totalDays: 69,
    today: 28,
    delivered: [
      { day: 0, js: 0 },
      { day: 28, js: 14 },
    ],
    scope: [
      { day: 0, js: 37 },
      { day: 69, js: 42 },
    ],
    maxJs: 42,
    forecastJs: 35,
  },
  attention: [],
  drift: { changes: [], startJs: 42, nowJs: 42 },
  risks: [
    {
      id: "i1",
      title: "Security",
      roamStatus: "open",
      probability: null,
      impact: null,
      targetResolutionDate: null,
      overdue: false,
      ownerId: null,
      featureTitle: null,
    },
  ],
  value: { plannedBv: 55, deliveredBv: 21 },
  systemDemoAt: null,
  nextPi: null,
  userLabels: {},
  ...over,
});

beforeEach(() => {
  setStatus.mockClear();
  setParam.mockClear();
});

describe("PiStatusBoard", () => {
  const features = [
    feature({ id: "a", title: "Offen A", status: "approved", wsjfJobSize: 8 }),
    feature({ id: "b", title: "Läuft B", status: "in_progress", wsjfJobSize: 5 }),
    feature({ id: "c", title: "Fertig C", status: "completed", wsjfJobSize: 3 }),
  ];

  it("vier Statusspalten mit Anzahl und Σ JS", () => {
    render(
      <PiStatusBoard
        features={features}
        piName="PI 2026.3"
        canSetDelivery
        canScoreWsjf={false}
        attentionIds={new Set()}
      />,
    );
    const offen = screen.getByRole("region", { name: "Offen" });
    expect(within(offen).getByText("Offen A")).toBeInTheDocument();
    expect(within(offen).getByText("1 · 8 JS")).toBeInTheDocument();
    expect(
      within(screen.getByRole("region", { name: "Abgeschlossen" })).getByText("1 · 3 JS"),
    ).toBeInTheDocument();
  });

  it("„Nur Auffällige“ blendet den Rest aus", () => {
    render(
      <PiStatusBoard
        features={features}
        piName="PI 2026.3"
        canSetDelivery
        canScoreWsjf={false}
        attentionIds={new Set(["b"])}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Nur Auffällige" }));
    expect(screen.queryByText("Offen A")).toBeNull();
    expect(screen.getByText("Läuft B")).toBeInTheDocument();
  });

  const drop = (id: string, over: string | null) =>
    act(() => {
      ctx!.onDragStart({ active: { id } });
      ctx!.onDragEnd({ active: { id }, over: over ? { id: over } : null });
    });

  it("Loslassen über einer Spalte setzt den Status", async () => {
    render(
      <PiStatusBoard
        features={features}
        piName="PI 2026.3"
        canSetDelivery
        canScoreWsjf={false}
        attentionIds={new Set()}
      />,
    );
    drop("a", "in_progress");
    await waitFor(() => expect(setStatus).toHaveBeenCalledWith({ id: "a", to: "in_progress" }));
  });

  it("Loslassen ausserhalb oder Abbruch ändert nichts", () => {
    render(
      <PiStatusBoard
        features={features}
        piName="PI 2026.3"
        canSetDelivery
        canScoreWsjf={false}
        attentionIds={new Set()}
      />,
    );
    drop("a", null);
    act(() => ctx!.onDragCancel());
    expect(setStatus).not.toHaveBeenCalled();
  });

  it("nach „Blockiert“ erst mit Grund", async () => {
    render(
      <PiStatusBoard
        features={features}
        piName="PI 2026.3"
        canSetDelivery
        canScoreWsjf={false}
        attentionIds={new Set()}
      />,
    );
    drop("b", "blocked");
    expect(setStatus).not.toHaveBeenCalled();
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("Touch nimmt erst nach langem Druck auf, die Maus nach ein paar Pixeln", () => {
    render(
      <PiStatusBoard
        features={features}
        piName="PI 2026.3"
        canSetDelivery
        canScoreWsjf={false}
        attentionIds={new Set()}
      />,
    );
    const byName = Object.fromEntries(
      ctx!.sensors.map((s) => [s.sensor.name, s.options.activationConstraint]),
    );
    expect(byName.TouchSensor).toEqual({ delay: 250, tolerance: 8 });
    expect(byName.MouseSensor).toEqual({ distance: 4 });
  });

  it("ein Tippen öffnet das Feature — direkt nach dem Loslassen nicht", () => {
    // Weit weg vom Loslassen der vorigen Tests; danach steht die Uhr still.
    const now = vi.spyOn(Date, "now").mockReturnValue(Date.now() + 60_000);
    render(
      <PiStatusBoard
        features={features}
        piName="PI 2026.3"
        canSetDelivery
        canScoreWsjf={false}
        attentionIds={new Set()}
      />,
    );
    fireEvent.click(screen.getByText("Offen A"));
    expect(setParam).toHaveBeenCalledWith("featureId", "a");
    setParam.mockClear();
    drop("a", null);
    fireEvent.click(screen.getByText("Offen A"));
    expect(setParam).not.toHaveBeenCalled();
    now.mockRestore();
  });
});

describe("LageView", () => {
  it("Kopf: Signal, Zeitanteil, Lieferung und Prognose", () => {
    render(
      <LageView
        lage={lage()}
        feedback={null}
        boardFeatures={[]}
        canSetDelivery={false}
        canScoreWsjf={false}
      />,
    );
    expect(screen.getByText("hinterher")).toBeInTheDocument();
    expect(screen.getByText(/Tag 28 von 69/)).toBeInTheDocument();
    expect(screen.getByText(/14 von 42 JS · 5 von 11 Features/)).toBeInTheDocument();
    expect(screen.getByText("≈ 35 JS")).toBeInTheDocument();
    expect(screen.getByText("nicht ge-ROAM-t")).toBeInTheDocument();
  });

  it("ein geplanter PI zeigt einen Leerzustand", () => {
    render(
      <LageView
        lage={lage({ pi: { ...lage().pi, status: "planned" } })}
        feedback={null}
        boardFeatures={[]}
        canSetDelivery={false}
        canScoreWsjf={false}
      />,
    );
    expect(screen.getByText("Dieser PI hat noch nicht begonnen")).toBeInTheDocument();
  });
});

describe("LageStrip", () => {
  it("fasst zusammen und öffnet die Lage", () => {
    render(<LageStrip lage={lage()} />);
    expect(screen.getByText("14 / 42 JS geliefert")).toBeInTheDocument();
    expect(screen.getByText("1 Risiko nicht ge-ROAM-t")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button"));
    expect(setParam).toHaveBeenCalledWith("view", "lage");
  });
});
