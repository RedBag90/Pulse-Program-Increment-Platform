import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SearchSelect } from "@/components/ui/search-select";

/**
 * Diese Auswahl trägt jede Personen-Zuordnung im Produkt — Epic Owner, Feature
 * Owner, Finance-Approver, VMO. Geprüft wird deshalb vor allem, dass eine
 * Auswahl **ankommt**, auch unter der Fokus-Eigenheit, an der sie in Safari
 * gescheitert ist.
 */
const OPTIONS = [
  { value: "u1", label: "anna@pulse.dev", hint: "portfolio_manager" },
  { value: "u2", label: "bruno@pulse.dev", hint: "epic_owner" },
];

function setup(over: Partial<React.ComponentProps<typeof SearchSelect>> = {}) {
  const onChange = vi.fn();
  render(
    <SearchSelect
      value=""
      onChange={onChange}
      options={OPTIONS}
      placeholder="Person wählen …"
      ariaLabel="Person"
      emptyLabel="— Niemand —"
      {...over}
    />,
  );
  return { onChange };
}

describe("SearchSelect", () => {
  it("zeigt den Platzhalter, solange nichts gewählt ist", () => {
    setup();
    expect(screen.getByRole("combobox")).toHaveTextContent("Person wählen …");
  });

  it("zeigt die Beschriftung des gewählten Werts", () => {
    setup({ value: "u2" });
    expect(screen.getByRole("combobox")).toHaveTextContent("bruno@pulse.dev");
  });

  it("meldet die Auswahl beim Klick auf eine Option", async () => {
    const user = userEvent.setup();
    const { onChange } = setup();
    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByRole("option", { name: /bruno/ }));
    expect(onChange).toHaveBeenCalledWith("u2");
  });

  it("verhindert den Fokuswechsel auf die Option — sonst schließt Safari die Liste zu früh", async () => {
    // Der eigentliche Defekt: Safari fokussiert `<button>` beim Klicken nicht.
    // Der Blur des Suchfelds kam mit `relatedTarget === null` an, die Liste
    // schloss, und der Klick landete nie. `preventDefault` auf `mousedown`
    // hält den Fokus im Suchfeld — deshalb muss der Default verhindert sein.
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole("combobox"));
    const option = screen.getByRole("option", { name: /anna/ });
    const prevented = !fireEvent.mouseDown(option);
    expect(prevented).toBe(true);
  });

  it("filtert über Beschriftung und Rollen-Hinweis", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole("combobox"));
    await user.type(screen.getByRole("textbox"), "epic_owner");
    expect(screen.getByRole("option", { name: /bruno/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /anna/ })).not.toBeInTheDocument();
  });

  it("bietet den Leerwert nur bei leerer Suche an", async () => {
    const user = userEvent.setup();
    const { onChange } = setup({ value: "u1" });
    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByRole("option", { name: "— Niemand —" }));
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("wählt per Tastatur aus", async () => {
    const user = userEvent.setup();
    const { onChange } = setup();
    await user.click(screen.getByRole("combobox"));
    await user.keyboard("{ArrowDown}{Enter}");
    expect(onChange).toHaveBeenCalledWith("u1");
  });

  it("schließt bei Escape, ohne etwas zu wählen", async () => {
    const user = userEvent.setup();
    const { onChange } = setup();
    await user.click(screen.getByRole("combobox"));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("schließt, wenn der Fokus die Gruppe wirklich verlässt", async () => {
    const user = userEvent.setup();
    render(
      <>
        <SearchSelect
          value=""
          onChange={vi.fn()}
          options={OPTIONS}
          placeholder="Person wählen …"
          ariaLabel="Person"
        />
        <button type="button">draußen</button>
      </>,
    );
    await user.click(screen.getByRole("combobox"));
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "draußen" }));
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});
