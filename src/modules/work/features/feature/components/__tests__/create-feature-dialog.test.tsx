import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { CreateFeatureDialog } from "@/modules/work/features/feature/components/create-feature-dialog";
import type * as EntityOptions from "@/features/create/use-entity-options";

type EntityOptionsModule = typeof EntityOptions;

/**
 * Der Dialog hatte **keinen** Test, und in dieser Etappe ändert sich an ihm am
 * meisten: die Kaskade dreht sich um, das Epic wird optional, ein PI kommt
 * dazu. Geprüft wird die Logik, nicht das Aussehen — die Übersetzung bleibt
 * Handprobe.
 */

vi.mock("@/modules/work/features/feature/actions/feature", () => ({
  createFeatureAction: vi.fn(async () => ({})),
}));

// `useCreateResult` hängt am i18n-Router; der ist in jsdom nicht auflösbar und
// für diese Zusicherungen auch ohne Belang — geprüft wird das Formular, nicht
// was nach dem Absenden passiert.
vi.mock("@/features/create/use-create-result", () => ({ useCreateResult: () => {} }));

const ARTS = [
  { id: "art-1", name: "Transport", valueStream: { id: "vs-1" } },
  { id: "art-2", name: "Produktion", valueStream: { id: "vs-2" } },
];
const EPICS = [
  { id: "e-1", title: "Epic im Wertstrom 1", valueStreamId: "vs-1" },
  { id: "e-2", title: "Epic im Wertstrom 2", valueStreamId: "vs-2" },
];
const PIS = [{ id: "pi-1", name: "PI 1" }];
const PEOPLE = [
  { id: "u-1", label: "anna@pulse.dev", roles: ["rte"], isSelf: false },
  { id: "u-2", label: "bo@pulse.dev", roles: [], isSelf: true },
];

// Die Optionslisten kommen sonst über `fetch`; hier werden sie je Endpunkt
// eingesetzt, damit der Test die Kaskade prüft und nicht das Netzwerk.
vi.mock("@/features/create/use-entity-options", async (orig) => {
  const actual = (await orig()) as EntityOptionsModule;
  return {
    ...actual,
    useEntityOptions: (endpoint: string | null) => ({
      data:
        endpoint === null
          ? []
          : endpoint.startsWith("/api/v1/arts")
            ? ARTS
            : endpoint.startsWith("/api/v1/initiatives")
              ? EPICS
              : endpoint.startsWith("/api/v1/pis")
                ? PIS
                : endpoint.startsWith("/api/v1/users")
                  ? PEOPLE
                  : [],
      loading: false,
      error: null,
    }),
  };
});

const epicSelect = () => screen.getByLabelText("Epic") as HTMLSelectElement;
const optionTitles = (el: HTMLSelectElement) => [...el.options].map((o) => o.textContent);

describe("CreateFeatureDialog", () => {
  /**
   * **Die Kernzusicherung.** „Ohne Epic“ ist ein wählbarer Wert, und das Feld
   * ist nicht mehr Pflicht — sonst gäbe es kein eigenständiges Feature.
   */
  it("bietet „ohne Epic“ an und verlangt kein Epic", () => {
    render(
      <CreateFeatureDialog open onOpenChange={() => {}} artId="art-1" artValueStreamId="vs-1" />,
    );
    const sel = epicSelect();
    expect(sel.required).toBe(false);
    expect(optionTitles(sel)).toContain("— ohne Epic —");
    expect(sel.value).toBe("");
  });

  /**
   * Der Befund aus dem Cockpit: dort wurde nur `artId` mitgegeben, die
   * Epic-Liste zeigte deshalb **jedes** Epic des Mandanten. Mit dem Wertstrom
   * des ARTs filtert sie.
   */
  it("filtert die Epics auf den Wertstrom des vorgegebenen ARTs", () => {
    render(
      <CreateFeatureDialog open onOpenChange={() => {}} artId="art-1" artValueStreamId="vs-1" />,
    );
    const titles = optionTitles(epicSelect());
    expect(titles).toContain("Epic im Wertstrom 1");
    expect(titles).not.toContain("Epic im Wertstrom 2");
  });

  /** Ohne vorgegebenes ART führt die ART-Auswahl — und sie ist Pflicht. */
  it("fragt zuerst nach dem ART, wenn die Seite keins vorgibt", () => {
    render(<CreateFeatureDialog open onOpenChange={() => {}} />);
    const art = screen.getByLabelText(/^ART/) as HTMLSelectElement;
    expect(art.required).toBe(true);
    // Solange kein ART steht, ist der Wertstrom unbekannt — dann wird nicht
    // gefiltert, statt eine leere Liste zu zeigen.
    expect(optionTitles(epicSelect())).toContain("Epic im Wertstrom 2");
  });

  /**
   * Wer den Dialog **aus einem Epic heraus** öffnet, pinnt damit den Wertstrom:
   * dort ist das Epic der bekannte Anker. Die ART-Liste filtert sich danach —
   * das Verhalten der drei epic-gebundenen Aufrufstellen bleibt erhalten.
   */
  it("lässt ein vorgegebenes Epic den Wertstrom pinnen", () => {
    render(
      <CreateFeatureDialog
        open
        onOpenChange={() => {}}
        epics={[{ id: "e-2", title: "Epic im Wertstrom 2", valueStreamId: "vs-2" }]}
      />,
    );
    expect(epicSelect().value).toBe("e-2");
    const artTitles = optionTitles(screen.getByLabelText(/^ART/) as HTMLSelectElement);
    expect(artTitles).toContain("Produktion");
    expect(artTitles).not.toContain("Transport");
  });

  /**
   * **Niemand erbt Verantwortung, nur weil er geklickt hat.** Der Anlegende
   * steht vorbelegt im Feld — sichtbar und änderbar, statt still im Service
   * abgeleitet. Der Wert erreicht die FormData über ein verstecktes Feld, weil
   * `SearchSelect` kein natives `<select>` ist.
   */
  it("belegt die Verantwortung mit dem Anlegenden vor", async () => {
    render(
      <CreateFeatureDialog open onOpenChange={() => {}} artId="art-1" artValueStreamId="vs-1" />,
    );
    // Der Dialog rendert in ein Portal — gesucht wird deshalb im ganzen
    // Dokument, nicht im Container des Renderers. Und die Vorbelegung fällt
    // erst, wenn die Kandidatenliste da ist.
    await waitFor(() => {
      const hidden = document.querySelector('input[name="ownerId"]') as HTMLInputElement | null;
      expect(hidden?.value).toBe("u-2");
    });
  });

  /** Das PI kann jetzt gleich beim Anlegen gesetzt werden; leer = Backlog. */
  it("bietet die PIs des ARTs an, mit Backlog als Vorgabe", () => {
    render(
      <CreateFeatureDialog open onOpenChange={() => {}} artId="art-1" artValueStreamId="vs-1" />,
    );
    const pi = screen.getByLabelText("Program Increment") as HTMLSelectElement;
    expect(pi.value).toBe("");
    expect(optionTitles(pi)).toEqual(["— Backlog —", "PI 1"]);
  });
});
