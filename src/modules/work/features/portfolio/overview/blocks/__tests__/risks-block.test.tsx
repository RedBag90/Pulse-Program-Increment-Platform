import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, within } from "@testing-library/react";
import { RisksBlock } from "@/modules/work/features/portfolio/overview/blocks/risks-block";
import type {
  OverviewRisk,
  PortfolioOverview,
} from "@/modules/work/server/views/portfolio-overview";
import { ROAM_KEYS, type RoamStatus } from "@/modules/core/kernel/domain/roam";
import { catalogTranslate } from "@/test/helpers/catalog";

/*
 * Die Fläche zeigt das **Wort**, die Tabelle führt den **Schlüssel**. Der
 * Übersetzer kommt deshalb aus dem echten Katalog — er wirft, wenn ein
 * Schlüssel dort fehlt, und deckt damit nebenbei ab, was der Paritätstest in
 * `src/i18n` nicht sieht: dass diese Fläche nur vorhandene Schlüssel anfasst.
 */
const t = catalogTranslate("de");

/**
 * Die Kachel hatte **keinen** Test — und war genau deshalb still kaputt: eine
 * Liste mit `max-h-96` in einer Karte, die das Raster auf die Nachbarhöhe
 * dehnte. Sichtbar war eine abgeschnittene Liste mit Leerraum darunter.
 *
 * Geprüft wird hier, was der Umbau zusichert: fünf Dispositionen, richtige
 * Zähler, und eine leere Kachel verschwindet nicht.
 */

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, ...props }: { children: React.ReactNode }) => <a {...props}>{children}</a>,
}));

const risk = (id: string, roamStatus: RoamStatus): OverviewRisk => ({
  id,
  riskNumber: Number(id.slice(1)),
  title: `Risiko ${id}`,
  band: "high",
  score: 12,
  roamStatus,
  epic: null,
});

const data = (risks: OverviewRisk[]): PortfolioOverview => ({ risks }) as PortfolioOverview;

/** Die Karte zu einer Disposition, über ihre Überschrift gefunden. */
const cardOf = (status: RoamStatus): HTMLElement => {
  const heading = screen.getByText(t(ROAM_KEYS[status]));
  const card = heading.closest("div.flex")?.parentElement;
  if (!card) throw new Error(`Keine Karte für ${status}`);
  return card as HTMLElement;
};

describe("RisksBlock", () => {
  it("führt alle fünf Dispositionen mit ihren Zählern", () => {
    render(
      <RisksBlock
        data={data([
          risk("r1", "open"),
          risk("r2", "open"),
          risk("r3", "owned"),
          risk("r4", "resolved"),
          risk("r5", "accepted"),
          risk("r6", "mitigated"),
        ])}
      />,
    );
    for (const s of ["open", "owned", "resolved", "accepted", "mitigated"] as const) {
      expect(screen.getByText(t(ROAM_KEYS[s]))).toBeTruthy();
    }
    expect(within(cardOf("open")).getByText("2")).toBeTruthy();
    // Die Gesamtzahl steht im Kopf der Sektion.
    expect(screen.getByText("6")).toBeTruthy();
  });

  /**
   * `Test Demo` hat genau ein Risiko. Verschwänden die leeren Kacheln, zerfiele
   * die Fläche bei kleinen Mandanten zu einer einzelnen Karte.
   */
  it("zeigt eine leere Disposition mit Leertext statt sie wegzulassen", () => {
    render(<RisksBlock data={data([risk("r1", "open")])} />);
    expect(screen.getByText(t(ROAM_KEYS.resolved))).toBeTruthy();
    expect(screen.getAllByText("Keine Risiken in diesem Zustand.")).toHaveLength(4);
  });

  /**
   * Die vier **bearbeiteten** Dispositionen zeigen nur die Spitze — die volle
   * Liste fuellt sonst die Flaeche, ohne dass jemand sie liest. Geprueft wird
   * die Struktur, nicht die Sichtbarkeit: `<details>` versteckt seinen Inhalt
   * optisch, im DOM steht er immer.
   */
  it("kappt eine bearbeitete Kachel bei fuenf und legt den Rest ins Aufklappen", () => {
    const risks = Array.from({ length: 8 }, (_, i) => risk(`r${i + 1}`, "owned"));
    render(<RisksBlock data={data(risks)} />);

    const card = cardOf("owned");
    const listen = card.querySelectorAll("ul");
    expect(listen).toHaveLength(2);
    expect(listen[0]!.querySelectorAll("li")).toHaveLength(5);
    expect(listen[1]!.querySelectorAll("li")).toHaveLength(3);

    expect(within(card).getByText("3 weitere")).toBeTruthy();
    // Der Zaehler im Kartenkopf zeigt weiter die volle Menge.
    expect(within(card).getByText("8")).toBeTruthy();
  });

  it("zeigt kein Aufklappen, wenn fuenf oder weniger Eintraege da sind", () => {
    render(
      <RisksBlock data={data(Array.from({ length: 5 }, (_, i) => risk(`r${i}`, "accepted")))} />,
    );
    const card = cardOf("accepted");
    expect(card.querySelector("summary")).toBeNull();
    expect(card.querySelectorAll("li")).toHaveLength(5);
  });

  /** „Offen" ist die Menge, ueber die zu entscheiden ist — eine halbe Liste waere keine. */
  it("laesst Offen vollstaendig", () => {
    const risks = Array.from({ length: 27 }, (_, i) => risk(`r${i}`, "open"));
    render(<RisksBlock data={data(risks)} />);
    const card = cardOf("open");
    expect(card.querySelector("summary")).toBeNull();
    expect(card.querySelectorAll("li")).toHaveLength(27);
  });

  /**
   * **Der Fehler, der zweimal passiert ist.**
   *
   * Die Liste soll die gedehnte Karte fuellen (`flex-1 min-h-0`), und der
   * 384-px-Deckel soll nur unterhalb von `lg` gelten, wo die Karten
   * untereinander stehen. Stand `max-h-96` ohne Breakpoint da, gewann
   * `max-height` gegen das Flex-Wachstum: die Liste brach bei 384 px ab,
   * waehrend die Karte darunter leer weiterlief.
   *
   * Das hier prueft eine Klassenkette und ist damit naeher an der Umsetzung,
   * als mir lieb ist. Es steht trotzdem da, weil jsdom kein Layout rechnet —
   * eine Hoehe laesst sich nicht messen, die Absicht schon. Dasselbe Mittel
   * benutzt der ADR-0021-Waechter, der ebenfalls Klassen liest statt Pixel.
   */
  it("deckelt die Liste nur unterhalb von lg, damit flex-1 darueber greift", () => {
    render(<RisksBlock data={data([risk("r1", "open")])} />);
    const liste = cardOf("open").querySelector("div.overflow-y-auto");
    expect(liste).not.toBeNull();
    const klassen = liste!.className;
    expect(klassen).toContain("flex-1");
    expect(klassen).toContain("min-h-0");
    // Beide gehoeren zusammen: der Deckel ohne den Breakpoint hebt flex-1 auf.
    expect(klassen).toContain("max-h-96");
    expect(klassen).toContain("lg:max-h-none");
  });

  /**
   * **Die Offen-Spalte nimmt die Zeilenhoehe, statt sie zu setzen.**
   *
   * Ab `lg` ist die Karte absolut positioniert und damit aus dem Fluss: die
   * Zeilenhoehe kommt allein aus den Spalten 2 und 3. Ohne das war „Offen" mit
   * 27 Zeilen die hoechste Kachel und gab die Hoehe vor.
   *
   * Wieder eine Klassenpruefung — jsdom rechnet kein Layout. Sie steht hier,
   * damit niemand `lg:absolute`/`lg:relative` fuer Deko haelt und beim
   * Aufraeumen entfernt: beide gehoeren zusammen, und ohne den Wrapper mit
   * `relative` loest `inset-0` gegen einen falschen Bezug auf.
   */
  it("nimmt Offen ab lg aus dem Fluss, damit die Nachbarspalten die Hoehe setzen", () => {
    render(<RisksBlock data={data([risk("r1", "open")])} />);
    const karte = cardOf("open");
    expect(karte.className).toContain("lg:absolute");
    expect(karte.className).toContain("lg:inset-0");
    expect(karte.parentElement?.className).toContain("lg:relative");
  });

  it("legt jedes Risiko in die Kachel seiner Disposition", () => {
    render(<RisksBlock data={data([risk("r1", "open"), risk("r2", "mitigated")])} />);
    expect(within(cardOf("open")).getByText("Risiko r1")).toBeTruthy();
    expect(within(cardOf("mitigated")).getByText("Risiko r2")).toBeTruthy();
    expect(within(cardOf("open")).queryByText("Risiko r2")).toBeNull();
  });
});
