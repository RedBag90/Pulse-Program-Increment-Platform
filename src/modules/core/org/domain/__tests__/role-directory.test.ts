import { describe, it, expect } from "vitest";
import {
  allEntries,
  allSolutions,
  buildRoleDirectory,
  unfilledCount,
  directoryStats,
  filterDirectory,
  type DirectoryTreeVs,
} from "@/modules/core/org/domain/role-directory";

const LABELS: Record<string, string> = {
  "u-fin": "anna@x.dev",
  "u-vmo": "bernd@x.dev",
  "u-bo": "clara@x.dev",
  "u-rte": "dirk@x.dev",
  "u-pm": "erika@x.dev",
};
const labelOf = (id: string) => LABELS[id] ?? `${id.slice(0, 8)}…`;

const vs = (over: Partial<DirectoryTreeVs> = {}): DirectoryTreeVs => ({
  id: "vs-1",
  name: "Logistik",
  financeApproverId: "u-fin",
  vmoId: "u-vmo",
  businessOwnerId: "u-bo",
  architectLeadId: null,
  arts: [{ id: "art-1", name: "Transport", rteId: "u-rte", technicalLeadId: null }],
  solutions: [
    {
      id: "sol-1",
      name: "Betrieb",
      artId: "art-1",
      horizon: "h1",
      investmentMode: null,
      productManagerId: "u-pm",
    },
  ],
  ...over,
});

describe("buildRoleDirectory", () => {
  it("führt die Zuständigkeit, nicht den Feldnamen", () => {
    const [d] = buildRoleDirectory([vs()], labelOf);
    expect(d?.entries.map((e) => [e.duty, e.role, e.label])).toEqual([
      ["Geld, Budget, Zuteilung", "Finance Approver", "anna@x.dev"],
      ["Reifegrade, Portfolio-Steuerung", "Portfolio Manager", "bernd@x.dev"],
      ["Fachlicher Nutzen, Priorität", "Business Owner", "clara@x.dev"],
      ["Architektur, Machbarkeit", "Value Stream Architect Lead", null],
    ]);
  });

  /**
   * Der entscheidende Punkt: eine unbesetzte Zuständigkeit **verschwindet
   * nicht**. „An niemanden" ist eine Antwort, und wer sie nicht sieht, sucht
   * weiter.
   */
  it("behält unbesetzte Zeilen, statt sie wegzulassen", () => {
    const [d] = buildRoleDirectory([vs({ architectLeadId: null })], labelOf);
    const arch = d?.entries.find((e) => e.key === "vs.architecture");
    expect(arch).toBeDefined();
    expect(arch?.userId).toBeNull();
    expect(arch?.label).toBeNull();
  });

  it("zählt die unbesetzten Zuständigkeiten über alle Ebenen", () => {
    // Architect Lead + Technical Lead = 2.
    const [d] = buildRoleDirectory([vs()], labelOf);
    expect(unfilledCount(d!)).toBe(2);
  });

  /**
   * **Die Solution steht unter ihrem ART, nicht daneben.** Bis September 2026
   * war `groups` eine flache Liste — erst alle ARTs, dann alle Solutions —, und
   * eine Solution wusste nicht, zu wem sie gehört. Für Spalten mit Kacheln
   * darin ist genau das die Auskunft.
   */
  it("hängt die Solution unter ihren ART", () => {
    const [d] = buildRoleDirectory([vs()], labelOf);
    expect(d?.arts.map((a) => a.name)).toEqual(["Transport"]);
    expect(d?.arts[0]?.entries.map((e) => e.role)).toEqual(["RTE", "ART Technical Lead"]);
    expect(d?.arts[0]?.solutions.map((so) => so.name)).toEqual(["Betrieb"]);
    expect(d?.arts[0]?.solutions[0]?.entries.map((e) => e.role)).toEqual(["Produkt-Manager"]);
    expect(d?.looseSolutions).toEqual([]);
  });

  /**
   * `artId` ist Pflicht — aber ein **weich gelöschtes** ART fällt aus `vs.arts`
   * heraus. Seine Solutions zeigten dann auf eine Spalte, die niemand rendert,
   * und wären aus der Fläche verschwunden. Sie hängen deshalb am Wertstrom.
   */
  it("hängt eine Solution an den Wertstrom, wenn ihr ART nicht zu sehen ist", () => {
    const [d] = buildRoleDirectory(
      [
        vs({
          solutions: [
            {
              id: "sol-1",
              name: "Betrieb",
              artId: "art-1",
              horizon: "h1",
              investmentMode: null,
              productManagerId: "u-pm",
            },
            {
              id: "sol-2",
              name: "Pilot",
              artId: "art-weg",
              horizon: "h1",
              investmentMode: null,
              productManagerId: null,
            },
          ],
        }),
      ],
      labelOf,
    );
    expect(d?.arts[0]?.solutions.map((so) => so.name)).toEqual(["Betrieb"]);
    expect(d?.looseSolutions.map((so) => so.name)).toEqual(["Pilot"]);
    expect(allSolutions(d!).map((so) => so.name)).toEqual(["Betrieb", "Pilot"]);
    // Der lose Platz zählt trotzdem mit — sonst verschwände er aus der Bilanz.
    expect(allEntries(d!).filter((e) => e.key === "solution.product")).toHaveLength(2);
  });

  /**
   * Das „wofür" kommt aus der Gate-Policy dieses Wertstroms, nicht aus einem
   * abgeschriebenen Satz — deshalb wird es hereingereicht und nicht hier
   * erfunden. Core darf die Policy nicht importieren (ADR-0013).
   */
  it("übernimmt die Tore aus der hereingereichten Karte", () => {
    const [d] = buildRoleDirectory([vs()], labelOf, {
      "vs-1": { "vs.finance": ["L3", "L5"], "vs.portfolio": ["L1", "L2"] },
    });
    expect(d?.entries.find((e) => e.key === "vs.finance")?.gates).toEqual(["L3", "L5"]);
    expect(d?.entries.find((e) => e.key === "vs.portfolio")?.gates).toEqual(["L1", "L2"]);
    // Ohne Eintrag bleibt die Liste leer statt undefined — die Fläche muss
    // nicht prüfen.
    expect(d?.entries.find((e) => e.key === "vs.business")?.gates).toEqual([]);
  });

  it("gibt die Tore je Wertstrom getrennt aus", () => {
    const zwei = [vs(), vs({ id: "vs-2", name: "Produktion" })];
    const out = buildRoleDirectory(zwei, labelOf, { "vs-1": { "vs.finance": ["L5"] } });
    expect(out[0]?.entries.find((e) => e.key === "vs.finance")?.gates).toEqual(["L5"]);
    expect(out[1]?.entries.find((e) => e.key === "vs.finance")?.gates).toEqual([]);
  });

  it("fällt auf eine gekürzte Id zurück, wenn kein Name bekannt ist", () => {
    const [d] = buildRoleDirectory([vs({ financeApproverId: "u-unbekannt-lang" })], labelOf);
    expect(d?.entries[0]?.label).toBe("u-unbeka…");
  });

  it("kommt mit einem Wertstrom ohne ARTs und Solutions zurecht", () => {
    const [d] = buildRoleDirectory([vs({ arts: [], solutions: [] })], labelOf);
    expect(d?.arts).toEqual([]);
    expect(d?.looseSolutions).toEqual([]);
    expect(d?.entries).toHaveLength(4);
  });

  /**
   * Die Zieladresse ist die einzige Angabe, deren Fehler **stumm** bleibt: der
   * Name landete im falschen Feld, die Fläche zeigte ihn trotzdem am richtigen
   * Platz — bis jemand den Wertstrom öffnet. Deshalb steht sie hier namentlich.
   */
  it("sagt je Platz, welches Objekt und welches Feld er schreibt", () => {
    const [d] = buildRoleDirectory([vs()], labelOf);
    expect(d?.entries.map((e) => [e.key, e.target.kind, e.target.field])).toEqual([
      ["vs.finance", "valueStream", "financeApproverId"],
      ["vs.portfolio", "valueStream", "vmoId"],
      ["vs.business", "valueStream", "businessOwnerId"],
      ["vs.architecture", "valueStream", "architectLeadId"],
    ]);
    expect(d?.entries.every((e) => e.target.id === "vs-1")).toBe(true);
  });

  it("zeigt bei ART und Solution auf deren eigene Id, nicht auf den Wertstrom", () => {
    const [d] = buildRoleDirectory([vs()], labelOf);
    const art = d?.arts[0];
    const sol = art?.solutions[0];
    expect(art?.entries.map((e) => [e.target.kind, e.target.id, e.target.field])).toEqual([
      ["art", "art-1", "rteId"],
      ["art", "art-1", "technicalLeadId"],
    ]);
    expect(sol?.entries.map((e) => [e.target.kind, e.target.id, e.target.field])).toEqual([
      ["solution", "sol-1", "productManagerId"],
    ]);
  });
});

describe("directoryStats", () => {
  /**
   * **Köpfe, nicht Posten.** Genau die Zahl, die man beim Draufschreiben falsch
   * macht — und die falsche wäre die beruhigende: sie zählte jede Benennung
   * einzeln und verbärge, dass eine Handvoll Menschen das ganze Portfolio trägt.
   */
  it("zählt eine Person mit drei Posten als eine Person", () => {
    const alle = buildRoleDirectory(
      [
        vs({
          financeApproverId: "u-1",
          vmoId: "u-1",
          businessOwnerId: "u-1",
          architectLeadId: null,
          arts: [],
          solutions: [],
        }),
      ],
      labelOf,
    );
    expect(directoryStats(alle)).toEqual({ people: 1, unfilled: 1, streams: 1 });
  });

  it("zählt über Wertströme hinweg, ohne doppelt zu zählen", () => {
    const zwei = buildRoleDirectory(
      [
        vs({ arts: [], solutions: [] }),
        vs({ id: "vs-2", name: "Produktion", arts: [], solutions: [] }),
      ],
      labelOf,
    );
    // Je Wertstrom dieselben drei Personen, einmal offen (Architect Lead).
    expect(directoryStats(zwei)).toEqual({ people: 3, unfilled: 2, streams: 2 });
  });

  it("zählt auch die Plätze an ART und Solution mit", () => {
    const [d] = buildRoleDirectory([vs()], labelOf);
    expect(directoryStats([d!])).toEqual({ people: 5, unfilled: 2, streams: 1 });
  });
});

describe("filterDirectory", () => {
  const alle = buildRoleDirectory([vs()], labelOf);

  it("lässt bei „nur offene“ keine besetzte Zeile stehen", () => {
    const [d] = filterDirectory(alle, { query: "", onlyUnfilled: true });
    expect(allEntries(d!).every((e) => e.userId === null)).toBe(true);
  });

  /**
   * Eine Karte mit Kopf und nichts darunter sähe aus wie ein Ergebnis, ist aber
   * keins — dasselbe gilt für eine ART-Gruppe ohne Treffer.
   */
  it("wirft leere Spalten und leere Wertströme weg", () => {
    const voll = buildRoleDirectory(
      [vs({ architectLeadId: "u-x", arts: [], solutions: [] })],
      () => "x@x.dev",
    );
    expect(filterDirectory(voll, { query: "", onlyUnfilled: true })).toEqual([]);
  });

  it("sucht über Person, Rolle und Anliegen", () => {
    expect(filterDirectory(alle, { query: "anna", onlyUnfilled: false })[0]?.entries).toHaveLength(
      1,
    );
    expect(
      filterDirectory(alle, { query: "architekt", onlyUnfilled: false })[0]?.entries,
    ).toHaveLength(1);
    expect(
      filterDirectory(alle, { query: "BUDGET", onlyUnfilled: false })[0]?.entries,
    ).toHaveLength(1);
  });

  /**
   * Sonst verschwände die Spalte unter der Kachel, die man gerade gesucht hat.
   */
  it("behält den ART, wenn nur seine Solution trifft", () => {
    const [d] = filterDirectory(alle, { query: "erika", onlyUnfilled: false });
    expect(d?.arts).toHaveLength(1);
    expect(d?.arts[0]?.entries).toEqual([]);
    expect(d?.arts[0]?.solutions.map((so) => so.name)).toEqual(["Betrieb"]);
  });

  it("kombiniert Suche und Filter", () => {
    // „anna" ist benannt — zusammen mit „nur offene" bleibt nichts.
    expect(filterDirectory(alle, { query: "anna", onlyUnfilled: true })).toEqual([]);
  });
});
