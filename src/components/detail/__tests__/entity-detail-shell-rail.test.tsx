import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";

/**
 * **Die Reiterschiene sagt, was beim aktuellen Reifegrad dran ist.**
 *
 * Über der Schiene steht die Reifegrad-Leiter (L0 · L1 · L2 …); darunter neun
 * Reiter, und zwischen beidem gab es keine sichtbare Verbindung. Jetzt trägt
 * jeder Reiter mit Reifegrad sein Etikett, und die auf dem aktuellen Stand
 * bekommen den Ring davor — dieselbe Form wie der aktuelle Punkt der Leiter.
 *
 * Der Ring ist `aria-hidden`, also nicht über die Rolle zu finden; geprüft wird
 * er am Knoten. Das ist Absicht: die Aussage trägt das Etikett und der `title`,
 * nicht die Farbe.
 *
 * Link- und Knopf-Fassung teilen sich denselben Inhalt (`inhalt` in der
 * Schale), darum genügt hier der Link-Weg — den geht auch die Epic-Seite.
 */

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, ...rest }: { children?: ReactNode; href?: string }) => (
    <a {...rest}>{children}</a>
  ),
}));

const { EntityDetailShell } = await import("@/components/detail/entity-detail-shell");

const EPIC_TABS = [
  { key: "overview", label: "Overview" },
  { key: "timeline", label: "Reifegrad-Timeline" },
  { key: "benefit-hypothesis", label: "Hypothese", gate: "L1" },
  { key: "business-case", label: "Business Case", gate: "L2" },
  { key: "breakdown", label: "Deliverables", gate: "L2" },
  { key: "dependencies", label: "Dependencies", gate: "L2" },
  { key: "kpis", label: "KPI & Nutzen", gate: "L2" },
  { key: "history", label: "History" },
];

function setup(over: { tabs?: typeof EPIC_TABS; currentGate?: string } = {}) {
  const { container } = render(
    <EntityDetailShell
      title="Ein Epic"
      tabs={over.tabs ?? EPIC_TABS}
      activeTab="overview"
      {...(over.currentGate != null ? { currentGate: over.currentGate } : {})}
      basePath="/portfolio/epics/e1"
    >
      <p>Inhalt</p>
    </EntityDetailShell>,
  );
  return container;
}

/** Die Reiter, die einen Ring tragen — am Namen erkannt, nicht an der Klasse. */
function mitRing(container: HTMLElement): string[] {
  return [...container.querySelectorAll("nav a")]
    .filter((a) => a.querySelector("span[aria-hidden]") != null)
    .map((a) => a.textContent?.replace(/L\d(?:\.\d)?$/, "").trim() ?? "");
}

describe("Reifegrad in der Reiterschiene", () => {
  it("ringt genau die Reiter des aktuellen Reifegrads", () => {
    expect(mitRing(setup({ currentGate: "L1" }))).toEqual(["Hypothese"]);

    expect(mitRing(setup({ currentGate: "L2" }))).toEqual([
      "Business Case",
      "Deliverables",
      "Dependencies",
      "KPI & Nutzen",
    ]);
  });

  it("zeigt das Etikett auch an Reitern, die gerade nicht dran sind", () => {
    setup({ currentGate: "L1" });

    // „Betiteln" heisst: immer sichtbar. Sonst wüsste man nur, was jetzt dran
    // ist — nicht, worauf man zusteuert.
    const nav = screen.getByRole("navigation", { name: "Bereiche" });
    expect(nav.textContent).toContain("Hypothese");
    expect([...nav.querySelectorAll("a")].map((a) => a.textContent)).toEqual(
      expect.arrayContaining(["Business CaseL2", "KPI & NutzenL2"]),
    );
  });

  it("ringt niemanden auf einer Stufe ohne Reiter", () => {
    // Beschriftet sind zwei der acht Stufen. Auf L3.1 leuchtet darum nichts —
    // eine Folge der Zuordnung, kein Fehler. Ohne diesen Test wird sie später
    // als Defekt gemeldet.
    expect(mitRing(setup({ currentGate: "L3.1" }))).toEqual([]);
    expect(mitRing(setup({ currentGate: "L0" }))).toEqual([]);
  });

  it("lässt eine Fläche ohne Reifegrad unverändert", () => {
    // Die Zusicherung an die sieben anderen Detailseiten: ohne `gate` weder
    // Ring noch Etikett, und der `title` bleibt der blosse Name.
    const container = setup({
      tabs: [
        { key: "allgemein", label: "Allgemein" },
        { key: "verlauf", label: "Verlauf" },
      ],
      currentGate: "L2",
    });

    expect(container.querySelectorAll("nav span[aria-hidden]")).toHaveLength(0);
    expect(container.querySelector("nav a")?.getAttribute("title")).toBe("Allgemein");
  });

  it("schreibt den Reifegrad in den title, weil das Etikett nur zwei Zeichen hat", () => {
    setup({ currentGate: "L2" });
    expect(screen.getByTitle("Business Case · Reifegrad L2")).toBeInTheDocument();
  });
});
