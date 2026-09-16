import { describe, it, expect } from "vitest";
import {
  snapshotFeatures,
  snapshotArtRows,
  snapshotJobSizeSum,
  assertSnapshotLoad,
  type SeedFeatureRow,
  type SeedPiMeta,
} from "../seed-snapshot";
import {
  buildBudgetPlanSnapshot,
  type BudgetPlanSnapshot,
} from "@/modules/budgeting/domain/budget-plan-snapshot";

/**
 * Der Fehler, den diese Prüfungen festhalten: alle drei Seeds übergaben
 * `features: []` an `buildBudgetPlanSnapshot` — direkt nachdem sie hunderte
 * Features mit Job Size, ART und PI angelegt hatten. Die Fläche „ARTs — Budget
 * vs. Demand je Halbjahr" zeigte deshalb in jeder geseedeten Revision eine
 * Bedarfszeile aus „—" und eine Σ-Spalte mit `0 · 0`.
 */

const D = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);

const PIS = new Map<string, SeedPiMeta>([
  ["pi-alt", { name: "PI 1", startDate: D("2025-02-13"), endDate: D("2025-04-23") }],
  ["pi-neu", { name: "PI 9", startDate: D("2026-08-26"), endDate: D("2026-11-03") }],
]);

const ARTS = new Map<string, string>([
  ["art-a", "Materials & Energy"],
  ["art-b", "Transport & Network"],
]);

const row = (over: Partial<SeedFeatureRow> = {}): SeedFeatureRow => ({
  id: "f-1",
  parentId: "e-1",
  title: "Ein Feature",
  status: "completed",
  artId: "art-a",
  piId: "pi-neu",
  wsjfJobSize: 5,
  createdAt: D("2026-01-10"),
  ...over,
});

describe("snapshotFeatures", () => {
  it("reicht ein vollständiges Feature mit ART-Namen und PI-Fenster durch", () => {
    const [f] = snapshotFeatures([row()], {
      artNameById: ARTS,
      piById: PIS,
      asOf: D("2026-09-01"),
      cycleKey: "2026-H2",
    });
    expect(f).toMatchObject({
      featureId: "f-1",
      parentEpicId: "e-1",
      artName: "Materials & Energy",
      piName: "PI 9",
      wsjfJobSize: 5,
    });
    expect(f?.piStartDate).toEqual(D("2026-08-26"));
  });

  /**
   * Der Schnitt, ohne den die sechs Revisionen eines Laufs identisch wären: ein
   * Beleg aus 2024 darf ein Feature nicht kennen, das 2026 angelegt wurde.
   */
  it("verwirft, was zum Erfassungszeitpunkt noch nicht angelegt war", () => {
    const rows = [
      row({ id: "alt", createdAt: D("2025-06-01") }),
      row({ id: "neu", createdAt: D("2026-06-01") }),
    ];
    const ids = snapshotFeatures(rows, {
      artNameById: ARTS,
      piById: PIS,
      asOf: D("2026-01-01"),
      cycleKey: "2026-H2",
    }).map((f) => f.featureId);
    expect(ids).toEqual(["alt"]);
  });

  /**
   * Der Schnitt, der den `createdAt`-Schnitt ergaenzt — und den er nicht
   * ersetzen konnte. Ein 2024 angelegtes Feature kommt in diesem Datensatz erst
   * 2026 in ein PI; ohne diesen Deckel trugen **alle sechs** Revisionen eines
   * Laufs dieselbe Last aus 2026, auch die von 2024. Die Einplanung setzt den
   * Bedarf ins Halbjahr, nicht der Anlagetag.
   */
  it("sieht die Einplanung nur bis zum Halbjahr hinter dem erfassten Zyklus", () => {
    const rows = [row({ id: "alt", piId: "pi-alt" }), row({ id: "spaet", piId: "pi-neu" })];
    const bis = (cycleKey: string): string[] =>
      snapshotFeatures(rows, {
        artNameById: ARTS,
        piById: PIS,
        asOf: D("2026-09-01"),
        cycleKey,
      }).map((f) => f.featureId);

    // PI 9 startet in 2026-H2 — aus 2025-H1 heraus nicht zu sehen.
    expect(bis("2025-H1")).toEqual(["alt"]);
    // Aus 2026-H1 heraus schon: das naechste Halbjahr gehoert zum Fenster.
    expect(bis("2026-H1")).toEqual(["alt", "spaet"]);
    expect(bis("2026-H2")).toEqual(["alt", "spaet"]);
  });

  /**
   * Dieselbe Menge, die auch `loadFeatureSnapshotInputs` verwirft. Ein Feature
   * ohne PI ist **nicht** Last im Halbjahr null — es ist unverplant, und dafür
   * hat `aggregateArtFeatureLoad` einen eigenen Eimer.
   */
  it("verwirft Zeilen ohne PI, ohne ART und ohne Eltern-Epic", () => {
    const rows = [
      row({ id: "ohne-pi", piId: null }),
      row({ id: "ohne-art", artId: null }),
      row({ id: "ohne-epic", parentId: null }),
      row({ id: "fremdes-pi", piId: "pi-gibt-es-nicht" }),
      row({ id: "heil" }),
    ];
    const ids = snapshotFeatures(rows, {
      artNameById: ARTS,
      piById: PIS,
      asOf: D("2026-09-01"),
      cycleKey: "2026-H2",
    }).map((f) => f.featureId);
    expect(ids).toEqual(["heil"]);
  });
});

describe("snapshotArtRows", () => {
  const ARTDEFS = [
    { id: "art-b", name: "Transport & Network" },
    { id: "art-a", name: "Materials & Energy" },
  ];
  const FINALS = [
    { artId: "art-a", cycleKey: "2025-H2", amount: 100_000 },
    { artId: "art-a", cycleKey: "2026-H1", amount: 57_500 },
    { artId: "art-a", cycleKey: "2026-H1", amount: 100_000 },
    { artId: "art-a", cycleKey: "2026-H2", amount: 236_050 },
  ];

  it("summiert je ART und Halbjahr und sortiert nach Namen", () => {
    const rows = snapshotArtRows(ARTDEFS, FINALS, "2026-H2");
    expect(rows.map((r) => r.name)).toEqual(["Materials & Energy", "Transport & Network"]);
    expect(rows[0]?.budgetByPeriod).toEqual({
      "2025-H2": 100_000,
      "2026-H1": 157_500,
      "2026-H2": 236_050,
    });
  });

  /** Der Deckel: ein in 2026-H1 eingefrorener Beleg kennt 2026-H2 nicht. */
  it("nimmt nur Halbjahre bis einschließlich des erfassten Zyklus", () => {
    const rows = snapshotArtRows(ARTDEFS, FINALS, "2026-H1");
    expect(Object.keys(rows[0]?.budgetByPeriod ?? {})).toEqual(["2025-H2", "2026-H1"]);
  });

  /**
   * Ein ART ohne jede Zuteilung verschwindet nicht — er steht mit leerem
   * Budget da. Genau das sagt `loadArtSnapshotInputs` auch, und genau das hat
   * der Seed bisher überschrieben: „Shared Services & Automation" hatte keinen
   * einzigen Kandidaten und behauptete trotzdem 130.000 €.
   */
  it("führt auch einen ART ohne Zuteilung", () => {
    const rows = snapshotArtRows(ARTDEFS, FINALS, "2026-H2");
    expect(rows[1]).toEqual({
      artId: "art-b",
      name: "Transport & Network",
      budgetByPeriod: {},
    });
  });

  /** 0 € ist eine Aussage, kein fehlender Wert. */
  it("legt den Schlüssel auch für einen finalen Betrag von 0 € an", () => {
    const rows = snapshotArtRows(
      ARTDEFS,
      [{ artId: "art-b", cycleKey: "2026-H1", amount: 0 }],
      "2026-H1",
    );
    expect(rows[1]?.budgetByPeriod).toEqual({ "2026-H1": 0 });
  });
});

describe("assertSnapshotLoad", () => {
  const snapshot = (features: ReturnType<typeof snapshotFeatures>): BudgetPlanSnapshot =>
    buildBudgetPlanSnapshot({
      cycleKey: "2026-H2",
      capturedAt: D("2026-09-01"),
      pool: { "2026-H2": 1_000_000 },
      epics: [],
      artRows: [
        { artId: "art-a", name: "Materials & Energy", budgetByPeriod: { "2026-H2": 190_000 } },
      ],
      features,
    });

  it("zählt die Last, die durchgereicht wurde", () => {
    const s = snapshot(
      snapshotFeatures([row({ wsjfJobSize: 7 })], {
        artNameById: ARTS,
        piById: PIS,
        asOf: D("2026-09-01"),
        cycleKey: "2026-H2",
      }),
    );
    expect(snapshotJobSizeSum(s)).toBe(7);
    expect(s.arts[0]?.loadByPeriod).toEqual({ "2026-H2": { featureCount: 1, jobSizeSum: 7 } });
    expect(() => assertSnapshotLoad([s], "Testmandant")).not.toThrow();
  });

  /** Der gemeldete Fehler, als Zusicherung. */
  it("wirft, wenn keine Revision eines Laufs Last trägt", () => {
    const leer = snapshot([]);
    expect(leer.arts[0]?.loadByPeriod).toEqual({});
    expect(() => assertSnapshotLoad([leer, leer], "Large Test Corp")).toThrow(
      /keine der 2 Budget-Plan-Revisionen/,
    );
  });
});
