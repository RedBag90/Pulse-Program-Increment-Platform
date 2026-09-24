import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { DueSoonBlock } from "@/modules/work/features/portfolio/overview/blocks/due-soon-block";
import type { ClassFilterState, DueSoonItem } from "@/modules/work/server/views/portfolio-overview";

/**
 * Die Kachel hatte **keinen** Test. Geprueft wird, was die Kappung zusichert:
 * sechs Zeilen, der Rest im Aufklapper, und die Gesamtzahl bleibt im Kopf
 * stehen — sie ist der Grund, warum man aufklappt.
 *
 * Der Aufklapper ist ein `<details>`, kein Knopf: die Datei ist eine
 * Server-Komponente und soll es bleiben.
 */

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, ...props }: { children: React.ReactNode }) => <a {...props}>{children}</a>,
}));

const item = (n: number): DueSoonItem => ({
  id: `e${n}`,
  title: `Vorhaben ${n}`,
  subtitle: "Produktion",
  epic: null,
  dateIso: "2026-09-01",
  daysUntil: -19,
  overdue: true,
  epicClass: null,
  solution: null,
});

const KEINE_FACETTE: ClassFilterState = {
  selected: [],
  hiddenLabelKey: null,
  hiddenClass: null,
  hiddenCount: 0,
};

const block = (items: DueSoonItem[], classFilter: ClassFilterState = KEINE_FACETTE) =>
  render(
    <DueSoonBlock
      label="L4-Abschluss fällig"
      items={items}
      hrefBase="/portfolio/epics"
      emptyText="Nichts fällig."
      classFilter={classFilter}
    />,
  );

describe("DueSoonBlock — Kappung", () => {
  it("zeigt sechs Zeilen und legt den Rest in den Aufklapper", () => {
    const { container } = block(Array.from({ length: 14 }, (_, i) => item(i + 1)));
    const listen = container.querySelectorAll("ul");
    // Die erste Liste ist die Hauptliste.
    expect(listen[0]!.querySelectorAll("li")).toHaveLength(6);
    expect(screen.getByText("8 weitere")).toBeTruthy();
    // Der Rest steht im DOM, nur zugeklappt — Suchen im Browser findet ihn.
    expect(screen.getByText("Vorhaben 14")).toBeTruthy();
  });

  it("die Zahl im Kopf bleibt die Gesamtzahl, nicht die gezeigte", () => {
    block(Array.from({ length: 14 }, (_, i) => item(i + 1)));
    expect(screen.getByText("14")).toBeTruthy();
  });

  it("bei sechs oder weniger gibt es keinen Aufklapper", () => {
    const { container } = block(Array.from({ length: 4 }, (_, i) => item(i + 1)));
    // Ein leerer Aufklapper waere ein Knopf, der nichts tut.
    expect(container.querySelector("details")).toBeNull();
  });

  it("genau sieben ergeben sechs plus einen", () => {
    block(Array.from({ length: 7 }, (_, i) => item(i + 1)));
    expect(screen.getByText("1 weitere")).toBeTruthy();
  });

  it("kein Knopf, sondern ein details — die Datei bleibt server-seitig", () => {
    const { container } = block(Array.from({ length: 9 }, (_, i) => item(i + 1)));
    expect(container.querySelector("details > summary")).toBeTruthy();
    expect(container.querySelector("button")).toBeNull();
  });

  /**
   * **Der Fehler, den die Kappung zuerst eingebaut hat.** Mit `max-height` lag
   * die Karte zugeklappt darunter und wuchs beim Oeffnen bis an den Deckel — die
   * eine Karte stand dann hoeher als die andere daneben. Eine **feste** Hoehe
   * ist in beiden Zustaenden dieselbe.
   */
  it("der Kasten hat eine feste Hoehe, sobald es etwas aufzuklappen gibt", () => {
    const { container } = block(Array.from({ length: 14 }, (_, i) => item(i + 1)));
    const kasten = container.querySelector("details")!.parentElement as HTMLElement;
    expect(kasten.style.height).not.toBe("");
    expect(kasten.style.maxHeight).toBe("");
  });

  it("gibt es nichts aufzuklappen, richtet sich der Kasten nach dem Inhalt", () => {
    const { container } = block(Array.from({ length: 3 }, (_, i) => item(i + 1)));
    // Eine Karte mit drei Zeilen soll nicht kuenstlich hoch stehen — springen
    // kann sie ohnehin nicht, es gibt keinen Aufklapper.
    const kasten = container.querySelector("ul")!.parentElement as HTMLElement;
    expect(kasten.style.height).toBe("");
  });

  it("leer bleibt leer", () => {
    block([]);
    expect(screen.getByText("Nichts fällig.")).toBeTruthy();
  });
});

describe("DueSoonBlock — Sammelzeilen der Klassen-Facette", () => {
  /**
   * Sie stehen fuer Arbeit, die die Facette ohnehin schon versteckt. Sie ein
   * zweites Mal wegzuklappen waere dieselbe Auskunft zweimal verweigert.
   */
  it("stehen ausserhalb der Kappung, auch wenn die Hauptliste voll ist", () => {
    const sichtbar: DueSoonItem[] = Array.from({ length: 10 }, (_, i) => ({
      ...item(i + 1),
      epicClass: "portfolio",
    }));
    const versteckt: DueSoonItem[] = [
      { ...item(99), epicClass: "art", solution: { id: "s1", name: "Logistik" } },
    ];
    const { container } = block([...sichtbar, ...versteckt], {
      selected: ["portfolio"],
      hiddenLabelKey: "work.epicClassPlural.art",
      hiddenClass: "art",
      hiddenCount: 1,
    });
    // Die Sammelzeile steht in der letzten Liste — nicht im `<details>`.
    expect(screen.getByText("Logistik")).toBeTruthy();
    const details = container.querySelector("details");
    expect(details?.textContent).not.toContain("Logistik");
  });
});
