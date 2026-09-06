import { describe, it, expect } from "vitest";
import { potStanding, type ArtEpicBudget } from "@/modules/budgeting/domain/art-epic-budget";

/**
 * Die Kachel „Noch zu verteilen" auf der ART-Übersicht. Sie soll nie zu etwas
 * einladen, was das Verteil-Formular danach ablehnt — deshalb vier Zustände
 * statt eines Betrags mit Vorzeichen.
 */
const pot = (over: Partial<ArtEpicBudget> = {}): ArtEpicBudget => ({
  artId: "art-1",
  cycleKey: "2026-H2",
  total: 100_000,
  distributed: 80_000,
  remaining: 20_000,
  closedReason: null,
  ...over,
});

describe("potStanding — was ist vom Rahmen noch offen", () => {
  it("meldet den offenen Rest mit seinem Anteil", () => {
    // Der gemessene Fall: Materials & Energy, 100.000 zugesprochen, 80.000
    // verteilt — die vier bestehenden Kacheln zeigen nur die 80.000.
    const s = potStanding(pot());
    expect(s.state).toBe("open");
    expect(s.remaining).toBe(20_000);
    expect(s.share).toBeCloseTo(0.2);
    expect(s.reason).toBeNull();
  });

  it("meldet einen leeren Rest als vollständig verteilt", () => {
    const s = potStanding(pot({ distributed: 100_000, remaining: 0 }));
    expect(s.state).toBe("fully_distributed");
    expect(s.remaining).toBe(0);
  });

  it("nennt bei gesperrtem Rahmen den Grund statt eines Links", () => {
    const s = potStanding(pot({ closedReason: "Die Kachel ist noch nicht finalisiert." }));
    expect(s.state).toBe("closed");
    expect(s.reason).toBe("Die Kachel ist noch nicht finalisiert.");
    expect(s.remaining).toBe(20_000);
  });

  it("lässt den leeren Rest die Sperre schlagen", () => {
    // Ist nichts mehr offen, ist die Sperre keine Auskunft mehr — sie führte
    // sonst zu „gesperrt" an einem Rahmen, an dem es nichts zu tun gibt.
    const s = potStanding(
      pot({ distributed: 100_000, remaining: 0, closedReason: "Runde abgeschlossen." }),
    );
    expect(s.state).toBe("fully_distributed");
    expect(s.reason).toBeNull();
  });

  it("bleibt ohne Rahmen stumm, statt 0 von 0 zu behaupten", () => {
    expect(potStanding(null).state).toBe("no_pot");
    expect(potStanding(pot({ total: 0, distributed: 0, remaining: 0 })).state).toBe("no_pot");
  });

  it("teilt nie durch null", () => {
    expect(potStanding(pot({ total: 0, distributed: 0, remaining: 0 })).share).toBe(0);
  });

  it("lässt einen überzogenen Rahmen nicht negativ werden", () => {
    // Verteilt mehr als zugesprochen — darf vorkommen, wenn ein Award nach der
    // Verteilung gekürzt wurde. Die Kachel sagt dann vollständig verteilt,
    // nicht minus 5.000 € offen.
    const s = potStanding(pot({ distributed: 105_000, remaining: -5_000 }));
    expect(s.state).toBe("fully_distributed");
    expect(s.remaining).toBe(0);
  });
});
