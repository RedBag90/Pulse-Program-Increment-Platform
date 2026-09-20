import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, within, fireEvent } from "@testing-library/react";
import type { IssuesListModel, IssueListRow } from "@/modules/risks/server/views/issues-list";

/**
 * Die Fläche hatte bis September 2026 **keinen** Komponententest — abgesichert
 * war nur das Server-Modell. Diese Datei hält die vier Zusagen fest, die der
 * Umbau gegeben hat: das Register führt, die Zähler zählen dieselbe Menge, die
 * Matrix sagt ihre Menge, und Farbe steht nirgends allein.
 */

const urlParams = { current: new URLSearchParams() };
const pushed: Record<string, string | null>[] = [];
vi.mock("@/lib/hooks/use-url-state", () => ({
  useUrlState: () => ({
    params: urlParams.current,
    push: (patch: Record<string, string | null>) => pushed.push(patch),
  }),
}));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
// Zwei schwere Kinder, die für diese Zusagen nichts beitragen.
vi.mock("@/modules/risks/features/issue/components/create-issue-dialog", () => ({
  CreateIssueDialog: () => <button type="button">Issue erfassen</button>,
}));
vi.mock("@/modules/risks/features/issue/components/issue-detail-drawer", () => ({
  IssueDetailDrawer: () => null,
}));
// Server-Actions: im jsdom-Lauf zählt nur, dass sie die Hausform haben.
vi.mock("@/modules/risks/features/issue/actions/saved-filter", () => ({
  saveIssueFilterAction: vi.fn(async () => ({})),
  deleteIssueFilterAction: vi.fn(async () => ({})),
}));

import { IssuesListShell } from "@/modules/risks/features/issue/components/issues-list-shell";

const row = (o: Partial<IssueListRow> & { id: string }): IssueListRow =>
  ({
    displayNumber: `R-${o.id}`,
    title: `Issue ${o.id}`,
    description: null,
    roamStatus: "open",
    reviewStatus: "documented",
    category: "technical",
    band: "medium",
    score: 9,
    probability: "medium",
    impact: "medium",
    ownerId: null,
    ownerLabel: null,
    artId: null,
    valueStreamId: null,
    targetResolutionDate: null,
    isOverdue: false,
    daysOpen: 3,
    parentId: null,
    rollup: null,
    initiative: null,
    mitigations: [],
    assessments: [],
    ...o,
  }) as IssueListRow;

const model = (over: Partial<IssuesListModel> = {}): IssuesListModel =>
  ({
    rows: [
      row({ id: "a", roamStatus: "owned" }),
      row({ id: "b", roamStatus: "owned" }),
      row({ id: "c", roamStatus: "resolved" }),
    ],
    suggestions: [],
    matrix: { cells: [], plots: [] },
    facets: { categories: [], owners: [], arts: [], valueStreams: [] },
    counts: { total: 3 },
    ...over,
  }) as IssuesListModel;

const caps = {
  canDocument: true,
  canUpdate: true,
  canRoam: true,
  canLink: true,
  canDelete: true,
  canReview: true,
  canManageSettings: true,
} as never;

function paint(over: Partial<IssuesListModel> = {}, url = "", extra: Record<string, unknown> = {}) {
  urlParams.current = new URLSearchParams(url);
  pushed.length = 0;
  return render(<IssuesListShell model={model(over)} userLabels={{}} caps={caps} {...extra} />);
}

describe("Issues-Register", () => {
  it("nennt im Kopf die Gesamtzahl, solange nicht gefiltert ist", () => {
    paint();
    expect(screen.getByText(/^3 Issues —/)).toBeTruthy();
  });

  /** Kopf und Tabelle zählten verschiedene Mengen, sobald jemand filterte. */
  it("nennt im Kopf die gezeigte von der gesamten Menge, sobald gefiltert ist", () => {
    paint({}, "roam=resolved");
    expect(screen.getByText(/^1 von 3 Issues —/)).toBeTruthy();
  });

  it("zählt die Funnel-Chips über die gefilterte Menge — ohne die Achse, die sie selbst schalten", () => {
    // Nach Kategorie gefiltert wäre alles drin; entscheidend ist der ROAM-Fall:
    // „Owned" gewählt ⇒ die anderen Chips dürfen **nicht** auf 0 fallen.
    paint({}, "roam=owned");
    const chip = (name: RegExp) => screen.getByRole("button", { name });
    expect(within(chip(/^Owned/)).getByText("2")).toBeTruthy();
    expect(within(chip(/^Resolved/)).getByText("1")).toBeTruthy();
    expect(within(chip(/^Alle/)).getByText("3")).toBeTruthy();
  });

  describe("Kopfstreifen", () => {
    const mitMatrix = {
      matrix: {
        cells: [],
        plots: [
          {
            issueId: "a",
            displayNumber: "R-a",
            title: "Issue a",
            roamStatus: "owned",
            trail: [{ probability: "very_high" as const, impact: "very_high" as const }],
          },
        ],
      },
    };

    it("zeigt die Matrix zugeklappt — mit ihrer Zahl", () => {
      paint(mitMatrix as Partial<IssuesListModel>);
      const streifen = screen.getByRole("button", { name: /Risk-Matrix/ });
      expect(streifen.getAttribute("aria-expanded")).toBe("false");
      expect(streifen.textContent).toContain("1 Head-Issue");
      expect(streifen.textContent).toContain("1 kritisch");
      expect(screen.queryByText(/Ein Zeichen je Head-Issue/)).toBeNull();
    });

    it("schreibt das Aufklappen in die URL", () => {
      paint(mitMatrix as Partial<IssuesListModel>);
      fireEvent.click(screen.getByRole("button", { name: /Risk-Matrix/ }));
      expect(pushed).toContainEqual({ matrix: "1" });
    });

    it("zeigt die Matrix aufgeklappt samt Achsentiteln und Menge", () => {
      paint(mitMatrix as Partial<IssuesListModel>, "matrix=1");
      // Jeder Titel steht an seiner Achse: der eine über den Spalten, der
      // andere gedreht neben den Zeilen.
      expect(screen.getByText("Auswirkung →")).toBeTruthy();
      expect(screen.getByText("Wahrscheinlichkeit →")).toBeTruthy();
      expect(screen.getByText(/Kinder zählen in ihrem Head/)).toBeTruthy();
    });

    /** Drei geführte Touren zeigen auf diesen Anker — auch zugeklappt. */
    it("behält den Tour-Anker im DOM", () => {
      const { container } = paint(mitMatrix as Partial<IssuesListModel>);
      expect(container.querySelector("[data-tour='risk-matrix']")).toBeTruthy();
      expect(container.querySelector("[data-tour='issues-funnel-bar']")).toBeTruthy();
    });
  });

  /**
   * Gespeicherte Filter — dieselbe Mechanik wie auf der Portfolio- und der
   * Ziele-Fläche, nur mit Ansicht im Umfang.
   */
  describe("Gespeicherte Filter", () => {
    const filters = [
      {
        id: "f1",
        name: "Meine kritischen",
        isDefault: true,
        criteria: {
          roam: ["owned"],
          band: ["critical"],
          group: ["exposure"],
          density: ["compact"],
        },
      },
    ];

    it("wendet einen gespeicherten Filter samt Ansicht an", () => {
      paint({}, "", { savedFilters: filters });
      fireEvent.click(screen.getByRole("button", { name: "Meine kritischen" }));
      const patch = pushed.at(-1)!;
      expect(patch["roam"]).toBe("owned");
      expect(patch["band"]).toBe("critical");
      expect(patch["group"]).toBe("exposure");
      expect(patch["density"]).toBe("compact");
      // Leere Schlüssel verschwinden aus der URL, statt leer dazustehen.
      expect(patch["owner"]).toBeNull();
      // Und der „bewusst leer"-Marker fällt: ein angewandter Filter ist das Gegenteil.
      expect(patch["f"]).toBeNull();
    });

    /** Ohne diesen Marker schlüge der Standard beim nächsten Öffnen sofort wieder zu. */
    it('setzt beim Zurücksetzen den „bewusst leer"-Marker', () => {
      paint({}, "band=critical", { savedFilters: filters });
      fireEvent.click(screen.getByRole("button", { name: /Zurücksetzen/ }));
      const patch = pushed.at(-1)!;
      expect(patch["f"]).toBe("0");
      expect(patch["roam"]).toBeNull();
      expect(patch["band"]).toBeNull();
    });

    it("bietet das Speichern erst an, wenn etwas eingestellt ist", () => {
      paint({}, "", { savedFilters: [] });
      expect(screen.queryByRole("button", { name: /Speichern/ })).toBeNull();
      paint({}, "density=compact", { savedFilters: [] });
      expect(screen.getByRole("button", { name: /Speichern/ })).toBeTruthy();
    });

    /** Im Epic-Reiter trägt die URL die Filter nicht — dort gibt es sie nicht. */
    it("zeigt die Steuerung nicht in der eingebetteten Fassung", () => {
      paint({}, "", { savedFilters: filters, embedded: true });
      expect(screen.queryByRole("button", { name: "Meine kritischen" })).toBeNull();
    });
  });
});
