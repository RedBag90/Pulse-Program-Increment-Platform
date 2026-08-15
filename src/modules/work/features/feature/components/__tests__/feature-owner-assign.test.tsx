import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FeatureOwnerAssign } from "@/modules/work/features/feature/components/feature-owner-assign";

/**
 * Drei Zusicherungen: ohne Capability bleibt die Kachel reine Anzeige, die
 * Auswahl ist durchsuchbar (die Kandidatenliste wird in echten Mandanten lang),
 * und der Leerwert lässt sich tatsächlich abschicken. Letzteres ist der bewusste
 * Unterschied zu `EpicOwnerAssign`, wo ein einmal gesetzter Owner nicht mehr zu
 * entfernen ist — ohne Test würde die Abweichung beim nächsten Angleichen an das
 * Vorbild still verschwinden.
 */

const assign = vi.hoisted(() =>
  vi.fn(async (_state: unknown, _fd: FormData) => ({}) as { error?: string }),
);

vi.mock("@/modules/work/features/feature/actions/feature", () => ({
  assignFeatureOwnerAction: assign,
}));

const APPROVERS = [
  { userId: "u1", roles: ["feature_owner"] },
  { userId: "u2", roles: [] as string[] },
  { userId: "u3", roles: ["rte"] },
];
const LABELS = { u1: "anna@pulse.dev", u2: "bo@pulse.dev", u3: "cem@pulse.dev" };

function setup(over: Partial<Parameters<typeof FeatureOwnerAssign>[0]> = {}) {
  return render(
    <FeatureOwnerAssign
      featureId="f1"
      artId="a1"
      ownerId="u1"
      canAssignOwner
      approvers={APPROVERS}
      userLabels={LABELS}
      {...over}
    />,
  );
}

async function openPicker() {
  await userEvent.click(screen.getByRole("combobox", { name: "Feature-Owner" }));
}

describe("FeatureOwnerAssign", () => {
  beforeEach(() => assign.mockClear());

  it("ohne Capability nur Text, keine Auswahl", () => {
    setup({ canAssignOwner: false });
    expect(screen.getByText("anna@pulse.dev")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("ohne Owner steht dort der Platzhalter", () => {
    setup({ ownerId: null, canAssignOwner: false });
    expect(screen.getByText("Nicht zugewiesen")).toBeInTheDocument();
  });

  it("die Liste öffnet erst auf Klick", async () => {
    setup();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    await openPicker();
    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });

  it("die Suche schränkt die Kandidaten ein", async () => {
    setup();
    await openPicker();
    expect(screen.getAllByRole("option")).toHaveLength(4); // 3 Personen + Leerwert
    await userEvent.type(screen.getByRole("textbox"), "cem");
    const hits = screen.getAllByRole("option");
    expect(hits).toHaveLength(1);
    expect(hits[0]).toHaveTextContent("cem@pulse.dev");
  });

  it("auch die Rolle ist durchsuchbar", async () => {
    setup();
    await openPicker();
    await userEvent.type(screen.getByRole("textbox"), "rte");
    const hits = screen.getAllByRole("option");
    expect(hits).toHaveLength(1);
    expect(hits[0]).toHaveTextContent("cem@pulse.dev");
  });

  it("ohne Treffer steht das auch da", async () => {
    setup();
    await openPicker();
    await userEvent.type(screen.getByRole("textbox"), "zzz");
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(screen.getByText("Keine Treffer.")).toBeInTheDocument();
  });

  it("eine Person auswählen schickt deren ID sofort ab", async () => {
    setup();
    await openPicker();
    await userEvent.click(screen.getByRole("option", { name: /bo@pulse\.dev/ }));
    expect(assign).toHaveBeenCalledTimes(1);
    const fd = assign.mock.calls[0]![1];
    expect(fd.get("id")).toBe("f1");
    expect(fd.get("artId")).toBe("a1");
    expect(fd.get("ownerId")).toBe("u2");
  });

  it("der Leerwert ist abschickbar und entfernt den Owner", async () => {
    setup();
    await openPicker();
    await userEvent.click(screen.getByRole("option", { name: /kein Owner/ }));
    expect(assign.mock.calls[0]![1].get("ownerId")).toBe("");
    expect(await screen.findByText("Nicht zugewiesen")).toBeInTheDocument();
  });

  it("die Tastatur reicht: tippen, auswählen, Enter", async () => {
    setup();
    await openPicker();
    await userEvent.type(screen.getByRole("textbox"), "bo");
    await userEvent.keyboard("{Enter}");
    expect(assign.mock.calls[0]![1].get("ownerId")).toBe("u2");
  });

  it("scheitert der Server, springt die Anzeige zurück", async () => {
    assign.mockResolvedValueOnce({ error: "Keine Berechtigung." });
    setup();
    await openPicker();
    await userEvent.click(screen.getByRole("option", { name: /bo@pulse\.dev/ }));

    expect(await screen.findByText("Keine Berechtigung.")).toBeInTheDocument();
    // …und nicht der Owner, den der Server nie übernommen hat.
    expect(screen.getByRole("combobox", { name: "Feature-Owner" })).toHaveTextContent(
      "anna@pulse.dev",
    );
  });
});
