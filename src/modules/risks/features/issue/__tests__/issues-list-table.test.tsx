import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, within } from "@testing-library/react";
import type { IssueListRow } from "@/modules/risks/server/views/issues-list";

vi.mock("@/lib/hooks/use-url-state", () => ({
  useUrlState: () => ({ params: new URLSearchParams(), push: vi.fn() }),
}));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

import { IssuesListTable } from "@/modules/risks/features/issue/components/issues-list-table";

const row = (o: Partial<IssueListRow> & { id: string }): IssueListRow =>
  ({
    displayNumber: `R-${o.id}`,
    title: `Issue ${o.id}`,
    description: null,
    roamStatus: "owned",
    reviewStatus: "documented",
    category: "technical",
    band: "high",
    score: 12,
    probability: "high",
    impact: "medium",
    ownerId: null,
    ownerLabel: null,
    artId: null,
    valueStreamId: null,
    targetResolutionDate: null,
    isOverdue: false,
    daysOpen: 1,
    parentId: null,
    rollup: null,
    initiative: null,
    mitigations: [],
    assessments: [],
    ...o,
  }) as IssueListRow;

describe("Issues-Tabelle", () => {
  /**
   * Exposure und ROAM sind Skalen und tragen Farbe **mit** Wort. Die Kategorie
   * ist eine Facette ohne Ordnung — sie trug bis September 2026 trotzdem eine
   * Pille, in allen vier Ausprägungen im selben Grau.
   */
  it("zeigt die Kategorie als Text, nicht als Pille", () => {
    render(<IssuesListTable rows={[row({ id: "a" })]} compact={false} dnd={null} />);
    const zelle = screen.getByText("Technisch");
    expect(zelle.closest("span[class*='rounded-full']")).toBeNull();
    // Die beiden Skalen daneben bleiben Pillen.
    expect(screen.getByText("Hoch").className).toContain("rounded");
    expect(screen.getByText("Owned").className).toContain("rounded");
  });

  /** Farbe ohne Wort, zwei Spalten neben der Pille, die dasselbe mit Wort sagt. */
  it("trägt keinen ROAM-Farbstreifen mehr an der Zeile", () => {
    const { container } = render(
      <IssuesListTable rows={[row({ id: "a" })]} compact={false} dnd={null} />,
    );
    expect(container.querySelector("span[class*='bg-blue-500']")).toBeNull();
    expect(container.querySelector("span[class*='w-[3px]']")).toBeNull();
  });

  /** Die Schiene der Wurzel bleibt — sie sagt etwas anderes. */
  it("behält die Head-Schiene an Wurzelzeilen", () => {
    render(
      <IssuesListTable
        rows={[row({ id: "h" }), row({ id: "k", parentId: "h" })]}
        compact={false}
        dnd={null}
        expanded={new Set(["h"])}
      />,
    );
    const zeile = (titel: string) => screen.getByText(titel).closest("tr") as HTMLElement;
    expect(zeile("Issue h").style.boxShadow).toContain("inset 3px");
    expect(zeile("Issue k").style.boxShadow).toBe("");
    expect(within(zeile("Issue k")).getByText("Owned")).toBeTruthy();
  });
});
