import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within, waitFor } from "@testing-library/react";

const unlink = vi.fn(async (_a: unknown, _args: unknown) => ({}));
const changeType = vi.fn(async (_a: unknown, _args: unknown) => ({}));
vi.mock("@/modules/drumbeat/features/dependencies/actions/dependency", () => ({
  linkDependencyAction: async () => ({}),
  unlinkDependencyAction: async () => ({}),
  changeDependencyTypeAction: async () => ({}),
  relinkDependencyAction: async () => ({}),
}));
vi.mock("@/modules/drumbeat/features/dependencies/lib/dependency-actions-client", () => ({
  linkDependency: async () => ({}),
  relinkDependency: async () => ({}),
  unlinkDependency: (a: unknown, args: unknown) => unlink(a, args),
  changeDependencyType: (a: unknown, args: unknown) => changeType(a, args),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("@/modules/drumbeat/features/dependencies/components/link-dependency-dialog", () => ({
  LinkDependencyDialog: () => null,
}));

import { FeatureDependenciesTab } from "@/modules/drumbeat/features/cockpit/components/feature-dependencies-tab";

/**
 * **Abhängigkeiten im Feature-Detail** — Typ wechseln und entfernen, auch
 * für eingehende Kanten; dort prüft das Recht das ART der Quelle.
 */
beforeEach(() => {
  unlink.mockClear();
  changeType.mockClear();
});

const tab = (canEdit: boolean) =>
  render(
    <FeatureDependenciesTab
      featureId="f"
      artId="art-f"
      outgoing={[
        { id: "o1", type: "blocks", other: { id: "x", title: "Ausgehend X", artId: "art-f" } },
      ]}
      incoming={[
        { id: "i1", type: "relates_to", other: { id: "y", title: "Eingehend Y", artId: "art-y" } },
      ]}
      candidates={[]}
      canEdit={canEdit}
    />,
  );

describe("FeatureDependenciesTab", () => {
  it("eingehende Kante: Entfernen mit dem ART der Quelle", async () => {
    tab(true);
    const zeile = screen.getByText("Eingehend Y").closest("li")!;
    fireEvent.click(within(zeile).getByRole("button", { name: "Entfernen" }));
    await waitFor(() =>
      expect(unlink).toHaveBeenCalledWith(expect.anything(), {
        fromId: "y",
        toId: "f",
        type: "relates_to",
        artId: "art-y",
      }),
    );
  });

  it("ausgehende Kante: Typ wechseln", async () => {
    tab(true);
    const zeile = screen.getByText("Ausgehend X").closest("li")!;
    fireEvent.change(within(zeile).getByRole("combobox"), { target: { value: "relates_to" } });
    await waitFor(() =>
      expect(changeType).toHaveBeenCalledWith(expect.anything(), {
        fromId: "f",
        toId: "x",
        fromType: "blocks",
        toType: "relates_to",
        artId: "art-f",
      }),
    );
  });

  it("ohne Recht keine Bedienung", () => {
    tab(false);
    expect(screen.queryByRole("button", { name: "Entfernen" })).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();
  });
});
