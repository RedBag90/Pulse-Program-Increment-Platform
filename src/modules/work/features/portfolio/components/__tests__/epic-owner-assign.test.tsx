import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EpicOwnerAssign } from "@/modules/work/features/portfolio/components/epic-owner-assign";

/**
 * **Ein Platz, ein Klick, sofort gespeichert** — dieselbe Bedienung wie in der
 * Rollenverteilung (`structure/rollen`, `role-slot.tsx`).
 *
 * Vorher standen hier Picker und ein „Owner zuweisen"-Knopf dauerhaft
 * untereinander: drei Bedienelemente für eine Angabe, und der Knopf war
 * meistens ausgegraut, weil die Auswahl schon stimmte. Und ein einmal gesetzter
 * Owner liess sich **gar nicht** mehr entfernen — der Knopf blieb bei leerer
 * Auswahl aus, die Action verlangte eine UUID.
 */

const assign = vi.hoisted(() =>
  vi.fn(async (_state: unknown, _fd: FormData) => ({}) as { error?: string; success?: boolean }),
);

vi.mock("@/modules/work/features/portfolio/actions/timeline", () => ({
  assignEpicOwnerAction: assign,
}));

const APPROVERS = [
  { userId: "u1", roles: ["portfolio_manager"] },
  { userId: "u2", roles: [] as string[] },
];
const LABELS = { u1: "anna@pulse.dev", u2: "bo@pulse.dev" };

function setup(over: Partial<Parameters<typeof EpicOwnerAssign>[0]> = {}) {
  return render(
    <EpicOwnerAssign
      epicId="11111111-1111-4111-8111-111111111111"
      ownerId="u1"
      canAssignOwner
      approvers={APPROVERS}
      userLabels={LABELS}
      {...over}
    />,
  );
}

/** Was die Action als `ownerId` geschickt hat. */
const gesendet = () => (assign.mock.calls.at(-1)?.[1] as FormData).get("ownerId");

beforeEach(() => assign.mockClear());

describe("EpicOwnerAssign", () => {
  it("zeigt den Owner als Knopf und öffnet erst auf Klick die Auswahl", async () => {
    setup();

    // Kein Picker im Ruhezustand — das ist der Unterschied zu vorher.
    expect(screen.queryByRole("combobox")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /anna@pulse.dev/ }));
    expect(screen.getByRole("combobox", { name: "Epic Owner" })).toBeInTheDocument();
  });

  it("speichert die Auswahl sofort, ohne zweiten Knopf", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: /anna@pulse.dev/ }));
    await userEvent.click(screen.getByRole("combobox", { name: "Epic Owner" }));
    await userEvent.click(screen.getByRole("option", { name: /bo@pulse\.dev/ }));

    expect(assign).toHaveBeenCalledTimes(1);
    expect(gesendet()).toBe("u2");
    // Und die Auswahl schliesst sich wieder.
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("entfernt die Benennung über den Leer-Eintrag", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: /anna@pulse.dev/ }));
    await userEvent.click(screen.getByRole("combobox", { name: "Epic Owner" }));
    await userEvent.click(screen.getByRole("option", { name: /Niemand/ }));

    // Der leere String ist „niemand" — die Action übersetzt ihn nach `null`.
    // Vorher gab es diesen Eintrag gar nicht.
    expect(gesendet()).toBe("");
  });

  it("lädt ohne Owner zum Benennen ein", () => {
    setup({ ownerId: null });
    expect(screen.getByRole("button", { name: "Epic Owner benennen" })).toBeInTheDocument();
    expect(screen.getByText("Benennen")).toBeInTheDocument();
  });

  it("bleibt ohne Recht reine Anzeige", () => {
    setup({ canAssignOwner: false, ownerId: null });

    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("Nicht zugewiesen")).toBeInTheDocument();
  });
});
