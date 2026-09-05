import { describe, it, expect } from "vitest";
import { epicLinkDeniedReason } from "@/modules/core/goals/domain/epic-link-access";

/**
 * Der gemeldete Fall: „Epic angelegt — Ziel-Verknüpfung nicht möglich:
 * Insufficient permissions". Ein Epic Owner darf ein Epic anlegen
 * (`epic.create`/`epic.update` sind in seinem Standard-Bündel), aber
 * `kpi.bind` ist es nicht — und daran hing bis hierhin auch das blanke
 * Anhängen an ein Ziel.
 */

const epicOwner = { mayEditEpic: true, mayBindKpi: false };
const portfolioManager = { mayEditEpic: true, mayBindKpi: true };
const viewer = { mayEditEpic: false, mayBindKpi: false };
/** Denkbar über eine angepasste Rollen-Zeile: darf binden, aber nicht schreiben. */
const nurBinder = { mayEditEpic: false, mayBindKpi: true };

describe("epicLinkDeniedReason — blankes Anhängen", () => {
  it("laesst den Epic Owner sein Epic einem Ziel zuordnen", () => {
    expect(epicLinkDeniedReason(epicOwner, false)).toBeNull();
  });

  it("laesst das Portfolio-Management weiterhin durch", () => {
    expect(epicLinkDeniedReason(portfolioManager, false)).toBeNull();
  });

  it("laesst auch den durch, der nur binden darf", () => {
    // Wer das Schwerere darf, darf auch das Leichtere — sonst verlöre jemand
    // ein Recht, das er heute hat.
    expect(epicLinkDeniedReason(nurBinder, false)).toBeNull();
  });

  it("weist ab, wer das Epic gar nicht bearbeiten darf", () => {
    expect(epicLinkDeniedReason(viewer, false)).toContain("epic.update");
  });
});

describe("epicLinkDeniedReason — bezifferter Beitrag", () => {
  it("bleibt beim Portfolio-Management", () => {
    expect(epicLinkDeniedReason(portfolioManager, true)).toBeNull();
  });

  it("weist den Epic Owner ab", () => {
    // Die Zahl rollt in den Ziel-Trio; das ist eine Zusage, kein Vorschlag.
    expect(epicLinkDeniedReason(epicOwner, true)).toContain("kpi.bind");
  });

  it("weist den Viewer ab", () => {
    expect(epicLinkDeniedReason(viewer, true)).toContain("kpi.bind");
  });

  it("nennt einen Grund, keinen leeren Fehlschlag", () => {
    // Wie `potWindowClosedReason`: sagen, warum nicht.
    for (const facts of [epicOwner, viewer]) {
      expect(epicLinkDeniedReason(facts, true)!.length).toBeGreaterThan(20);
    }
  });
});
