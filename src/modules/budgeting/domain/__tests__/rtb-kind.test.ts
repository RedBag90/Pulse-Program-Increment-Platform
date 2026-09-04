import { describe, it, expect } from "vitest";
import {
  isChangeKind,
  rtbKindOrDefault,
  splitRunAndChange,
  type RtbGroupable,
} from "@/modules/budgeting/domain/rtb-kind";

/**
 * `rtb-kind.ts` hatte bis hierhin keinen Test — dabei entscheidet die Datei,
 * was als Betriebskosten gilt und was als Veränderung.
 */

const item = (over: Partial<RtbGroupable> = {}): RtbGroupable => ({
  kind: "run",
  plannedAmount: 100_000,
  interval: "yearly",
  active: true,
  ...over,
});

describe("rtbKindOrDefault", () => {
  it("fällt auf Betrieb zurück — das ist der Bestand", () => {
    for (const raw of [null, undefined, "", "unbekannt"]) {
      expect(rtbKindOrDefault(raw)).toBe("run");
    }
  });

  it("erkennt die bekannte Art", () => {
    expect(rtbKindOrDefault("art_change")).toBe("art_change");
  });
});

describe("isChangeKind", () => {
  it("trennt Grow von Run", () => {
    expect(isChangeKind("art_change")).toBe(true);
    expect(isChangeKind("run")).toBe(false);
    expect(isChangeKind(null)).toBe(false);
  });
});

describe("splitRunAndChange", () => {
  it("trennt nach Art und summiert je Gruppe getrennt", () => {
    // Die Zahlen der gemeldeten Fläche: 758.000 € standen als „Betriebskosten"
    // da, obwohl 520.000 € davon ART-Epic-Budget waren.
    const { run, change } = splitRunAndChange([
      item({ plannedAmount: 140_000 }),
      item({ plannedAmount: 42_000 }),
      item({ plannedAmount: 28_000, interval: "half_yearly" }),
      item({ kind: "art_change", plannedAmount: 100_000, interval: "half_yearly" }),
      item({ kind: "art_change", plannedAmount: 160_000, interval: "half_yearly" }),
    ]);

    expect(run.items).toHaveLength(3);
    expect(change.items).toHaveLength(2);
    expect(run.annual).toBe(238_000);
    expect(change.annual).toBe(520_000);
    // Zusammen wieder die alte, irreführende Gesamtsumme.
    expect(run.annual + change.annual).toBe(758_000);
  });

  it("zählt nur aktive Positionen", () => {
    const { run } = splitRunAndChange([
      item({ plannedAmount: 100_000 }),
      item({ plannedAmount: 999_000, active: false }),
    ]);
    // Die inaktive Zeile bleibt in der Liste — sie wird durchgestrichen
    // angezeigt —, zählt aber nicht in die Summe.
    expect(run.items).toHaveLength(2);
    expect(run.annual).toBe(100_000);
  });

  it("gibt den Kachel-Ask als halben Jahresbetrag", () => {
    const { run, change } = splitRunAndChange([
      item({ plannedAmount: 200_000 }),
      item({ kind: "art_change", plannedAmount: 60_000 }),
    ]);
    expect(run.cycle).toBe(100_000);
    expect(change.cycle).toBe(30_000);
  });

  it("liefert leere Gruppen statt undefined", () => {
    const { run, change } = splitRunAndChange([]);
    expect(run).toEqual({ items: [], annual: 0, cycle: 0 });
    expect(change).toEqual({ items: [], annual: 0, cycle: 0 });
  });

  it("behandelt eine Position ohne Art als Betrieb", () => {
    const { run, change } = splitRunAndChange([item({ kind: null })]);
    expect(run.items).toHaveLength(1);
    expect(change.items).toHaveLength(0);
  });
});
