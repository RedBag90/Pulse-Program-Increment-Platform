import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";

// Die drei Update-Actions sind `"use server"`-Module; im jsdom-Lauf werden sie
// nur als Referenz an `useActionState` gereicht, nie aufgerufen.
vi.mock("@/modules/core/org/features/value-stream/actions/value-stream", () => ({
  updateValueStreamAction: async () => ({}),
}));
vi.mock("@/modules/core/org/features/art/actions/art", () => ({
  updateArtAction: async () => ({}),
}));
vi.mock("@/modules/core/org/features/solution/actions/solution", () => ({
  updateSolutionAction: async () => ({}),
}));

// Filter und Suche stehen in der URL; ohne App-Router gibt es die im Test nicht.
// Der Mock ist zugleich der Hebel, mit dem die Filterzustände geprüft werden.
const urlParams = { current: new URLSearchParams() };
vi.mock("@/lib/hooks/use-url-state", () => ({
  useUrlState: () => ({ params: urlParams.current, push: vi.fn() }),
}));

// Die Karte verlinkt ihre Knoten; `@/i18n/navigation` zieht die
// next-intl-Routing-Konfiguration nach, im jsdom-Lauf reicht ein `<a>`.
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { RoleDirectoryView } from "@/modules/core/org/features/structure/components/role-directory-view";
import { buildRoleDirectory, targetKey } from "@/modules/core/org/domain/role-directory";

const tree = [
  {
    id: "vs-1",
    name: "Logistik",
    financeApproverId: "u-fin",
    vmoId: null,
    businessOwnerId: null,
    architectLeadId: null,
    arts: [{ id: "art-1", name: "Transport", rteId: null, technicalLeadId: null }],
    solutions: [
      {
        id: "sol-1",
        name: "Betrieb",
        artId: "art-1",
        horizon: "h1",
        investmentMode: null,
        productManagerId: null,
      },
    ],
  },
  {
    id: "vs-2",
    name: "Produktion",
    financeApproverId: "u-fin",
    vmoId: "u-vmo",
    businessOwnerId: null,
    architectLeadId: null,
    arts: [],
    solutions: [],
  },
];

const LABELS: Record<string, string> = { "u-fin": "anna@x.dev", "u-vmo": "bernd@x.dev" };
const streams = buildRoleDirectory(tree, (id) => LABELS[id] ?? id);
const users = [{ value: "u-fin", label: "anna@x.dev" }];

/** Ohne Parameter steht die Karte — sie ist der Standard. */
function show(params = "") {
  urlParams.current = new URLSearchParams(params);
  return render(<RoleDirectoryView streams={streams} users={users} editable={new Set()} />);
}

/** Dieselbe Fläche als Liste. */
const alsTabelle = (params = "") => show(params ? `view=tabelle&${params}` : "view=tabelle");

describe("RoleDirectoryView", () => {
  /**
   * Der halbe Zweck der Fläche: eine unbesetzte Zuständigkeit **verschwindet
   * nicht**. „An niemanden" ist eine Auskunft, und wer sie nicht bekommt, sucht
   * weiter.
   */
  it("zeigt jeden Platz, auch den unbesetzten", () => {
    show();
    expect(screen.getAllByText("Finance Approver").length).toBe(2);
    expect(screen.getAllByText("Business Owner").length).toBe(2);
    expect(screen.getByText("ART Technical Lead")).toBeTruthy();
    expect(screen.getByText("Produkt-Manager")).toBeTruthy();
  });

  it("zählt die offenen Zuständigkeiten je Karte", () => {
    show();
    // Logistik: 3 am Wertstrom + RTE + Technical Lead + Produkt-Manager.
    expect(screen.getByText("6 offen")).toBeTruthy();
    // Produktion: Business Owner + Architect Lead.
    expect(screen.getByText("2 offen")).toBeTruthy();
  });

  /**
   * **Die eigentliche Zusicherung.** Ohne Recht ist keine Zeile ein
   * Bedienelement — auch keine leere. Die Durchsetzung sitzt am Service, aber
   * eine Fläche, die zum Klicken einlädt und dann ablehnt, ist ein eigener
   * Fehler. (Der Filter-Umschalter und „Zurücksetzen" sind Buttons der Leiste,
   * keine Plätze — deshalb wird namentlich geprüft.)
   */
  it("bietet ohne Recht keine einzige Zeile zum Anfassen an", () => {
    show();
    expect(screen.queryByLabelText(/Finance Approver/)).toBeNull();
    expect(screen.queryByText("Benennen")).toBeNull();
    expect(screen.getAllByText("Nicht benannt").length).toBeGreaterThan(0);
  });

  it("macht genau die Zeilen anfassbar, für die das Recht gilt", () => {
    urlParams.current = new URLSearchParams();
    const editable = new Set([targetKey("valueStream", "vs-1")]);
    render(<RoleDirectoryView streams={streams} users={users} editable={editable} />);

    expect(screen.getByLabelText(/^Business Owner: niemand benannt/)).toBeTruthy();
    expect(screen.queryByLabelText(/^RTE:/)).toBeNull();
    expect(screen.queryByLabelText(/^Produkt-Manager:/)).toBeNull();
  });

  /**
   * Ein `aria-label` **ersetzt** den Inhalt des Buttons, statt ihn zu ergänzen.
   * Stünde der Name nicht darin, hörte niemand mit Screenreader je, wer benannt
   * ist — genau das war der Fehler in der ersten Fassung.
   */
  it("nennt den Namen in der Ansage einer besetzten Zeile", () => {
    urlParams.current = new URLSearchParams();
    const editable = new Set([targetKey("valueStream", "vs-1")]);
    render(<RoleDirectoryView streams={streams} users={users} editable={editable} />);
    expect(screen.getByLabelText("Finance Approver: anna@x.dev. Ändern")).toBeTruthy();
  });

  it("lässt bei „nur offene“ keine besetzte Zeile stehen", () => {
    show("offen=1");
    expect(screen.queryByText("anna@x.dev")).toBeNull();
    expect(screen.queryByText("bernd@x.dev")).toBeNull();
    expect(screen.getAllByText("Nicht benannt").length).toBe(8);
  });

  /** Die Frage, die die Fläche vorher nicht beantworten konnte. */
  it("findet eine Person über mehrere Wertströme hinweg", () => {
    show("q=anna");
    expect(screen.getAllByText("anna@x.dev").length).toBe(2);
    expect(screen.getByText("Logistik")).toBeTruthy();
    expect(screen.getByText("Produktion")).toBeTruthy();
    // Alles andere ist weg — auch die Karte ohne Treffer hätte sonst nur einen
    // Kopf und nichts darunter.
    expect(screen.queryByText("Business Owner")).toBeNull();
  });

  it("sucht auch über das Anliegen, nicht nur über den Rollennamen", () => {
    show("q=budget");
    expect(screen.getAllByText("Finance Approver").length).toBe(2);
    expect(screen.queryByText("Portfolio Manager")).toBeNull();
  });

  it("sagt es, wenn der Filter nichts übrig lässt", () => {
    show("q=gibtesnicht");
    expect(screen.getByText("Nichts gefunden")).toBeTruthy();
  });

  it("sagt einem Mandanten ohne Struktur, dass es nichts zu fragen gibt", () => {
    urlParams.current = new URLSearchParams();
    render(<RoleDirectoryView streams={[]} users={users} editable={new Set()} />);
    expect(screen.getByText("Noch kein Wertstrom")).toBeTruthy();
  });
});

/**
 * Die Fläche zeigt dieselben Plätze in zwei Formen. Geprüft wird deshalb je
 * Sicht, dass **jede Ebene ihren Ort hat** — der Wertstrom im Streifen, der ART
 * in der Spalte, die Solution in der Kachel darin.
 */
describe("die beiden Sichten", () => {
  it("Karte: Wertstrom-Rollen im Streifen, ART-Rollen in der Spalte, Solution darin", () => {
    const { container } = show();

    const bahn = screen.getByText("Logistik").closest("section")!;
    const streifen = bahn.querySelector("section > div")!;
    expect(streifen.textContent).toContain("Finance Approver");
    expect(streifen.textContent).toContain("Value Stream Architect Lead");
    // Die ART-Rollen stehen **nicht** im Streifen, sondern in der Spalte.
    expect(streifen.textContent).not.toContain("RTE");

    const spalte = screen.getByText("Transport").closest("div")!.parentElement!;
    expect(spalte.textContent).toContain("RTE");
    expect(spalte.textContent).toContain("ART Technical Lead");
    expect(spalte.textContent).toContain("Betrieb");
    expect(spalte.textContent).toContain("Produkt-Manager");

    // Die Karte ist zugleich die Navigation.
    expect(container.querySelector('a[href="/structure/value-stream/vs-1"]')).toBeTruthy();
    expect(container.querySelector('a[href="/structure/art/art-1"]')).toBeTruthy();
    expect(container.querySelector('a[href="/structure/solution/sol-1"]')).toBeTruthy();
  });

  it("Karte: ein Wertstrom ohne ART sagt das, statt leer zu bleiben", () => {
    show();
    expect(screen.getByText("Noch kein ART in diesem Wertstrom.")).toBeTruthy();
  });

  it("Tabelle: dieselben Plätze als Zeilen, die Solution unter ihrem ART", () => {
    alsTabelle();
    expect(screen.getAllByText("Finance Approver").length).toBe(2);
    expect(screen.getByText("ART Technical Lead")).toBeTruthy();
    expect(screen.getByText("Produkt-Manager")).toBeTruthy();

    // „Solution Betrieb" steht **innerhalb** des ART-Blocks „Transport".
    const artBlock = screen.getByText("Transport").closest("div")!;
    expect(artBlock.textContent).toContain("Betrieb");
    expect(artBlock.textContent).toContain("Produkt-Manager");
  });

  it("die Rechteregel gilt in beiden Sichten", () => {
    alsTabelle();
    expect(screen.queryByLabelText(/Finance Approver/)).toBeNull();
    expect(screen.queryByText("Benennen")).toBeNull();
  });
});
