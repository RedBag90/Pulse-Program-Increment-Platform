import { describe, it, expect } from "vitest";
import { featureStartBlockedReason } from "@/modules/work/domain/feature-start";

const NO_PI = "Feature ist keinem PI zugewiesen — bitte erst einplanen";
const GATE = "Epic noch nicht in Implementation";

describe("featureStartBlockedReason", () => {
  it("verlangt ein PI, bevor irgendetwas anderes zählt", () => {
    expect(featureStartBlockedReason({ piId: null, parentId: "e1", parentStageGate: "L4" })).toBe(
      NO_PI,
    );
    // Auch das eigenständige Feature braucht einen Termin.
    expect(featureStartBlockedReason({ piId: null, parentId: null, parentStageGate: null })).toBe(
      NO_PI,
    );
  });

  it("lässt ein Feature erst laufen, wenn sein Epic in der Umsetzung ist", () => {
    for (const gate of ["L3", "L4", "L5"]) {
      expect(
        featureStartBlockedReason({ piId: "pi1", parentId: "e1", parentStageGate: gate }),
      ).toBeNull();
    }
    for (const gate of ["L0", "L1", "L2"]) {
      expect(
        featureStartBlockedReason({ piId: "pi1", parentId: "e1", parentStageGate: gate }),
      ).toContain(GATE);
    }
  });

  /**
   * Hier standen bis zum Reifegrad-Neuschnitt `"L3.1"` und `"L3.2"` in der
   * blockierenden Liste — Werte, die `stage_gate` nie getragen hat. Was sie
   * belegten, war nicht „diese Unterstufe blockiert", sondern **„was die
   * Liste nicht kennt, blockiert"**. Das steht jetzt als eigene Aussage da,
   * mit einem Wert, den es nirgends gibt.
   */
  it("blockiert, was kein Reifegrad ist", () => {
    expect(
      featureStartBlockedReason({ piId: "pi1", parentId: "e1", parentStageGate: "L9" }),
    ).toContain(GATE);
  });

  /**
   * **Die Zeile, für die es die Funktion gibt.** Ein eigenständiges Feature
   * hängt an keinem Epic — es gibt kein Tor, auf das es warten könnte. Bisher
   * galt das auch, aber nur weil die Prüfung innerhalb einer
   * `if (parentId)`-Klammer stand und nie erreicht wurde.
   */
  it("lässt ein eigenständiges Feature mit PI ohne Tor starten", () => {
    expect(
      featureStartBlockedReason({ piId: "pi1", parentId: null, parentStageGate: null }),
    ).toBeNull();
  });

  /**
   * `parentStageGate === null` bei gesetztem `parentId` heisst: das Epic wurde
   * nicht gefunden (gelöscht, fremder Mandant). Das **blockiert** — so wie
   * bisher der `!epic`-Zweig im Service.
   */
  it("blockiert, wenn das Eltern-Epic nicht gefunden wurde", () => {
    expect(
      featureStartBlockedReason({ piId: "pi1", parentId: "e1", parentStageGate: null }),
    ).toContain(GATE);
  });
});
