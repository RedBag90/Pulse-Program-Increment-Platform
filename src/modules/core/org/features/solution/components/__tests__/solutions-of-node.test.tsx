import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { SolutionsOfNode } from "@/modules/core/org/features/solution/components/solutions-of-node";
import type { SolutionListRow } from "@/modules/core/org/server/views/solutions-list";

/**
 * **Die Naht, die ADR-0022 zieht.**
 *
 * Die Solution ist ein Strukturknoten und gehoert damit zu `core`. Ihr
 * **Grow** kommt aus den Primaer-Epics und gehoert zu `work` — genauso, wie ihr
 * **Run** zum Budgeting gehoert. Ohne das Modul gibt es die Zahl nicht, und
 * dann darf die Spalte nicht dastehen: „0 €" hiesse „nichts investiert", nicht
 * „nicht gebucht".
 *
 * Vorher hing der Solutions-Reiter am Wertstrom allein an `inScope`, einer
 * Berechtigungspruefung. Ein Mandant ohne Work sah dort Grow-Summen aus Epics,
 * die er gar nicht fuehren darf — drei Zeilen unter einer Stelle, die sehr wohl
 * auf `budgetingEnabled` prueft.
 */

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, ...props }: { children: React.ReactNode }) => <a {...props}>{children}</a>,
}));

const ROWS: SolutionListRow[] = [
  {
    id: "s1",
    name: "Werkssteuerung",
    valueStreamName: "Produktion",
    artName: "Plant Efficiency (OEE)",
    horizon: "h1",
    investmentMode: "investing",
  },
];

describe("SolutionsOfNode", () => {
  it("zeigt Grow und Epics, wenn das Work-Modul die Zahlen liefert", () => {
    render(
      <SolutionsOfNode
        rows={ROWS}
        emptyText="leer"
        growById={new Map([["s1", { grow: 240_000, epicCount: 3 }]])}
      />,
    );
    expect(screen.getByText("Grow")).toBeTruthy();
    expect(screen.getByText("Epics")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
  });

  /** Der gemeldete Fehler, als Zusicherung. */
  it("laesst beide Spalten weg, wenn es kein Work-Modul gibt", () => {
    render(<SolutionsOfNode rows={ROWS} emptyText="leer" />);
    // Der Knoten selbst bleibt sichtbar — er ist Core.
    expect(screen.getByText("Werkssteuerung")).toBeTruthy();
    expect(screen.queryByText("Grow")).toBeNull();
    expect(screen.queryByText("Epics")).toBeNull();
    // Und keine erfundene Null.
    expect(screen.queryByText("0 €")).toBeNull();
  });
});
