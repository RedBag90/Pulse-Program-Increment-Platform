import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
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

/**
 * Die Zusagen für den Fall, um den es geht: **viele** Issues. Gemessen am
 * Bestand (Large Test Corp, 148 dokumentierte) war die Tabelle 5,7 Bildschirme
 * lang, zwei Heads trugen 75 Zeilen, und alles stand offen.
 */
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

/** Ein Rollup, wie der Server ihn an einen Head hängt. */
const rollup = (descendantCount: number): IssueListRow["rollup"] => ({
  roamCounts: { open: 0, resolved: 0, owned: descendantCount, accepted: 0, mitigated: 0 },
  spannedEpics: 0,
  descendantCount,
});

const viele = (n: number, o: Partial<IssueListRow> = {}) =>
  Array.from({ length: n }, (_, i) => row({ id: `r${i}`, ...o }));

/** Die Zeilen tragen `role="button"` (die ganze Zeile öffnet das Issue). */
const zeilenTitel = () => screen.queryAllByRole("button", { name: /^Issue öffnen:/ });

/** Die Gruppenköpfe — die einzigen Knöpfe mit `aria-expanded` in der Tabelle. */
const gruppenKoepfe = () =>
  screen
    .getAllByRole("button")
    .filter(
      (b) =>
        b.getAttribute("aria-expanded") != null &&
        !/klappen$/.test(b.getAttribute("aria-label") ?? ""),
    );

describe("Issue-Tabelle bei vielen Zeilen", () => {
  describe("Baum", () => {
    const baum = [
      row({ id: "h", rollup: rollup(2) }),
      row({ id: "k1", parentId: "h" }),
      row({ id: "k2", parentId: "h" }),
    ];

    it("startet zugeklappt — der Head steht da, seine Kinder nicht", () => {
      render(<IssuesListTable rows={baum} compact dnd={null} />);
      expect(screen.getByText("Issue h")).toBeTruthy();
      expect(screen.queryByText("Issue k1")).toBeNull();
      expect(screen.queryByText("Issue k2")).toBeNull();
    });

    it("meldet das Aufklappen nach oben, statt es selbst zu merken", () => {
      const onToggleRow = vi.fn();
      render(<IssuesListTable rows={baum} compact dnd={null} onToggleRow={onToggleRow} />);
      fireEvent.click(screen.getByRole("button", { name: "Aufklappen" }));
      expect(onToggleRow).toHaveBeenCalledWith("h");
    });

    it("zeigt die Kinder, wenn der Head in der Menge steht", () => {
      render(<IssuesListTable rows={baum} compact dnd={null} expanded={new Set(["h"])} />);
      expect(screen.getByText("Issue k1")).toBeTruthy();
    });

    it("öffnet mit dem Sonderwert alle jeden Head", () => {
      render(<IssuesListTable rows={baum} compact dnd={null} expanded="alle" />);
      expect(screen.getByText("Issue k1")).toBeTruthy();
      expect(screen.getByText("Issue k2")).toBeTruthy();
    });
  });

  describe("Kappung", () => {
    it("zeigt 50 Wurzeln und bietet den Rest an", () => {
      render(<IssuesListTable rows={viele(148)} compact dnd={null} />);
      expect(zeilenTitel()).toHaveLength(50);
      const mehr = screen.getByRole("button", { name: "+ 98 weitere zeigen" });
      fireEvent.click(mehr);
      expect(zeilenTitel()).toHaveLength(100);
      expect(screen.getByRole("button", { name: "+ 48 weitere zeigen" })).toBeTruthy();
    });

    it("bleibt unsichtbar, solange sie nicht greift", () => {
      render(<IssuesListTable rows={viele(28)} compact dnd={null} />);
      expect(zeilenTitel()).toHaveLength(28);
      expect(screen.queryByRole("button", { name: /weitere zeigen/ })).toBeNull();
    });

    /** Wer einen Head öffnet, will ihn ganz sehen — Kinder zählen nicht mit. */
    it("zählt Kinder nicht gegen die Kappung", () => {
      const rows = [
        ...viele(50),
        row({ id: "h", rollup: rollup(3) }),
        row({ id: "k1", parentId: "h" }),
        row({ id: "k2", parentId: "h" }),
        row({ id: "k3", parentId: "h" }),
      ];
      render(<IssuesListTable rows={rows} compact dnd={null} expanded="alle" />);
      // 50 gezeigte Wurzeln; „h" liegt dahinter und ist noch nicht dran.
      expect(screen.queryByText("Issue k1")).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: "+ 1 weitere zeigen" }));
      expect(screen.getByText("Issue k1")).toBeTruthy();
      expect(screen.getByText("Issue k3")).toBeTruthy();
    });
  });

  describe("Gruppen", () => {
    const gemischt = [
      row({ id: "a", band: "critical" }),
      row({ id: "b", band: "critical" }),
      row({ id: "c", band: "low" }),
      row({ id: "d", band: null }),
    ];

    it("bündelt nach Exposure, kritisch zuerst, mit Zähler je Gruppe", () => {
      render(<IssuesListTable rows={gemischt} compact dnd={null} group="exposure" />);
      expect(gruppenKoepfe().map((b) => (b.textContent ?? "").trim())).toEqual([
        "Kritisch2",
        "Hoch0",
        "Mittel0",
        "Niedrig1",
        "Unbewertet1",
      ]);
    });

    /** Kein Kind steht zweimal: gebündelt werden die Wurzeln, nicht die Zeilen. */
    it("summiert die Gruppenzähler auf die Zahl der Wurzeln", () => {
      const mitKind = [...gemischt, row({ id: "k", parentId: "a", band: "low" })];
      render(<IssuesListTable rows={mitKind} compact dnd={null} group="roam" />);
      const zahlen = gruppenKoepfe().map((b) => Number((b.textContent ?? "").replace(/\D/g, "")));
      expect(zahlen.reduce((s, n) => s + n, 0)).toBe(4);
    });

    it("gibt der leeren Gruppe eine Zeile statt eines Lochs", () => {
      render(<IssuesListTable rows={gemischt} compact dnd={null} group="exposure" />);
      expect(screen.getAllByText("Keine Issues in dieser Gruppe").length).toBeGreaterThan(0);
    });

    it("klappt eine Gruppe zu", () => {
      render(<IssuesListTable rows={gemischt} compact dnd={null} group="exposure" />);
      const kopf = screen.getByRole("button", { name: /^Kritisch/ });
      expect(screen.getByText("Issue a")).toBeTruthy();
      fireEvent.click(kopf);
      expect(screen.queryByText("Issue a")).toBeNull();
      expect(within(kopf).getByText("2")).toBeTruthy();
    });
  });
});
