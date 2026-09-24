import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent, within, act } from "@testing-library/react";
import { GoalContributionBlock } from "@/modules/work/features/portfolio/overview/blocks/goal-contribution-block";
import type {
  ClassFilterState,
  ContributionRow,
} from "@/modules/work/server/views/portfolio-overview";
import { DEFAULT_CONTRIBUTION_VIEW } from "@/modules/work/domain/contribution-view-preference";

/**
 * Die Kachel hatte **keinen** Test. Geprueft wird die Kappung: sechs Zeilen,
 * darunter „+ n weitere zeigen", und der Knopf zeigt alles auf einmal — bei 128
 * Zeilen waeren Schritte einundzwanzig Klicks.
 *
 * Dazu die Feinheit, die sonst niemandem auffiele: ein **Achsenwechsel** klappt
 * wieder zu. „je Epic" hat 128 Zeilen, „Wertstrom" drei.
 *
 * Jeder Klick laeuft durch `klick()`: die Schalter feuern nebenher die
 * Merk-Action in einem `useTransition`, und die loest nach dem Test auf, wenn
 * man sie nicht abwartet — React meldet das als `act()`-Warnung.
 */

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, ...props }: { children: React.ReactNode }) => <a {...props}>{children}</a>,
}));
vi.mock("@/modules/core/kernel/features/actions/view-preference", () => ({
  saveViewPreferenceAction: async () => ({}),
}));

const row = (n: number, valueStreamId = "vs1"): ContributionRow => ({
  epicId: `e${n}`,
  title: `Epic ${n}`,
  valueStreamId,
  valueStreamName: `Strom ${valueStreamId}`,
  recurring: [{ unit: "€", planned: 1000 * n, realized: 900 * n }],
  oneTime: [],
  epicClass: null,
  solution: null,
  art: null,
  horizon: "h1",
  benefitAssessable: true,
});

const KEINE_FACETTE: ClassFilterState = {
  selected: [],
  hiddenLabelKey: null,
  hiddenClass: null,
  hiddenCount: 0,
};

const block = (rows: ContributionRow[]) =>
  render(
    <GoalContributionBlock
      rows={rows}
      classFilter={KEINE_FACETTE}
      initialView={DEFAULT_CONTRIBUTION_VIEW}
    />,
  );

/** Ein Klick samt der Transition, die der Schalter nebenher ausloest. */
const klick = async (el: HTMLElement) => {
  await act(async () => {
    fireEvent.click(el);
  });
};

/** Die Epic-Zeilen — der erste `<tbody>`, ohne die „weitere"-Zeile. */
const datenZeilen = (container: HTMLElement): HTMLElement[] =>
  [...container.querySelectorAll("tbody")[0]!.querySelectorAll("tr")].filter(
    (tr) => within(tr as HTMLElement).queryByRole("button") === null,
  ) as HTMLElement[];

describe("GoalContributionBlock — Kappung", () => {
  it("zeigt sechs Zeilen und bietet den Rest an", () => {
    const { container } = block(Array.from({ length: 20 }, (_, i) => row(i + 1)));
    expect(datenZeilen(container)).toHaveLength(6);
    expect(screen.getByText("+ 14 weitere zeigen")).toBeTruthy();
    // Die Zahl im Kopf bleibt die Gesamtzahl.
    expect(screen.getByText("20")).toBeTruthy();
  });

  it("ein Klick zeigt alles, nicht die naechsten sechs", async () => {
    const { container } = block(Array.from({ length: 20 }, (_, i) => row(i + 1)));
    await klick(screen.getByText("+ 14 weitere zeigen"));
    expect(datenZeilen(container)).toHaveLength(20);
    expect(screen.queryByText(/weitere zeigen/)).toBeNull();
  });

  it("bei sechs oder weniger gibt es keinen Knopf", () => {
    const { container } = block(Array.from({ length: 5 }, (_, i) => row(i + 1)));
    expect(datenZeilen(container)).toHaveLength(5);
    expect(screen.queryByText(/weitere zeigen/)).toBeNull();
  });

  /**
   * **Der Fehler, den die Kappung zuerst eingebaut hat.** Mit `max-height` lag
   * die Tabelle zugeklappt darunter und wuchs beim Oeffnen bis an den Deckel —
   * die Karte sprang. Beim Aufklappen wird die gemessene Hoehe stattdessen
   * eingefroren.
   *
   * jsdom rechnet kein Layout — `offsetHeight` ist dort immer 0. Der Test legt
   * deshalb eine Hoehe unter und prueft, dass genau sie ankommt.
   */
  it("beim Aufklappen wird die Hoehe eingefroren, nicht gedeckelt", async () => {
    const { container } = block(Array.from({ length: 20 }, (_, i) => row(i + 1)));
    const kasten = container.querySelector("div.overflow-y-auto") as HTMLElement;
    expect(kasten.className).not.toContain("max-h-");
    expect(kasten.style.height).toBe("");

    Object.defineProperty(kasten, "offsetHeight", { value: 250, configurable: true });
    await klick(screen.getByText("+ 14 weitere zeigen"));
    expect(kasten.style.height).toBe("250px");
  });

  /**
   * Ohne Messung lieber wachsen als verschwinden: eine eingefrorene 0 waere
   * eine leere Karte, und das ist schlimmer als die springende, die wir
   * loswerden wollen.
   */
  it("eine Hoehe von 0 wird nicht eingefroren", async () => {
    const { container } = block(Array.from({ length: 20 }, (_, i) => row(i + 1)));
    const kasten = container.querySelector("div.overflow-y-auto") as HTMLElement;
    // jsdom meldet ohnehin 0 — genau der Fall.
    await klick(screen.getByText("+ 14 weitere zeigen"));
    expect(kasten.style.height).toBe("");
  });

  /**
   * **Der Fall, der sonst still falsch waere.** Nach dem Umschalten auf
   * „Wertstrom" stehen drei Zeilen da, wo eben 128 standen. Aufgeklappt zu
   * bleiben hiesse, einen Knopf stehen zu lassen, der nichts mehr tut.
   */
  it("ein Achsenwechsel klappt wieder zu", async () => {
    const rows = [
      ...Array.from({ length: 10 }, (_, i) => row(i + 1, "vs1")),
      ...Array.from({ length: 10 }, (_, i) => row(i + 11, "vs2")),
    ];
    const { container } = block(rows);
    const kasten = container.querySelector("div.overflow-y-auto") as HTMLElement;
    Object.defineProperty(kasten, "offsetHeight", { value: 250, configurable: true });
    await klick(screen.getByText("+ 14 weitere zeigen"));
    expect(kasten.style.height).toBe("250px");
    expect(datenZeilen(container)).toHaveLength(20);

    // Auf „Wertstrom" zusammenfassen: zwei Gruppen, also ohnehin kein Knopf.
    // Ueber die Rolle gesucht — „Wertstrom" steht auch im Spaltenkopf.
    await klick(screen.getByRole("button", { name: /Zusammenfassen nach/ }));
    await klick(screen.getByRole("button", { name: "Wertstrom" }));
    expect(datenZeilen(container)).toHaveLength(2);
    expect(screen.queryByText(/weitere zeigen/)).toBeNull();

    // Zurueck auf „je Epic": wieder gekappt, der Knopf ist zurueck.
    await klick(screen.getByRole("button", { name: /Zusammenfassen nach/ }));
    await klick(screen.getByRole("button", { name: "je Epic" }));
    expect(datenZeilen(container)).toHaveLength(6);
    expect(screen.getByText("+ 14 weitere zeigen")).toBeTruthy();
    // Und die eingefrorene Hoehe faellt mit — sonst haette die Karte fuer immer
    // die Hoehe der alten, langen Liste.
    const kasten2 = container.querySelector("div.overflow-y-auto") as HTMLElement;
    expect(kasten2.style.height).toBe("");
  });
});
