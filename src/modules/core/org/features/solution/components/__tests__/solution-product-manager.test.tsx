import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SolutionProductManager } from "@/modules/core/org/features/solution/components/solution-product-manager";

/**
 * **Ein Platz, ein Klick, sofort gespeichert** — dieselbe Bedienung wie in der
 * Rollenverteilung (`structure/rollen`, `role-slot.tsx`) und am Epic Owner.
 *
 * Vorher stand der Picker hier **dauerhaft offen**, und ein gelungener
 * Speichervorgang wurde mit nichts quittiert. Action, Feld, Personenliste und
 * Leerwert waren schon damals dieselben wie am Solution-Platz der
 * Rollenverteilung — verschieden war allein die Geste.
 */

const update = vi.hoisted(() =>
  vi.fn(async (_state: unknown, _fd: FormData) => ({}) as { error?: string; success?: boolean }),
);

vi.mock("@/modules/core/org/features/solution/actions/solution", () => ({
  updateSolutionAction: update,
}));

const USERS = [
  { userId: "u1", roles: ["portfolio_manager"] },
  { userId: "u2", roles: [] as string[] },
];
const LABELS = { u1: "anna@pulse.dev", u2: "bo@pulse.dev" };

function shell(over: { productManagerId?: string | null; canManage?: boolean } = {}) {
  return render(
    <SolutionProductManager
      solutionId="s1"
      productManagerId={over.productManagerId ?? null}
      users={USERS}
      userLabels={LABELS}
      canManage={over.canManage ?? true}
    />,
  );
}

/** Das zuletzt gesendete Feld — `null`, wenn nichts gesendet wurde. */
const gesendet = (feld: string): string | null => {
  const call = update.mock.calls.at(-1);
  return call ? ((call[1].get(feld) as string | null) ?? null) : null;
};

beforeEach(() => {
  update.mockClear();
});

describe("SolutionProductManager", () => {
  it("zeigt im Ruhezustand keinen Picker, sondern den Namen als Knopf", () => {
    shell({ productManagerId: "u1" });

    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Produkt-Manager: anna@pulse\.dev\. Ändern/ }),
    ).toBeInTheDocument();
  });

  it("lädt zum Benennen ein, wenn niemand benannt ist", () => {
    shell();
    expect(screen.getByRole("button", { name: "Produkt-Manager benennen" })).toBeInTheDocument();
    expect(screen.getByText("Benennen")).toBeInTheDocument();
  });

  it("speichert die Auswahl sofort und schliesst danach", async () => {
    // Kein zweiter Knopf, kein Formular: ein Klick auf die Person genügt.
    const user = userEvent.setup();
    shell();

    await user.click(screen.getByRole("button", { name: "Produkt-Manager benennen" }));
    // Der Picker ist da — seine Liste öffnet erst der Klick auf den Auslöser.
    await user.click(screen.getByRole("combobox", { name: "Produkt-Manager" }));
    await user.click(screen.getByRole("option", { name: /anna@pulse\.dev/ }));

    expect(update).toHaveBeenCalledOnce();
    expect(gesendet("id")).toBe("s1");
    expect(gesendet("productManagerId")).toBe("u1");
    // Danach ist der Picker wieder zu.
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("lässt die Benennung wieder entfernen", async () => {
    // „— Niemand —" sendet den Leerstring; `nullableString` macht daraus `null`.
    const user = userEvent.setup();
    shell({ productManagerId: "u1" });

    await user.click(screen.getByRole("button", { name: /Ändern/ }));
    await user.click(screen.getByRole("combobox", { name: "Produkt-Manager" }));
    await user.click(screen.getByRole("option", { name: /Niemand/ }));

    expect(gesendet("productManagerId")).toBe("");
  });

  it("lässt sich abbrechen, ohne zu speichern", async () => {
    const user = userEvent.setup();
    shell({ productManagerId: "u1" });

    await user.click(screen.getByRole("button", { name: /Ändern/ }));
    await user.click(screen.getByRole("button", { name: "Abbrechen" }));

    expect(update).not.toHaveBeenCalled();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("zeigt ohne Recht die Bernstein-Pille und nichts zum Anklicken", () => {
    // Die Pille sagt „hier fehlt jemand", ohne zu blockieren — sie bleibt, denn
    // die Rollenverteilung kennt sie nicht und könnte sie nicht ersetzen.
    shell({ canManage: false });

    expect(screen.getByText("Nicht zugewiesen")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("nennt ohne Recht den benannten Namen schlicht als Text", () => {
    shell({ productManagerId: "u2", canManage: false });

    expect(screen.getByText("bo@pulse.dev")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
