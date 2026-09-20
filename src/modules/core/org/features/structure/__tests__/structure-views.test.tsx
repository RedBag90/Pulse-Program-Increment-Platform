import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, within } from "@testing-library/react";

// `@/i18n/navigation` zieht die next-intl-Routing-Konfiguration nach; im
// jsdom-Lauf reicht ein schlichtes `<a>`.
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { StructureMap } from "@/modules/core/org/features/structure/components/structure-map";
import { StructureTable } from "@/modules/core/org/features/structure/components/structure-table";
import {
  buildStructureOverview,
  rollUpStructureMoney,
  type StructureMoney,
} from "@/modules/core/org/server/views/structure-overview";
import type { StructureTree } from "@/modules/core/org/server/services/structure";

/**
 * Der Bestand in klein — nachgebaut aus „Large Test Corp": zwei ARTs je
 * Wertstrom, davon **eines ohne Solution**. Genau dieser Fall war im früheren
 * Baum unsichtbar: ein Knoten ohne Kinder sah aus wie ein eingeklappter.
 */
const tree = [
  {
    id: "vs1",
    name: "Produktion",
    description: null,
    vmoId: "u1",
    financeApproverId: "u2",
    businessOwnerId: null,
    architectLeadId: null,
    arts: [
      {
        id: "a-leer",
        name: "Materials & Energy",
        description: null,
        rteId: "u3",
        technicalLeadId: null,
        _count: { pis: 0 },
        timeline: { _count: { programIncrements: 4 } },
      },
      {
        id: "a-oee",
        name: "Plant Efficiency (OEE)",
        description: null,
        rteId: "u3",
        technicalLeadId: null,
        _count: { pis: 0 },
        timeline: { _count: { programIncrements: 12 } },
      },
    ],
    solutions: [
      {
        id: "s-betrieb",
        name: "Produktion Betrieb",
        horizon: "h1",
        investmentMode: "investing",
        artId: "a-oee",
        productManagerId: null,
      },
      {
        id: "s-programm",
        name: "Produktion Programm",
        horizon: "h2",
        investmentMode: null,
        artId: "a-oee",
        productManagerId: null,
      },
    ],
  },
] as unknown as StructureTree;

const geld: Record<string, StructureMoney> = {
  "s-betrieb": { grow: 1_660_050, run: 175_000, epicCount: 30 },
  "s-programm": { grow: 1_520_000, run: 0, epicCount: 30 },
};

const voll = () => rollUpStructureMoney(buildStructureOverview(tree), geld);

describe("StructureMap", () => {
  it("zeigt Bahn, Spalten und Kacheln — und benennt das ART ohne Solution", () => {
    render(<StructureMap overview={voll()} showEpics showInvest showRun />);

    expect(screen.getByText("Produktion")).toBeTruthy();
    expect(screen.getByText("Materials & Energy")).toBeTruthy();
    expect(screen.getByText("Plant Efficiency (OEE)")).toBeTruthy();
    expect(screen.getByText("keine Solution")).toBeTruthy();
    expect(screen.getByText("Produktion Betrieb")).toBeTruthy();
    expect(screen.getByText("H1 · Investing")).toBeTruthy();
    expect(screen.getByText("H2 · Emerging")).toBeTruthy();
  });

  /**
   * Bis September 2026 stand das Typwort nur in einer `sr-only`-Spanne: wer
   * sah, bekam ein grünes Quadrat und eine farbige Schiene — zwei Codes ohne
   * Legende. Jede Ebene sagt jetzt, was sie ist, und das Wort trägt die eigene
   * Kennzahl des Knotens.
   */
  it("nennt an jeder Ebene ihren Typ", () => {
    render(<StructureMap overview={voll()} showEpics showInvest showRun />);

    expect(screen.getByText("Wertstrom · 2 ARTs")).toBeTruthy();
    expect(screen.getByText("ART · 12 PIs")).toBeTruthy();
    expect(screen.getByText("ART · 4 PIs")).toBeTruthy();
    expect(screen.getAllByText("Solution")).toHaveLength(2);
  });

  /** Sonst läse ein Screenreader „ART" zweimal — einmal sichtbar, einmal nicht. */
  it("trägt den Typ genau einmal im zugänglichen Namen", () => {
    render(<StructureMap overview={voll()} showEpics showInvest showRun />);

    expect(screen.getByRole("link", { name: "Plant Efficiency (OEE)" })).toBeTruthy();
    // Die Kachel **ist** der Link; ihr Name ist deshalb ihr ganzer Text.
    const kachel = screen.getByText("Produktion Betrieb").closest("a") as HTMLAnchorElement;
    expect(kachel.textContent?.match(/Solution/g)).toHaveLength(1);
  });

  it("macht jede Ebene anklickbar — die Karte ist die Navigation", () => {
    render(<StructureMap overview={voll()} showEpics showInvest showRun />);
    const href = (name: string) =>
      (screen.getByText(name).closest("a") as HTMLAnchorElement | null)?.getAttribute("href");

    expect(href("Produktion")).toBe("/structure/value-stream/vs1");
    expect(href("Plant Efficiency (OEE)")).toBe("/structure/art/a-oee");
    expect(href("Produktion Betrieb")).toBe("/structure/solution/s-betrieb");
  });

  /** Ohne Modul steht kein „0 €" da, sondern gar nichts. */
  it("lässt Grow und Run weg, wenn die Module fehlen", () => {
    const { container } = render(
      <StructureMap
        overview={buildStructureOverview(tree)}
        showEpics={false}
        showInvest={false}
        showRun={false}
      />,
    );
    expect(container.textContent).not.toContain("Grow");
    expect(container.textContent).not.toContain("Run");
    expect(container.textContent).not.toContain("0 €");
    // Die Struktur selbst bleibt vollständig.
    expect(screen.getByText("Produktion Programm")).toBeTruthy();
    expect(screen.getByText("ART · 12 PIs")).toBeTruthy();
  });
});

describe("StructureTable", () => {
  it("trägt die Summe der Blätter an ART und Wertstrom", () => {
    render(<StructureTable overview={voll()} grouping="struktur" showEpics showInvest showRun />);

    const zeile = (name: string) => screen.getByText(name).closest("tr") as HTMLElement;
    // 1.660.050 + 1.520.000 = 3.180.050 → €3.18M
    expect(within(zeile("Produktion")).getByText("€3.18M")).toBeTruthy();
    expect(within(zeile("Plant Efficiency (OEE)")).getByText("€3.18M")).toBeTruthy();
    expect(within(zeile("Produktion Betrieb")).getByText("€1.66M")).toBeTruthy();
  });

  it("sagt an der Zeile eines ARTs ohne Solution, was fehlt", () => {
    render(<StructureTable overview={voll()} grouping="struktur" showEpics showInvest showRun />);
    const zeile = screen.getByText("Materials & Energy").closest("tr") as HTMLElement;
    expect(within(zeile).getByText("keine Solution")).toBeTruthy();
  });

  /**
   * Die frühere flache Liste sortierte nach `horizon` und warf Investing und
   * Extracting in einen Topf. Gruppiert wird nach dem **Stand**.
   */
  it("gruppiert nach Horizont mit Anzahl je Gruppe", () => {
    render(<StructureTable overview={voll()} grouping="horizont" showEpics showInvest showRun />);
    expect(screen.getByText("H2 · Emerging — 1")).toBeTruthy();
    expect(screen.getByText("H1 · Investing — 1")).toBeTruthy();
    // Der Ort steht in der zweiten Spalte, seit der Baum daneben fehlt.
    expect(screen.getAllByText("Produktion · Plant Efficiency (OEE)")).toHaveLength(2);
  });

  it("unterscheidet ‚kein Epic‘ von ‚nicht zugeteilt‘", () => {
    const ohne = rollUpStructureMoney(buildStructureOverview(tree), {
      "s-betrieb": { grow: 0, run: 0, epicCount: 12 },
      "s-programm": { grow: 0, run: 0, epicCount: 0 },
    });
    render(<StructureTable overview={ohne} grouping="struktur" showEpics showInvest showRun />);

    expect(
      within(screen.getByText("Produktion Betrieb").closest("tr") as HTMLElement).getByText(
        "nicht zugeteilt",
      ),
    ).toBeTruthy();
    expect(
      within(screen.getByText("Produktion Programm").closest("tr") as HTMLElement).getAllByText(
        "kein Epic",
      ).length,
    ).toBeGreaterThan(0);
  });

  it("zeigt die Run-Fussnote nur mit Budgeting-Modul", () => {
    const { container, rerender } = render(
      <StructureTable overview={voll()} grouping="struktur" showEpics showInvest showRun />,
    );
    expect(container.textContent).toContain("zugerechnet sind");
    rerender(
      <StructureTable overview={voll()} grouping="struktur" showEpics showInvest showRun={false} />,
    );
    expect(container.textContent).not.toContain("zugerechnet sind");
  });
});
