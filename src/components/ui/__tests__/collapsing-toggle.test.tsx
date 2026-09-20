import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CollapsingToggle } from "@/components/ui/collapsing-toggle";

/**
 * Der Schalter zeigt zugeklappt **nur den aktiven Wert**. Geprüft wird deshalb
 * vor allem, was zugeklappt erreichbar ist — und dass die Wahl der bereits
 * aktiven Option ankommt: darauf sitzt im Beitrags-Block die Richtungsumkehr
 * der Sortierung.
 */
const OPTIONS = [
  { id: "planned", label: "Plan ↓", srLabel: "Plan, absteigend" },
  { id: "realized", label: "Ist" },
  { id: "deviation", label: "Abweichung" },
] as const;

function setup() {
  const onSelect = vi.fn();
  render(
    <CollapsingToggle
      value="planned"
      options={OPTIONS}
      onSelect={onSelect}
      label="Sortiert nach"
    />,
  );
  return { onSelect, user: userEvent.setup() };
}

/** `inert` nimmt die zugeklappten Optionen aus dem Zugänglichkeitsbaum. */
const sichtbar = () => screen.getAllByRole("button").map((b) => b.textContent);

describe("CollapsingToggle", () => {
  it("zeigt zugeklappt genau eine Schaltfläche und nennt darin den aktiven Wert", () => {
    setup();
    expect(sichtbar()).toEqual(["Plan ↓"]);
    expect(
      screen.getByRole("button", { name: "Sortiert nach: Plan, absteigend — ändern" }),
    ).toBeTruthy();
  });

  it("zeigt beim Antippen alle Optionen", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button"));
    expect(sichtbar()).toEqual(["Plan ↓", "Ist", "Abweichung"]);
  });

  it("meldet die Wahl und klappt wieder zu", async () => {
    const { onSelect, user } = setup();
    await user.click(screen.getByRole("button"));
    await user.click(screen.getByRole("button", { name: "Abweichung" }));
    expect(onSelect).toHaveBeenCalledWith("deviation");
    expect(sichtbar()).toEqual(["Plan ↓"]);
  });

  /** Ohne diese Meldung liesse sich die Sortierrichtung nicht mehr drehen. */
  it("meldet auch die bereits aktive Option", async () => {
    const { onSelect, user } = setup();
    await user.click(screen.getByRole("button"));
    await user.click(screen.getByRole("button", { name: "Plan ↓" }));
    expect(onSelect).toHaveBeenCalledWith("planned");
    expect(sichtbar()).toEqual(["Plan ↓"]);
  });

  it("klappt bei Escape zu, ohne etwas zu melden", async () => {
    const { onSelect, user } = setup();
    await user.click(screen.getByRole("button"));
    await user.keyboard("{Escape}");
    expect(sichtbar()).toEqual(["Plan ↓"]);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("klappt bei einem Klick daneben zu", async () => {
    const { onSelect, user } = setup();
    await user.click(screen.getByRole("button"));
    await user.click(document.body);
    expect(sichtbar()).toEqual(["Plan ↓"]);
    expect(onSelect).not.toHaveBeenCalled();
  });
});
