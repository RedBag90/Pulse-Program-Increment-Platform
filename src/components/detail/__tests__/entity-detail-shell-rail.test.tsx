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
  { key: "benefit-hypothesis", label: "Hypothese", gate: "L0" },
  { key: "business-case", label: "Business Case", gate: "L1" },
  { key: "breakdown", label: "Deliverables", gate: "L1" },
  { key: "dependencies", label: "Dependencies", gate: "L1" },
  { key: "kpis", label: "KPI & Nutzen", gate: "L1" },
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
    // Ein Reiter traegt die Stufe, auf der man in ihm arbeitet. Die Hypothese
    // entsteht auf L0, der Business Case auf L1 — L1 bzw. L2 sind die Tore, die
    // sie freigeben.
    expect(mitRing(setup({ currentGate: "L0" }))).toEqual(["Hypothese"]);

    expect(mitRing(setup({ currentGate: "L1" }))).toEqual([
      "Business Case",
      "Deliverables",
      "Dependencies",
      "KPI & Nutzen",
    ]);
  });

  it("zeigt das Etikett auch an Reitern, die gerade nicht dran sind", () => {
    setup({ currentGate: "L0" });

    // „Betiteln" heisst: immer sichtbar. Sonst wüsste man nur, was jetzt dran
    // ist — nicht, worauf man zusteuert.
    const nav = screen.getByRole("navigation", { name: "Bereiche" });
    expect(nav.textContent).toContain("Hypothese");
    expect([...nav.querySelectorAll("a")].map((a) => a.textContent)).toEqual(
      expect.arrayContaining(["Business CaseL1", "KPI & NutzenL1"]),
    );
  });

  it("ringt niemanden auf einer Stufe ohne Reiter", () => {
    // Beschriftet sind die beiden Stufen, auf denen ein Epic Arbeit traegt.
    // Auf L2 wird der Business Case abgenommen, auf L3 Geld zugeteilt — beides
    // geschieht nicht in einem Reiter dieser Seite. Eine Folge der Zuordnung,
    // kein Fehler; ohne diesen Test wird sie später als Defekt gemeldet.
    for (const g of ["L2", "L3", "L4", "L5"]) {
      expect(mitRing(setup({ currentGate: g })), g).toEqual([]);
    }
  });

  it("lässt eine Fläche ohne Reifegrad unverändert", () => {
    // Die Zusicherung an die sieben anderen Detailseiten: ohne `gate` weder
    // Ring noch Etikett, und der `title` bleibt der blosse Name.
    const container = setup({
      tabs: [
        { key: "allgemein", label: "Allgemein" },
        { key: "verlauf", label: "Verlauf" },
      ],
      currentGate: "L1",
    });

    expect(container.querySelectorAll("nav span[aria-hidden]")).toHaveLength(0);
    expect(container.querySelector("nav a")?.getAttribute("title")).toBe("Allgemein");
  });

  it("schreibt den Reifegrad in den title, weil das Etikett nur zwei Zeichen hat", () => {
    setup({ currentGate: "L1" });
    expect(screen.getByTitle("Business Case · Reifegrad L1")).toBeInTheDocument();
  });
});
