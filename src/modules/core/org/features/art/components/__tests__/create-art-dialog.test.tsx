import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { CreateArtDialog } from "@/modules/core/org/features/art/components/create-art-dialog";

/**
 * **Der Dialog hatte keinen Test — und bis September 2026 auch nur eine
 * Aufrufstelle** (das globale „+"-Menü). Seit er in der Kopfzeile von
 * `/structure` steht, trägt er sichtbar zwei Zusagen, die vorher nur in einem
 * Kommentar standen.
 */

vi.mock("@/modules/core/org/features/art/actions/art", () => ({
  createArtAction: vi.fn(),
}));
vi.mock("@/features/create/use-create-result", () => ({ useCreateResult: () => {} }));
vi.mock("@/features/create/use-entity-options", () => ({
  useEntityOptions: () => ({ data: [], loading: false, error: null }),
  optionsEndpoint: (kind: string) => `/api/v1/${kind}`,
}));

const VS = [
  { id: "vs-1", name: "Elefanten-Wertstrom 1" },
  { id: "vs-2", name: "Elefant-Scheibe 2" },
];

describe("CreateArtDialog — der Vertrag mit seinen zwei Aufrufstellen", () => {
  it("unkontrolliert bringt er seinen eigenen Auslöser mit", () => {
    // So steht er in der Kopfzeile von `/structure`, wie `CreateValueStreamDialog`
    // daneben — ohne Wrapper.
    render(<CreateArtDialog />);
    expect(screen.getByRole("button", { name: "ART" })).toBeInTheDocument();
  });

  it("kontrolliert nicht — dort öffnet ihn das „+“-Menü", () => {
    render(<CreateArtDialog open={false} onOpenChange={() => {}} />);
    expect(screen.queryByRole("button", { name: "ART" })).toBeNull();
  });
});

describe("CreateArtDialog — das Formular", () => {
  const offen = () => render(<CreateArtDialog open onOpenChange={() => {}} valueStreams={VS} />);

  it("verlangt Wertstrom und Name", () => {
    offen();
    const wertstrom = screen.getByLabelText(/Wertstrom/);
    const name = screen.getByLabelText(/Name/);
    expect(wertstrom).toBeRequired();
    expect(name).toBeRequired();
  });

  it("bietet die übergebenen Wertströme an, ohne nachzuladen", () => {
    offen();
    expect(screen.getByRole("option", { name: "Elefanten-Wertstrom 1" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Elefant-Scheibe 2" })).toBeInTheDocument();
  });

  /**
   * **Die Zusage aus ADR-0014.** Das Beitreten zu einer PI-Zeitleiste ist
   * bewusst **nicht** Teil der ART-Anlage: Zeitleisten gehören zu Drumbeat und
   * werden je ART nachträglich zugewiesen (`Art.timelineId` ist nullable).
   *
   * Ohne diesen Test steht die Regel nur in einem Kommentar — und ein fehlendes
   * Feld sieht aus wie eine Lücke, die jemand schliessen möchte.
   */
  it("hat kein Feld für Zeitleiste oder Kadenz", () => {
    offen();
    // Der Dialog landet per Portal in `document.body`, nicht im `container`
    // von `render` — deshalb über die Rolle suchen.
    const dialog = screen.getByRole("dialog");
    const felder = [...dialog.querySelectorAll("input, select")]
      .map((e) => e.getAttribute("name") ?? "")
      .sort();
    expect(felder).toEqual(["name", "valueStreamId"]);
    expect(screen.queryByLabelText(/Zeitleiste|Kadenz|Timeline/i)).toBeNull();
  });

  it("sagt stattdessen, wo die Kadenz herkommt", () => {
    offen();
    expect(screen.getByText(/PI-Kadenz wird später/)).toBeInTheDocument();
  });

  it("spricht Deutsch — wie die Fläche, auf der er jetzt steht", () => {
    offen();
    expect(screen.getByText("Agile Release Train anlegen")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Abbrechen" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ART anlegen" })).toBeInTheDocument();
  });
});
