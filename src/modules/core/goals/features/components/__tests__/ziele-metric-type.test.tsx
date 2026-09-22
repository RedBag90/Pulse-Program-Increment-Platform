import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import type { ZieleModel } from "@/modules/core/goals/server/views/ziele-view";

/**
 * **Der Metriktyp „Zahl" ist aus der Auswahl verschwunden — nicht aus den Daten.**
 *
 * Geprüft werden die zwei Seiten dieser Entscheidung: ein **neues** Ziel startet
 * auf Prozent und bekommt „Zahl" gar nicht mehr angeboten; ein **bestehendes**
 * Ziel auf „Zahl" zeigt ihn weiter, damit `required` niemanden zu einer
 * Änderung zwingt, die er nie vornehmen wollte.
 */

let suchparameter = new URLSearchParams();

vi.mock("@/lib/hooks/use-url-state", () => ({
  useUrlState: () => ({ params: new URLSearchParams(), push: vi.fn() }),
}));
vi.mock("@/features/create/use-entity-options", () => ({
  useEntityOptions: () => ({ data: [], loading: false }),
  optionsEndpoint: (kind: string) => `/api/v1/${kind}`,
}));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/ziele",
  redirect: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/ziele",
  useSearchParams: () => suchparameter,
}));

const { ZieleEditDrawer } =
  await import("@/modules/core/goals/features/components/ziele-edit-drawer");

/** Ein Modell mit genau einem Ziel — oder keinem. */
function modell(node?: Record<string, unknown>): ZieleModel {
  return {
    themes: node ? [node] : [],
    periods: [],
    owners: [],
    modules: { portfolio: true, drumbeat: true },
    customFieldDefs: [],
  } as unknown as ZieleModel;
}

const BESTAND = {
  id: "g1",
  depth: 0,
  title: "NPS auf 60",
  // Der Bestand: bis September 2026 der Vorgabewert der Spalte.
  metricType: "number",
  metricUnit: "Punkte",
  baseline: 40,
  target: 60,
  progressMode: "manual",
  children: [],
  // Der Drawer fasst am bestehenden Ziel seine Verknüpfungen zusammen.
  relatedWork: [],
  relatedEpics: [],
  valueStreams: [],
  arts: [],
  customFields: [],
  unitValue: { planned: 0, realized: 0, runRate: 0 },
  precision: 0,
  currencyCode: null,
};

/**
 * Den Metrik-Block eines **bestehenden** Ziels sichtbar machen.
 *
 * Er liegt dort hinter dem Reiter „Einstellungen" — beim Anlegen zeigt der
 * Drawer dasselbe Formular am Stück. Zusätzlich jedes `<details>` öffnen:
 * eingeklappter Inhalt steht zwar im DOM, fällt aber aus dem
 * Accessibility-Baum und wäre über die Rolle nicht zu finden.
 */
function zumMetrikBlock(): void {
  fireEvent.click(screen.getByRole("button", { name: "Einstellungen" }));
  for (const d of document.querySelectorAll("details")) d.open = true;
}

/** Die Beschriftungen des Metriktyp-Auswahlfelds, ohne den Platzhalter. */
function angeboteneTypen(): string[] {
  const feld = screen.getByRole("combobox", { name: /Metriktyp/i });
  return Array.from(feld.querySelectorAll("option"))
    .map((o) => o.textContent?.trim() ?? "")
    .filter((t) => !t.startsWith("—"));
}

describe("Metriktyp am neuen Ziel", () => {
  it("startet auf Prozent und bietet „Zahl“ nicht mehr an", () => {
    suchparameter = new URLSearchParams("entity=goal&new=1");
    render(<ZieleEditDrawer model={modell()} canEdit />);

    const feld = screen.getByRole("combobox", { name: /Metriktyp/i }) as HTMLSelectElement;
    expect(feld.value).toBe("percent");
    expect(angeboteneTypen()).toEqual(["Prozent", "Währung", "Individuell"]);
  });

  it("belegt damit die Enden der Skala vor", () => {
    // 0 und 100 gehören zur Prozentskala. Sie standen vorher nur da, wenn
    // jemand „Prozent" aktiv wählte — jetzt von Anfang an.
    suchparameter = new URLSearchParams("entity=goal&new=1");
    render(<ZieleEditDrawer model={modell()} canEdit />);

    expect((screen.getByRole("spinbutton", { name: /Baseline/i }) as HTMLInputElement).value).toBe(
      "0",
    );
    expect((screen.getByRole("spinbutton", { name: /Target/i }) as HTMLInputElement).value).toBe(
      "100",
    );
  });
});

describe("Metriktyp am bestehenden Ziel", () => {
  it("zeigt „Zahl“ weiter, solange ein Ziel darauf steht", () => {
    suchparameter = new URLSearchParams("entity=goal&id=g1");
    render(<ZieleEditDrawer model={modell(BESTAND)} canEdit />);
    zumMetrikBlock();

    const feld = screen.getByRole("combobox", { name: /Metriktyp/i }) as HTMLSelectElement;
    expect(feld.value).toBe("number");
    // Der abgelegte Typ steht da — als Einzelfall, gekennzeichnet.
    expect(angeboteneTypen()).toEqual([
      "Zahl (nicht mehr wählbar)",
      "Prozent",
      "Währung",
      "Individuell",
    ]);
  });

  it("lässt sein Einheiten-Label weiter pflegen", () => {
    // „Punkte" gehört zu diesem Ziel. Das Feld an „Zahl" abzuschalten hätte es
    // unerreichbar gemacht — eine Änderung an fremden Daten als Nebenwirkung.
    suchparameter = new URLSearchParams("entity=goal&id=g1");
    render(<ZieleEditDrawer model={modell(BESTAND)} canEdit />);
    zumMetrikBlock();

    expect(screen.getByRole("textbox", { name: /Einheit/i })).toBeTruthy();
  });
});
