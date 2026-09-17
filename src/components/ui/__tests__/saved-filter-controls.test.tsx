import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { SavedFilterControls } from "@/components/ui/saved-filter-controls";
import type { SavedFilterDTO } from "@/server/services/saved-filter";

/**
 * **Die Bedienung gespeicherter Filter hatte bis hierher keinen einzigen Test.**
 *
 * Sie stand als Inline-JSX in der Portfolio-Filterleiste; beim Herausloesen fuer
 * die Ziele-Flaeche haette ein Fehler an zwei Stellen zugleich gewirkt. Deshalb
 * diese Zusicherungen — sie beschreiben, was beide Leisten von dem Bauteil
 * erwarten.
 */

const noop = vi.fn(async () => ({}));

const filter = (over: Partial<SavedFilterDTO> = {}): SavedFilterDTO => ({
  id: "f1",
  name: "Q4-Sicht",
  criteria: { period: ["2026-Q4"], vs: [], art: [], status: [] },
  isDefault: false,
  ...over,
});

const setup = (props: Partial<React.ComponentProps<typeof SavedFilterControls>> = {}) =>
  render(
    <SavedFilterControls
      filters={[filter()]}
      criteria={{ period: ["2026-Q4"] }}
      anyActive
      onApply={vi.fn()}
      saveAction={noop}
      deleteAction={noop}
      {...props}
    />,
  );

describe("SavedFilterControls", () => {
  /** Ohne gesetzte Facette gaebe es nichts zu speichern — der Knopf entfaellt. */
  it("zeigt Speichern nur bei aktiver Facette", () => {
    setup({ anyActive: false });
    expect(screen.queryByText("Speichern")).toBeNull();
    // Die Chips bleiben trotzdem sichtbar. Der Name steht **zweimal** in der
    // Fläche — als Eintrag der Auswahlliste und als Chip —, deshalb die Suche
    // über die Rolle.
    expect(screen.getByRole("button", { name: "Q4-Sicht" })).toBeTruthy();
  });

  it("zeigt Speichern, sobald eine Facette gesetzt ist", () => {
    setup();
    expect(screen.getByText("Speichern")).toBeTruthy();
  });

  /** Der Chip ist der kurze Weg: ein Klick reicht die Nutzlast nach oben. */
  it("reicht beim Klick auf einen Chip dessen Kriterien an die Flaeche", () => {
    const onApply = vi.fn();
    setup({ onApply });
    fireEvent.click(screen.getByRole("button", { name: "Q4-Sicht" }));
    expect(onApply).toHaveBeenCalledWith({
      period: ["2026-Q4"],
      vs: [],
      art: [],
      status: [],
    });
  });

  it("markiert den Standard in der Auswahlliste mit einem Stern", () => {
    setup({ filters: [filter({ isDefault: true })] });
    const option = screen.getByRole("option", { name: /Q4-Sicht/ });
    expect(option.textContent).toContain("★");
  });

  /** Ohne gespeicherte Filter gibt es weder Liste noch Chips. */
  it("blendet Liste und Chips aus, solange nichts gespeichert ist", () => {
    setup({ filters: [] });
    expect(screen.queryByLabelText("Gespeicherten Filter anwenden")).toBeNull();
    expect(screen.queryByRole("button", { name: "Q4-Sicht" })).toBeNull();
    // Speichern bleibt — das ist der Weg zum ersten Filter.
    expect(screen.getByText("Speichern")).toBeTruthy();
  });

  it("oeffnet das Benennen-Formular erst auf Klick", () => {
    setup();
    expect(screen.queryByPlaceholderText("Filter-Name")).toBeNull();
    fireEvent.click(screen.getByText("Speichern"));
    expect(screen.getByPlaceholderText("Filter-Name")).toBeTruthy();
    // Und der Knopf verschwindet, solange das Formular offen ist.
    expect(screen.queryByText("Speichern")).toBeNull();
  });
});
