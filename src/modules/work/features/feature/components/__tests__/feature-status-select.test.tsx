import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FeatureStatusSelect } from "@/modules/work/features/feature/components/feature-status-select";

/**
 * Die Zusicherung dieser Komponente ist die Übergangsprüfung: der Umbau von der
 * Knopfleiste auf ein Dropdown durfte sie nicht verlieren. Geprüft wird deshalb
 * vor allem, *welche* Optionen wählbar sind — nicht das Aussehen.
 */

const setStatus = vi.hoisted(() =>
  vi.fn(async (_state: unknown, _fd: FormData) => ({}) as { error?: string }),
);

vi.mock("@/modules/work/features/feature/actions/feature", () => ({
  setFeatureDeliveryStatusAction: setStatus,
}));

function optionByLabel(label: string): HTMLOptionElement {
  const opt = screen
    .getAllByRole("option")
    .find((o) => o.textContent === label) as HTMLOptionElement | undefined;
  if (!opt) throw new Error(`Option „${label}" fehlt`);
  return opt;
}

describe("FeatureStatusSelect", () => {
  beforeEach(() => setStatus.mockClear());

  it("zeigt alle fünf Zustände — auch die unerreichbaren", () => {
    render(<FeatureStatusSelect featureId="f1" status="approved" label="Antragsstrecke" />);
    expect(screen.getAllByRole("option")).toHaveLength(5);
  });

  it("deaktiviert Zustände ohne Kante, statt sie zu verstecken", () => {
    render(<FeatureStatusSelect featureId="f1" status="approved" label="Antragsstrecke" />);
    // approved → in_progress | cancelled
    expect(optionByLabel("In Umsetzung").disabled).toBe(false);
    expect(optionByLabel("Abgebrochen").disabled).toBe(false);
    expect(optionByLabel("Blockiert").disabled).toBe(true);
    expect(optionByLabel("Abgeschlossen").disabled).toBe(true);
  });

  it("der aktuelle Zustand bleibt wählbar — sonst zeigte das Feld ihn nicht an", () => {
    // `approved → approved` ist keine erlaubte Kante; ohne die Ausnahme wäre die
    // ausgewählte Option deaktiviert.
    render(<FeatureStatusSelect featureId="f1" status="approved" label="Antragsstrecke" />);
    expect(optionByLabel("Freigegeben").disabled).toBe(false);
  });

  it("aus einem Endzustand führt keine Kante heraus", () => {
    render(<FeatureStatusSelect featureId="f1" status="completed" label="Antragsstrecke" />);
    expect(optionByLabel("Abgeschlossen").disabled).toBe(false);
    for (const l of ["Freigegeben", "In Umsetzung", "Blockiert", "Abgebrochen"]) {
      expect(optionByLabel(l).disabled).toBe(true);
    }
  });

  it("schickt Feature-ID und Zielzustand an die Action", async () => {
    render(<FeatureStatusSelect featureId="f1" status="approved" label="Antragsstrecke" />);
    await userEvent.selectOptions(screen.getByRole("combobox"), "in_progress");
    expect(setStatus).toHaveBeenCalledTimes(1);
    const fd = setStatus.mock.calls[0]![1];
    expect(fd.get("id")).toBe("f1");
    expect(fd.get("to")).toBe("in_progress");
  });

  it("ausserhalb der Liefer-FSM steht nur Text — kein Feld mit falschem Wert", () => {
    // Ohne diese Weiche zeigte das `<select>` fuer `draft` stumm die erste
    // Option („Freigegeben"), weil keine Option zum Wert passt.
    render(<FeatureStatusSelect featureId="f1" status="draft" label="Antragsstrecke" />);
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByText("Entwurf")).toBeInTheDocument();
  });

  it("ohne Recht ist das Feld gesperrt", () => {
    render(<FeatureStatusSelect featureId="f1" status="approved" label="Antragsstrecke" disabled />);
    expect(screen.getByRole("combobox")).toBeDisabled();
  });
});
