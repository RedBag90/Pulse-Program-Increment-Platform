import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { RowEditor, type RtbItem } from "@/modules/budgeting/features/components/rtb/rtb-section";

/**
 * **Was der Nutzer meldete: „das Speichern geht nicht durch".**
 *
 * Es ging durch. Nur wohnt jedes Merkmal für „inaktiv" in der **eingeklappten**
 * Zeile — gedämpft, durchgestrichen, „inaktiv" statt der Jahreszahl —, und die
 * wird beim Bearbeiten durch dieses Formular ersetzt. Wer deaktivierte und
 * speicherte, blieb also auf einer Fläche sitzen, die den Zustand nirgends
 * zeigt, und sah die Wirkung erst nach dem Neuladen.
 *
 * Zwei Zusicherungen dagegen: das Speichern klappt die Zeile zu, und solange
 * sie offen ist, sagt sie, woran sie ist.
 */

vi.mock("@/i18n/navigation", () => ({ Link: () => null }));

const erfolg = vi.fn(async () => ({ success: true }));

vi.mock("@/modules/budgeting/features/actions/rtb", () => ({
  updateRtbItemAction: (..._args: unknown[]) => erfolg(),
  deleteRtbItemAction: (..._args: unknown[]) => erfolg(),
  createRtbItemAction: (..._args: unknown[]) => erfolg(),
}));

const item = (over: Partial<RtbItem> = {}): RtbItem => ({
  id: "rtb-1",
  name: "Lizenzen",
  plannedAmount: 200_000,
  active: true,
  interval: "yearly",
  solutionId: null,
  kind: "run",
  artId: null,
  ...over,
});

function renderEditor(over: Partial<RtbItem> = {}, onClose = vi.fn()) {
  render(
    <RowEditor
      item={item(over)}
      onClose={onClose}
      canManage
      editingId="rtb-1"
      onEdit={() => {}}
      solutions={[{ id: "sol-1", name: "Betrieb" }]}
      showSolution
      solutionName={() => "Betrieb"}
      artName={() => "Zentralfunktionen"}
      zurechnung={() => ""}
      artOfSolution={{}}
      scoped={false}
      arts={[{ id: "art-1", name: "Zentralfunktionen" }]}
      canUseArts
    />,
  );
  return onClose;
}

describe("RowEditor", () => {
  it("klappt die Zeile nach erfolgreichem Speichern zu", async () => {
    const onClose = renderEditor();

    fireEvent.click(screen.getByRole("button", { name: "Speichern" }));

    // Erst danach rendert die eingeklappte Zeile — und nur die trägt
    // Durchstreichung, Dämpfung und „inaktiv".
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("sagt im offenen Editor, dass die Position deaktiviert ist", () => {
    renderEditor({ active: false });

    expect(screen.getByText(/deaktiviert — sie zählt in keine Kachel/)).toBeTruthy();
    // Der Knopf trägt weiterhin seine Handlung, nicht seinen Zustand. Genau
    // deshalb braucht der Zustand eigene Worte.
    expect(screen.getByRole("button", { name: "Aktivieren" })).toBeTruthy();
  });

  it("nennt die Zustands-Knöpfe als das, was sie sind: sofort wirksam", () => {
    renderEditor();

    expect(screen.getByText(/wirken sofort, unabhängig von/)).toBeTruthy();
  });
});
