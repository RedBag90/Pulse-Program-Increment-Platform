import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen, within } from "@testing-library/react";
import {
  PiVelocityRows,
  PiVelocityTable,
} from "@/modules/drumbeat/features/cockpit/components/pi-velocity-table";
import type { VelocityRow } from "@/modules/drumbeat/domain/pi-velocity";

/**
 * **Die PI-Velocity im Reiter „Budget-KPIs“** — Zeilen je PI, gedämpft, was
 * nicht zählt, und eine Kopfzahl, die sagt, wie sie gerechnet ist.
 */

const row = (over: Partial<VelocityRow>): VelocityRow => ({
  piId: "p1",
  name: "PI 25.4",
  endDate: new Date("2025-12-12"),
  status: "completed",
  delivered: 30,
  businessValue: 0,
  wsjf: 0,
  businessValueActual: 0,
  wsjfActual: 0,
  confirmedCount: 0,
  completedCount: 0,
  capacity: 20,
  ratio: 1.5,
  skip: null,
  ...over,
});

const FENSTER = { closedKeys: ["2026-H1", "2025-H2"], runningKey: "2026-H2" };

describe("PiVelocityTable", () => {
  it("Business Value und WSJF je Plan und Ist — mit „n/m bestätigt“", () => {
    render(
      <PiVelocityTable
        rows={[
          row({
            businessValue: 18,
            businessValueActual: 21,
            wsjf: 9.5,
            wsjfActual: 9.8,
            confirmedCount: 2,
            completedCount: 3,
          }),
        ]}
        summary={1.5}
        kind="art"
        window={FENSTER}
      />,
    );
    expect(screen.getAllByRole("columnheader", { name: "Plan" })).toHaveLength(2);
    expect(screen.getAllByRole("columnheader", { name: "Ist" })).toHaveLength(2);
    const zeile = screen.getByRole("row", { name: /PI 25\.4/ });
    expect(within(zeile).getByText("18")).toBeInTheDocument();
    expect(within(zeile).getByText("21")).toBeInTheDocument();
    expect(within(zeile).getByText(/9[,.]8/)).toBeInTheDocument();
    expect(within(zeile).getAllByText(/2\/3 bestätigt/)).toHaveLength(2);
  });

  it("ohne jede Bestätigung steht „—“ statt eines zweiten Plans", () => {
    render(
      <PiVelocityTable
        rows={[row({ businessValue: 18, businessValueActual: 18, completedCount: 3 })]}
        summary={1.5}
        kind="art"
        window={FENSTER}
      />,
    );
    const zeile = screen.getByRole("row", { name: /PI 25\.4/ });
    expect(within(zeile).queryByText(/bestätigt/)).toBeNull();
    expect(within(zeile).getAllByText("—").length).toBeGreaterThanOrEqual(2);
  });

  it("zeigt je PI Σ Business Value und Σ WSJF", () => {
    render(
      <PiVelocityTable
        rows={[row({ businessValue: 42, wsjf: 17.25 })]}
        summary={1.5}
        kind="art"
        window={FENSTER}
      />,
    );
    expect(screen.getByRole("columnheader", { name: /Business Value/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /WSJF/ })).toBeInTheDocument();
    const zeile = screen.getByRole("row", { name: /PI 25\.4/ });
    expect(within(zeile).getByText("42")).toBeInTheDocument();
    expect(within(zeile).getByText(/17[,.]3/)).toBeInTheDocument();
  });

  it("zeigt je PI geliefert, Kapazität und die Quote — und den Ø im Kopf", () => {
    render(
      <PiVelocityTable
        rows={[
          row({}),
          row({ piId: "p2", name: "PI 26.1", delivered: 10, capacity: 20, ratio: 0.5 }),
        ]}
        summary={1}
        kind="art"
        window={FENSTER}
      />,
    );
    const zeile = screen.getByText("PI 25.4").closest("tr")!;
    expect(within(zeile).getByText("30")).toBeTruthy();
    expect(within(zeile).getByText("20,0")).toBeTruthy();
    expect(within(zeile).getByText("1,5")).toBeTruthy();
    expect(screen.getByText("1,0")).toBeTruthy();
    expect(screen.getByText("Ø der PIs")).toBeTruthy();
    // Das Fenster, älteres Halbjahr zuerst; das laufende sagt, was davon zählt.
    expect(
      screen.getByText(
        /PIs mit Ende in H2 2025 · H1 2026 · H2 2026 \(laufend, nur abgeschlossene PIs\)/,
      ),
    ).toBeTruthy();
    expect(screen.getByRole("img", { name: /Verlauf/ })).toBeTruthy();
  });

  it("ein PI, der nicht zählt, bleibt stehen — gedämpft und mit Grund", () => {
    render(
      <PiVelocityTable
        rows={[row({ capacity: null, ratio: null, skip: "noCapacity" })]}
        summary={null}
        kind="art"
        window={FENSTER}
      />,
    );
    const zeile = screen.getByText("PI 25.4").closest("tr")!;
    expect(zeile.className).toContain("text-muted-foreground");
    expect(within(zeile).getByText("ohne Kapazität · zählt nicht")).toBeTruthy();
  });

  it("der Wertstrom nennt seinen Rechenweg und die Voraussetzung", () => {
    render(<PiVelocityTable rows={[row({})]} summary={1.5} kind="stream" window={FENSTER} />);
    expect(screen.getByText("Σ JS ÷ Σ Kapazität")).toBeTruthy();
    expect(screen.getByText(/dieselbe Einheit|derselben Einheit/)).toBeTruthy();
  });

  it("leeres Fenster: ein Satz statt einer leeren Tabelle", () => {
    render(<PiVelocityTable rows={[]} summary={null} kind="art" window={FENSTER} />);
    expect(screen.getByText(/^Keine PIs mit Ende in H2 2025 · H1 2026 · H2 2026/)).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });
});

/**
 * **Die Velocity-Karte** — eine Zeile je ART, „n von m PIs gezählt“, die
 * PI-Tabelle eingeklappt.
 */
describe("PiVelocityRows", () => {
  const arts = [
    {
      artId: "a1",
      name: "Materials & Energy",
      rows: [
        row({ piId: "p1", skip: "noCapacity", capacity: null, ratio: null }),
        row({ piId: "p2", ratio: 5.5 }),
      ],
      mean: 5.5,
      countedCount: 1,
    },
    {
      artId: "a2",
      name: "Plant Efficiency (OEE)",
      rows: [row({ piId: "p3", skip: "noCapacity", capacity: null, ratio: null })],
      mean: null,
      countedCount: 0,
    },
  ];

  it("je ART Zahl und gezählte PIs; ohne Kapazität kein Wert", () => {
    const { container } = render(<PiVelocityRows arts={arts} stream={null} window={FENSTER} />);
    const m = container.querySelector('[data-row="a1"] summary') as HTMLElement;
    expect(within(m).getByText("5,5")).toBeInTheDocument();
    expect(within(m).getByText(/^1 von 2 PIs gezählt/)).toBeInTheDocument();
    const o = container.querySelector('[data-row="a2"] summary') as HTMLElement;
    expect(within(o).getByText("—")).toBeInTheDocument();
    expect(within(o).getByText(/^0 von 1 PIs gezählt/)).toBeInTheDocument();
    expect(container.querySelector('[data-row="summe"]')).toBeNull();
  });

  it("Σ nur mit Wertstrom-Recht; die PI-Tabelle eingeklappt", () => {
    const { container } = render(
      <PiVelocityRows
        arts={arts}
        stream={{ rows: [...arts[0]!.rows, ...arts[1]!.rows], ratio: 5.5, countedCount: 1 }}
        window={FENSTER}
      />,
    );
    expect(container.querySelector('[data-row="summe"]')).not.toBeNull();
    expect(container.querySelector("details[open]")).toBeNull();
  });
});
