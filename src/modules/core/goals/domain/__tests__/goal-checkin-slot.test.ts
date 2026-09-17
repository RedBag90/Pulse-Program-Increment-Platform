import { describe, it, expect } from "vitest";
import {
  mergeCheckinSlot,
  EMPTY_SLOT,
  type CheckinSlot,
} from "@/modules/core/goals/domain/goal-checkin-slot";

/**
 * Der gemeldete Datenverlust: „Fortschritt aktualisieren" schrieb hart
 * `status: null, note: null, sections: null` in den Tages-Slot. Ein morgens
 * geschriebenes „At risk" samt Begründung war nachmittags weg, sobald jemand
 * die Zahl nachtrug.
 */

const bestehend: CheckinSlot = {
  status: "at_risk",
  value: 2,
  progress: 0.5,
  note: "Lieferant springt ab.",
  sections: [{ title: "Risiko", body: "Ersatz wird gesucht." }],
};

describe("mergeCheckinSlot", () => {
  it("behält, was der Schreiber nicht gesagt hat — der Fortschritts-Fall", () => {
    // recordGoalProgress trägt nur Wert und Fortschritt nach.
    const slot = mergeCheckinSlot(bestehend, { value: 3, progress: 0.75 });
    expect(slot).toEqual({
      status: "at_risk",
      value: 3,
      progress: 0.75,
      note: "Lieferant springt ab.",
      sections: [{ title: "Risiko", body: "Ersatz wird gesucht." }],
    });
  });

  it("löscht, was ausdrücklich geleert wird", () => {
    const slot = mergeCheckinSlot(bestehend, { status: null, note: null, sections: null });
    expect(slot.status).toBeNull();
    expect(slot.note).toBeNull();
    expect(slot.sections).toBeNull();
    // Der Wert war nicht Thema und bleibt stehen.
    expect(slot.value).toBe(2);
  });

  it("behält den eingefrorenen Wert, wenn nur der Status kommt", () => {
    const slot = mergeCheckinSlot(bestehend, { status: "on_track" });
    expect(slot.value).toBe(2);
    expect(slot.progress).toBe(0.5);
  });

  it("ist auf einem leeren Tag schlicht das Gesagte", () => {
    expect(mergeCheckinSlot(null, { status: "on_track", value: 1 })).toEqual({
      ...EMPTY_SLOT,
      status: "on_track",
      value: 1,
    });
  });

  it("zählt leere Sektionen als nichts, nicht als Eintrag", () => {
    // Der Composer schickt `[]`, wenn der Autor alle Blöcke wieder entfernt hat.
    expect(mergeCheckinSlot(null, { sections: [] }).sections).toBeNull();
    expect(mergeCheckinSlot(bestehend, { sections: [] }).sections).toBeNull();
  });

  it("zählt eine leere Notiz als nichts", () => {
    expect(mergeCheckinSlot(null, { note: "   " }).note).toBeNull();
  });

  it("überschreibt Text, wenn neuer Text kommt", () => {
    const slot = mergeCheckinSlot(bestehend, {
      sections: [{ title: "Neu", body: "Ersatz gefunden." }],
    });
    expect(slot.sections).toEqual([{ title: "Neu", body: "Ersatz gefunden." }]);
  });
});
