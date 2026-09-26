import { describe, it, expect, vi } from "vitest";
import React, { type ReactNode } from "react";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children?: ReactNode; href?: string }) => (
    <a href={href}>{children}</a>
  ),
}));
import { render, screen, within } from "@testing-library/react";
import { EventsView } from "@/modules/wiki/features/wiki/components/events-view";
import { eventsFor } from "@/modules/wiki/domain/events";

/**
 * **Die Termine-Seite** — Legende, je Event die Tabelle, die eigene Rolle
 * markiert, Sprungleiste und Verweise auf die Anleitungen.
 */

const netz = (roles: string[] = [], guideTitles: Record<string, string> = {}) =>
  render(<EventsView catalog={eventsFor("de")} own={roles} guideTitles={guideTitles} />);

describe("EventsView", () => {
  it("die Legende sagt, was die Zeichen heissen — Zeichen und Wort", () => {
    netz();
    expect(screen.getAllByText("leitet oder verantwortet").length).toBeGreaterThan(1);
    expect(screen.getAllByText("nimmt aktiv teil").length).toBeGreaterThan(1);
  });

  it("je Event Rhythmus, Zweck und die Rollen mit Vorbereitung", () => {
    netz();
    const pi = document.getElementById("pi-planning")!;
    expect(within(pi).getByText("PI Planning")).toBeTruthy();
    expect(within(pi).getByText("jedes PI, 2 Tage")).toBeTruthy();
    const rte = within(pi).getByText("RTE").closest("tr")!;
    expect(within(rte).getByText("Logistik und Agenda")).toBeTruthy();
    expect(within(rte).getByText("leitet oder verantwortet")).toBeTruthy();
    const pm = within(pi).getByText("Portfolio Manager").closest("tr")!;
    expect(within(pm).getByText("optional")).toBeTruthy();
  });

  it("die eigene Rolle ist markiert, die anderen bleiben stehen", () => {
    netz(["rte"]);
    const pi = document.getElementById("pi-planning")!;
    const rte = within(pi).getByText("RTE").closest("tr")!;
    expect(rte.getAttribute("data-own")).toBe("true");
    expect(within(rte).getByText("deine Rolle")).toBeTruthy();
    expect(
      within(pi).getByText("Produkt-Manager").closest("tr")!.getAttribute("data-own"),
    ).toBeNull();
  });

  it("eine Benennung steht mit ihrem Namen da und wird wie eine Rolle markiert", () => {
    netz(["solution.product"]);
    const po = document.getElementById("po-sync")!;
    const pm = within(po).getByText("Produkt-Manager").closest("tr")!;
    expect(within(pm).getByText("leitet oder verantwortet")).toBeTruthy();
    expect(pm.getAttribute("data-own")).toBe("true");
    expect(within(po).queryByText("Feature Owner")).toBeNull();
  });

  it("eine Benennung am Wertstrom wird markiert — der Finance Approver im Portfolio Sync", () => {
    netz(["vs.finance"]);
    const sync = document.getElementById("portfolio-sync")!;
    const zeile = within(sync).getByText("Finance Approver").closest("tr")!;
    expect(zeile.getAttribute("data-own")).toBe("true");
    expect(within(zeile).getByText("nimmt aktiv teil")).toBeTruthy();
  });

  it("die Sprungleiste führt zu jeder Ebene und jedem Event", () => {
    netz();
    const nav = screen.getByRole("navigation", { name: "Auf dieser Seite" });
    expect(within(nav).getByRole("link", { name: "Portfolio-Ebene" }).getAttribute("href")).toBe(
      "#portfolio",
    );
    expect(within(nav).getByRole("link", { name: "System Demo" }).getAttribute("href")).toBe(
      "#system-demo",
    );
  });

  it("verweist nur auf Anleitungen, die der Leser sehen kann", () => {
    netz([], { "ein-pi-von-anfang-bis-ende": "Ein PI von Anfang bis Ende" });
    const pi = document.getElementById("pi-planning")!;
    expect(within(pi).getByRole("link", { name: "Ein PI von Anfang bis Ende" })).toBeTruthy();
    // Participatory Budgeting verweist auf eine Anleitung, die hier fehlt.
    const pb = document.getElementById("participatory-budgeting")!;
    expect(within(pb).queryByText("Mehr dazu:")).toBeNull();
  });
});
